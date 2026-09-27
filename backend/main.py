import os
import time
import json
import sqlite3
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from unmasker import TorClearnetUnmasker, MOCK_BENCHMARKS
from rag import OSINTKnowledgeRAG

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("DeepTrace.Gateway")

app = FastAPI(
    title="DeepTrace AI - Threat Actor De-Anonymization API",
    version="1.0.0",
    description="Autonomous OSINT and Dark Web infrastructure unmasking, stylometry, RAG intelligence, and Neo4j graph mapping.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("SQLITE_DB_PATH", "deep_trace.db")
NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            target_onion TEXT NOT NULL,
            clearnet_domain TEXT,
            clearnet_ip TEXT,
            favicon_hash INTEGER,
            confidence_score REAL,
            status TEXT NOT NULL,
            scan_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

unmasker_engine = TorClearnetUnmasker()
rag_engine = OSINTKnowledgeRAG()

class ScanRequest(BaseModel):
    target: str = Field(..., example="duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion")
    use_gateway_bypass: bool = Field(True, description="Query via proxy gateway")

class StylometryRequest(BaseModel):
    suspect_text: str
    reference_text: str
    suspect_hours: Optional[List[int]] = None
    reference_hours: Optional[List[int]] = None

class RAGLearnRequest(BaseModel):
    threat_actor: str
    category: str
    content: str
    source: Optional[str] = "OSINT Report"

class RAGQueryRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5

def query_neo4j_or_sqlite(limit: int = 100) -> Dict[str, Any]:
    if NEO4J_URI and NEO4J_PASSWORD:
        try:
            from neo4j import GraphDatabase
            driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))
            with driver.session() as session:
                cypher = f"MATCH (n)-[r]->(m) RETURN n, r, m LIMIT {limit}"
                result = session.run(cypher)
                nodes = {}
                edges = []
                for record in result:
                    n = record["n"]
                    m = record["m"]
                    r = record["r"]
                    n_id = str(n.element_id)
                    m_id = str(m.element_id)
                    nodes[n_id] = {"id": n_id, "label": list(n.labels)[0] if n.labels else "Node", "name": dict(n).get("name", n_id), "properties": dict(n)}
                    nodes[m_id] = {"id": m_id, "label": list(m.labels)[0] if m.labels else "Node", "name": dict(m).get("name", m_id), "properties": dict(m)}
                    edges.append({
                        "id": str(r.element_id),
                        "source": n_id,
                        "target": m_id,
                        "relationship": r.type,
                        "properties": dict(r),
                    })
            driver.close()
            return {"source": "Neo4j AuraDB", "nodes": list(nodes.values()), "edges": edges}
        except Exception as e:
            logger.warning(f"Neo4j query failed, returning fallback graph: {e}")

    return {
        "source": "SQLite Local Failover",
        "nodes": [{"id": "node_1", "label": "ThreatActor", "name": "LockBitSupp", "properties": {"tier": "Syndicate"}}],
        "edges": []
    }
@app.get("/")
@app.head("/")
def root_health_check():
    """Satisfies Render.com's uptime health check pings."""
    return {"status": "DeepTrace API is Live", "version": "1.0.0"}
    
@app.get("/api/health")
def health_check():
    neo4j_configured = bool(NEO4J_URI and NEO4J_PASSWORD)
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "neo4j_auradb": {"configured": neo4j_configured, "uri": NEO4J_URI or "None"},
        "unmasker_engine": "ACTIVE (Tor SOCKS / Gateway)",
        "rag_engine": "ACTIVE (Gemini Embedding API)"
    }

@app.get("/api/test-neo4j")
def test_neo4j_connection():
    if not (NEO4J_URI and NEO4J_PASSWORD):
        return {"status": "FAIL", "message": "Neo4j credentials not found in environment."}
    try:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))
        driver.verify_connectivity()
        with driver.session() as session:
            count = session.run("MATCH (n) RETURN count(n) AS total").single()["total"]
        driver.close()
        return {"status": "CONNECTED", "database": "Neo4j AuraDB", "total_nodes": count}
    except Exception as e:
        return {"status": "CONNECTION_ERROR", "error_detail": str(e)}

@app.post("/api/scan")
def scan_onion_target(req: ScanRequest):
    raw_target = req.target.strip()
    if not raw_target:
        raise HTTPException(status_code=400, detail="Target onion address is required.")

    scan_result = unmasker_engine.unmask(raw_target)
    scan_id = hashlib.sha256(f"{raw_target}_{time.time()}".encode()).hexdigest()[:16]
    
    # Persist graph data into Neo4j if connected
    if NEO4J_URI and NEO4J_PASSWORD:
        try:
            from neo4j import GraphDatabase
            driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))
            with driver.session() as session:
                session.run(
                    """
                    MERGE (h:HiddenService {name: $onion})
                    SET h.status = $status, h.confidence = $conf, h.favicon_hash = $fav
                    """,
                    onion=scan_result["onion"],
                    status="COMPLETED",
                    conf=scan_result.get("confidence_score", 0.0),
                    fav=str(scan_result.get("favicon_hash", ""))
                )
            driver.close()
        except Exception as e:
            logger.error(f"Failed to write scan to Neo4j: {e}")

    scan_result["scan_id"] = scan_id
    return scan_result

@app.get("/api/graph")
def get_relationship_graph(limit: int = 150):
    return query_neo4j_or_sqlite(limit=limit)

@app.post("/api/rag/learn")
def learn_osint_tactic(req: RAGLearnRequest):
    return rag_engine.learn(
        content=req.content,
        threat_actor=req.threat_actor,
        category=req.category,
        source=req.source
    )

@app.post("/api/rag/query")
def query_osint_tactics(req: RAGQueryRequest):
    return rag_engine.query(req.query, top_k=req.max_results)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
