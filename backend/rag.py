import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("DeepTrace.RAG")

RAG_STORAGE_DIR = os.getenv("RAG_STORAGE_DIR", "/tmp/deeptrace_rag")
os.makedirs(RAG_STORAGE_DIR, exist_ok=True)

SEED_TACTICAL_INTELLIGENCE = [
    {
        "id": "tac_001_favicon_mmh3",
        "threat_actor": "General Darknet Infrastructure",
        "category": "Passive Infrastructure Fingerprinting",
        "title": "Favicon MurmurHash3 Tor-to-Clearnet Correlation",
        "content": (
            "Hidden services frequently reuse corporate or clearnet branding assets without sanitization. "
            "By fetching /favicon.ico or icons declared in <link rel='icon'>, encoding binary in Base64 "
            "with RFC-2045 line wrapping, and computing signed 32-bit MurmurHash3 (mmh3), analysts match "
            "against Shodan to reveal clearnet public IPs and hosting providers."
        ),
        "mitre_technique": "T1592.002 - Gather Victim Host Information",
        "source": "Shodan OSINT Methodology",
    },
    {
        "id": "tac_002_ssl_san_leak",
        "threat_actor": "Ransomware Affiliates",
        "category": "Cryptographic Misconfiguration",
        "title": "X.509 Subject Alternative Name (SAN) Domain Leakage",
        "content": (
            "When dark web operators configure HTTPS using multi-domain SSL certificates, they often include "
            "both their clearnet domain and onion mirror in the Subject Alternative Name (SAN) extension, "
            "instantly establishing an irrefutable link to registered clearnet infrastructure."
        ),
        "mitre_technique": "T1588.004 - Digital Certificates",
        "source": "CISA Alert",
    }
]

class OSINTKnowledgeRAG:
    def __init__(self, persist_dir: str = RAG_STORAGE_DIR):
        self.persist_dir = persist_dir
        self.fallback_file = os.path.join(self.persist_dir, "fallback_knowledge.json")
        self.documents: List[Dict[str, Any]] = []
        self._load()

        # 1. Initialize Google GenAI client FIRST
        self.gemini_client = None
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=api_key)
                logger.info("Google GenAI Client initialized for RAG embeddings.")
            except Exception as e:
                logger.warning(f"Failed to initialize GenAI client: {e}")

        # 2. Seed intelligence SECOND (now that gemini_client exists)
        self._seed_default_intelligence()

    def _load(self):
        if os.path.exists(self.fallback_file):
            try:
                with open(self.fallback_file, "r", encoding="utf-8") as f:
                    self.documents = json.load(f)
            except Exception:
                self.documents = []

    def _save(self):
        try:
            with open(self.fallback_file, "w", encoding="utf-8") as f:
                json.dump(self.documents, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save RAG store: {e}")

    def _seed_default_intelligence(self):
        existing_ids = {d["id"] for d in self.documents}
        for item in SEED_TACTICAL_INTELLIGENCE:
            if item["id"] not in existing_ids:
                self.learn(
                    doc_id=item["id"],
                    content=item["content"],
                    threat_actor=item["threat_actor"],
                    category=item["category"],
                    source=item["source"],
                    extra_metadata={"mitre_technique": item["mitre_technique"], "title": item["title"]}
                )

    def learn(
        self,
        content: str,
        threat_actor: str,
        category: str,
        source: str = "OSINT Feed",
        doc_id: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not doc_id:
            doc_id = f"doc_{abs(hash(content + threat_actor))[:10]}"

        metadata = {
            "threat_actor": threat_actor,
            "category": category,
            "source": source,
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        }
        if extra_metadata:
            metadata.update(extra_metadata)

        # Generate Gemini embedding if client is ready
        embedding = None
        if self.gemini_client:
            try:
                response = self.gemini_client.models.embed_content(
                    model="text-embedding-004",
                    contents=content
                )
                if response and response.embeddings:
                    embedding = response.embeddings[0].values
            except Exception as e:
                logger.warning(f"Gemini embedding generation failed: {e}")

        self.documents = [d for d in self.documents if d["id"] != doc_id]
        self.documents.append({
            "id": doc_id,
            "content": content,
            "metadata": metadata,
            "embedding": embedding
        })
        self._save()

        return {"status": "INGESTED", "document_id": doc_id, "backend": "Gemini API + JSON Store"}

    def query(self, search_query: str, top_k: int = 4) -> Dict[str, Any]:
        scored = []
        query_tokens = set(search_query.lower().split())

        for doc in self.documents:
            doc_text = (doc["content"] + " " + json.dumps(doc.get("metadata", {}))).lower()
            doc_tokens = set(doc_text.split())
            intersection = query_tokens.intersection(doc_tokens)
            score = len(intersection) / max(1, len(query_tokens))

            meta = doc.get("metadata", {})
            if meta.get("threat_actor", "").lower() in search_query.lower():
                score += 0.4
            if meta.get("category", "").lower() in search_query.lower():
                score += 0.2

            scored.append({
                "id": doc["id"],
                "content": doc["content"],
                "metadata": meta,
                "similarity_score": round(min(0.99, max(0.1, score)), 3)
            })

        scored.sort(key=lambda x: x["similarity_score"], reverse=True)
        results = scored[:top_k]

        return {
            "query": search_query,
            "total_matches": len(results),
            "backend_engine": "Gemini Embedding API + Fallback Store",
            "matches": results,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
