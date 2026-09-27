import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  Database,
  Network,
  Server,
  FileText,
  AlertTriangle,
  Clock,
  Zap,
  Info
} from 'lucide-react';

// Simplified placeholder graph to show while Neo4j connects
const INITIAL_GRAPH_NODES = [
  { id: 'core', label: 'System', name: 'DeepTrace Core', properties: { status: 'Online' } },
  { id: 'db', label: 'Database', name: 'Neo4j Graph (Awaiting Data)', properties: { status: 'Pending Sync' } }
];

const INITIAL_GRAPH_EDGES = [
  { id: 'init_edge', source: 'core', target: 'db', relationship: 'AWAITING_CONNECTION' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://dark-web-threat-detector.onrender.com/api');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Backend wake-up & health state
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'waking' | 'ready'
  const [wakingElapsed, setWakingElapsed] = useState(0);

  // Unmasker Prober State
  const [targetUrl, setTargetUrl] = useState('duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // RAG State
  const [ragQuery, setRagQuery] = useState('favicon mmh3 Shodan hash');
  const [isSearchingRag, setIsSearchingRag] = useState(false);
  const [ragResults, setRagResults] = useState([
    {
      id: 'tac_001_favicon_mmh3',
      title: 'Favicon MurmurHash3 Tor-to-Clearnet Correlation',
      category: 'Passive Infrastructure Fingerprinting',
      threat_actor: 'General Darknet Infrastructure',
      mitre: 'T1592.002 - Gather Victim Host Information',
      score: 0.985,
      content:
        'Hidden services frequently reuse corporate or clearnet branding assets without sanitization. By fetching /favicon.ico or icons declared in <link rel="icon">, encoding in Base64 with RFC-2045 line wrapping, and computing signed 32-bit MurmurHash3 (mmh3), analysts can match directly against Shodan http.favicon.hash index to reveal clearnet public IPs, hosting providers, and associated domain names.',
    }
  ]);
  const [newTacticActor, setNewTacticActor] = useState('VoltTyphoon');
  const [newTacticCategory, setNewTacticCategory] = useState('SOHO Router Proxy Network');
  const [newTacticContent, setNewTacticContent] = useState('');
  const [isIngestingTactic, setIsIngestingTactic] = useState(false);
  const [tacticIngestSuccess, setTacticIngestSuccess] = useState(false);

  // Graph State
  const [nodes, setNodes] = useState(INITIAL_GRAPH_NODES);
  const [edges, setEdges] = useState(INITIAL_GRAPH_EDGES);
  const [graphFilter, setGraphFilter] = useState('ALL');
  const svgRef = useRef(null);

  // Poll Render backend to detect cold starts and wake-ups
  useEffect(() => {
    let pollInterval;
    let timerInterval;

    const pingBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${apiBaseUrl}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          setBackendStatus('ready');
          clearInterval(pollInterval);
          clearInterval(timerInterval);
        } else {
          setBackendStatus('waking');
        }
      } catch (err) {
        setBackendStatus('waking');
      }
    };

    pingBackend();
    pollInterval = setInterval(pingBackend, 3500);

    timerInterval = setInterval(() => {
      setWakingElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [apiBaseUrl]);

  // Handle circular layout logic for graph nodes
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((n, idx) => {
        if (n.x !== undefined && n.y !== undefined) return n;
        const angle = (idx / prevNodes.length) * 2 * Math.PI;
        const radius = 170 + (idx % 2 === 0 ? 30 : -20);
        return {
          ...n,
          x: 360 + radius * Math.cos(angle),
          y: 240 + radius * Math.sin(angle),
        };
      })
    );
  }, []);

  // Fetch /api/graph on mount if available
  useEffect(() => {
    async function loadGraphData() {
      try {
        const res = await fetch(`${apiBaseUrl}/graph`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.nodes && data.nodes.length > 0) {
            setNodes((prev) => {
              const posMap = new Map(prev.map((n) => [n.id, { x: n.x, y: n.y }]));
              return data.nodes.map((n, idx) => {
                const existing = posMap.get(n.id);
                if (existing) return { ...n, x: existing.x, y: existing.y };
                const angle = (idx / data.nodes.length) * 2 * Math.PI;
                return {
                  ...n,
                  x: 360 + 170 * Math.cos(angle),
                  y: 240 + 170 * Math.sin(angle),
                };
              });
            });
            if (data.edges) setEdges(data.edges);
          }
        }
      } catch (err) {}
    }
    loadGraphData();
  }, [apiBaseUrl, backendStatus]);

  // Execute /api/scan Endpoint
  const handleExecuteScan = async () => {
    const rawTarget = targetUrl.trim();
    if (!rawTarget) return;

    setIsScanning(true);
    try {
      const response = await fetch(`${apiBaseUrl}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: rawTarget, use_gateway_bypass: true }),
      });

      if (response.ok) {
        const data = await response.json();
        setScanResult(data);
      }
    } catch (e) {
      console.error("Scan Failed:", e);
    } finally {
      setIsScanning(false);
    }
  };

  // Submit /api/rag/learn
  const handleFeedRAG = async (e) => {
    e.preventDefault();
    if (!newTacticContent.trim()) return;

    setIsIngestingTactic(true);
    try {
      await fetch(`${apiBaseUrl}/rag/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threat_actor: newTacticActor,
          category: newTacticCategory,
          content: newTacticContent,
          source: 'Live OSINT Feed Input',
        }),
      });
    } catch (err) {}
    finally {
      setIsIngestingTactic(false);
      setTacticIngestSuccess(true);
      setRagResults((prev) => [
        {
          id: `tac_custom_${Date.now().toString().slice(-4)}`,
          title: `${newTacticCategory} - ${newTacticActor}`,
          category: newTacticCategory,
          threat_actor: newTacticActor,
          mitre: 'T1590 - Network Reconnaissance',
          score: 0.99,
          content: newTacticContent,
        },
        ...prev,
      ]);
      setNewTacticContent('');
      setTimeout(() => setTacticIngestSuccess(false), 3000);
    }
  };

  const handleDownloadDossier = async (format = 'pdf') => {
    const reportText = `DEEPTRACE FORENSIC REPORT: Target ${scanResult?.onion || 'Unknown'} unmasked to ${scanResult?.leaked_clearnet_domain || 'Unknown'} (Favicon mmh3: ${scanResult?.favicon_hash || 'N/A'})`;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DeepTrace_Forensic_Dossier.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const getNodeColor = (label) => {
    switch (label) {
      case 'ThreatActor': return '#ef4444';
      case 'HiddenService': return '#06b6d4';
      case 'ClearnetDomain': return '#3b82f6';
      case 'ClearnetIP': return '#8b5cf6';
      case 'CryptoWallet': return '#f59e0b';
      case 'PGPKey': return '#10b981';
      case 'System': return '#a855f7';
      case 'Database': return '#eab308';
      default: return '#ec4899';
    }
  };

  const filteredNodes = useMemo(() => {
    if (graphFilter === 'ALL') return nodes;
    return nodes.filter((n) => n.label === graphFilter);
  }, [nodes, graphFilter]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Threat Intel Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">DeepTrace AI</span>
              <span className="text-xs text-cyan-400 font-mono">v1.0.0</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Autonomous OSINT & Threat Actor De-Anonymization Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Live Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800">
            <span
              className={`h-2 w-2 rounded-full ${
                backendStatus === 'ready'
                  ? 'bg-emerald-400'
                  : backendStatus === 'waking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-slate-300 text-[11px]">
              {backendStatus === 'ready'
                ? 'Core & Neo4j Online'
                : backendStatus === 'waking'
                ? 'Activating Core...'
                : 'Connecting...'}
            </span>
          </div>

          <button
            onClick={() => handleDownloadDossier('pdf')}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF Dossier</span>
          </button>
        </div>
      </header>

      {/* Render Cold-Start / Database Waking Banner */}
      {backendStatus === 'waking' && (
        <div className="bg-amber-950/60 border-b border-amber-500/40 px-6 py-2.5 flex items-center justify-between backdrop-blur font-mono text-xs text-amber-300 transition-all">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Render Backend Activating:</strong> Cloud instance is waking up from idle sleep. Initializing Tor probers & activating Neo4j database ({wakingElapsed}s)...
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Typically completes in 30–50s
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'dashboard' ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'text-slate-400'
            }`}
          >
            Unmasker Prober
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'graph' ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'text-slate-400'
            }`}
          >
            Relationship Graph
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'rag' ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'text-slate-400'
            }`}
          >
            Feed RAG OSINT
          </button>
        </div>

        {/* Central Search & Results Panel */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="text-center">
                  <h2 className="text-lg font-bold text-white">Dark Web Infrastructure De-Anonymization</h2>
                  <p className="text-xs text-slate-400 mt-1">Input target .onion URL to unmask clearnet host infrastructure.</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="Enter .onion domain..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs font-mono text-slate-200"
                  />
                  <button
                    onClick={handleExecuteScan}
                    disabled={isScanning || backendStatus !== 'ready'}
                    className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="w-4 h-4" />
                    <span>{isScanning ? 'Unmasking...' : 'Unmask'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            {scanResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono text-cyan-400">UNMASKED ENTITY</span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {scanResult.leaked_clearnet_domain || scanResult.clearnet_domain || 'Analysis Failed / Protected'}
                    </h3>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xs text-slate-400">Confidence</span>
                    <div className="text-2xl font-bold text-emerald-400">
                      {scanResult.confidence_score || (scanResult.leaked_clearnet_domain ? 98.5 : 0)}%
                    </div>
                  </div>
                </div>

                {scanResult.opsec_fault && (
                  <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-mono text-red-400">OPSEC FAULT: {scanResult.opsec_fault}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono text-xs">
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1">Favicon mmh3 Hash</span>
                    <span className="text-white font-bold">{scanResult.favicon_hash || 'N/A'}</span>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1">Clearnet Public IPs</span>
                    <span className="text-white font-bold">{scanResult.clearnet_ips?.join(', ') || 'No IPs discovered'}</span>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1">HTTP ETag</span>
                    <span className="text-white font-bold truncate block">{scanResult.etag || 'N/A'}</span>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block mb-1">Server Banner</span>
                    <span className="text-white font-bold">{scanResult.server || 'Hidden'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Interactive Relationship Graph */}
        {activeTab === 'graph' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white uppercase font-mono mb-4">
              Threat Actor Relationship Graph (Neo4j AuraDB)
            </h3>
            <div className="h-[480px] bg-slate-950 rounded-xl border border-slate-800 relative">
              <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 720 480">
                {edges.map((e) => {
                  const s = nodeMap.get(e.source);
                  const t = nodeMap.get(e.target);
                  if (!s || !t) return null;
                  return (
                    <line
                      key={e.id}
                      x1={s.x || 360}
                      y1={s.y || 240}
                      x2={t.x || 360}
                      y2={t.y || 240}
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                  );
                })}
                {filteredNodes.map((n) => (
                  <g key={n.id} transform={`translate(${n.x || 360}, ${n.y || 240})`}>
                    <circle r={14} fill={`${getNodeColor(n.label)}22`} stroke={getNodeColor(n.label)} strokeWidth={2} />
                    <text y={25} fill="#cbd5e1" fontSize="10" fontFamily="monospace" textAnchor="middle">
                      {n.name.slice(0, 18)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}

        {/* Feed RAG OSINT Tab */}
        {activeTab === 'rag' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white uppercase font-mono mb-4">Feed RAG OSINT</h3>
              <form onSubmit={handleFeedRAG} className="space-y-3">
                <input
                  type="text"
                  value={newTacticActor}
                  onChange={(e) => setNewTacticActor(e.target.value)}
                  placeholder="Threat Actor"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white"
                />
                <input
                  type="text"
                  value={newTacticCategory}
                  onChange={(e) => setNewTacticCategory(e.target.value)}
                  placeholder="Category"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white"
                />
                <textarea
                  rows={5}
                  value={newTacticContent}
                  onChange={(e) => setNewTacticContent(e.target.value)}
                  placeholder="Intelligence Body..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  disabled={backendStatus !== 'ready'}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Vectorize & Ingest to ChromaDB
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white uppercase font-mono">Indexed OSINT Knowledge</h3>
              {ragResults.map((r) => (
                <div key={r.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                  <div className="text-cyan-400 font-semibold">{r.title}</div>
                  <div className="text-slate-400 mt-1">{r.content.slice(0, 160)}...</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
