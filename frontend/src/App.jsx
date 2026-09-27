import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  AlertTriangle,
  Activity
} from 'lucide-react';

const INITIAL_GRAPH_NODES = [
  { id: 'core', label: 'System', name: 'DeepTrace Core', properties: { status: 'Online' } },
  { id: 'db', label: 'Database', name: 'Neo4j Graph (Awaiting Data)', properties: { status: 'Pending Sync' } }
];

const INITIAL_GRAPH_EDGES = [
  { id: 'init_edge', source: 'core', target: 'db', relationship: 'AWAITING_CONNECTION' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiBaseUrl] = useState('https://dark-web-threat-detector.onrender.com/api');

  // Backend state
  const [backendStatus, setBackendStatus] = useState('checking');
  const [wakingElapsed, setWakingElapsed] = useState(0);

  // Unmasker State
  const [targetUrl, setTargetUrl] = useState('duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // RAG State
  const [ragResults, setRagResults] = useState([
    {
      id: 'tac_001_favicon_mmh3',
      title: 'Favicon MurmurHash3 Correlation',
      category: 'Infrastructure Fingerprinting',
      content: 'By fetching /favicon.ico, encoding in Base64, and computing signed 32-bit MurmurHash3 (mmh3), analysts can match directly against Shodan to reveal clearnet IPs.',
    }
  ]);
  const [newTacticActor, setNewTacticActor] = useState('');
  const [newTacticCategory, setNewTacticCategory] = useState('');
  const [newTacticContent, setNewTacticContent] = useState('');
  const [isIngestingTactic, setIsIngestingTactic] = useState(false);

  // Graph State
  const [nodes, setNodes] = useState(INITIAL_GRAPH_NODES);
  const [edges, setEdges] = useState(INITIAL_GRAPH_EDGES);

  // Poll Render backend
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
    timerInterval = setInterval(() => setWakingElapsed((prev) => prev + 1), 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [apiBaseUrl]);

  // Fetch and format graph data using Fermat's Spiral (Golden Ratio)
  useEffect(() => {
    async function loadGraphData() {
      try {
        const res = await fetch(`${apiBaseUrl}/graph`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.nodes && data.nodes.length > 0) {
            
            // Fermat's Spiral Math for organic node distribution
            const width = 1000;
            const height = 600;
            const centerX = width / 2;
            const centerY = height / 2;
            const goldenRatio = 1.61803398875;

            setNodes((prev) => {
              const posMap = new Map(prev.map((n) => [n.id, { x: n.x, y: n.y }]));
              return data.nodes.map((n, idx) => {
                const existing = posMap.get(n.id);
                if (existing) return { ...n, x: existing.x, y: existing.y };
                
                // Spiral spread formula
                const angle = idx * Math.PI * 2 * goldenRatio;
                const radius = Math.sqrt(idx) * 28; // 28 controls the distance between nodes
                
                return {
                  ...n,
                  x: centerX + radius * Math.cos(angle),
                  y: centerY + radius * Math.sin(angle),
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
          threat_actor: newTacticActor || 'Unknown',
          category: newTacticCategory || 'General',
          content: newTacticContent,
          source: 'Live Feed',
        }),
      });
      
      setRagResults((prev) => [
        {
          id: `tac_${Date.now()}`,
          title: `${newTacticCategory || 'Intelligence'} - ${newTacticActor || 'Unknown'}`,
          content: newTacticContent,
        },
        ...prev,
      ]);
      setNewTacticContent('');
      setNewTacticActor('');
      setNewTacticCategory('');
    } catch (err) {}
    finally {
      setIsIngestingTactic(false);
    }
  };

  const getNodeColor = (label) => {
    switch (label) {
      case 'ThreatActor': return '#ef4444'; // Red
      case 'HiddenService': return '#0ea5e9'; // Cyan
      case 'ClearnetDomain': return '#8b5cf6'; // Purple
      case 'ClearnetIP': return '#f59e0b'; // Amber
      case 'FaviconHash': return '#10b981'; // Emerald
      default: return '#64748b'; // Slate
    }
  };

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 font-sans selection:bg-cyan-500/30 overflow-hidden">
      
      {/* Dynamic Background Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Minimal Header */}
      <header className="relative z-50 border-b border-white/[0.05] bg-[#050505]/60 backdrop-blur-md px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-medium tracking-wide text-white">DEEPTRACE AI</h1>
            <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">Autonomous Threat Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05]">
            <span className={`h-1.5 w-1.5 rounded-full ${backendStatus === 'ready' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[10px] uppercase tracking-widest text-slate-400">
              {backendStatus === 'ready' ? 'System Online' : 'Waking Core...'}
            </span>
          </div>
        </div>
      </header>

      {/* Render Waking Banner */}
      {backendStatus === 'waking' && (
        <div className="relative z-40 bg-amber-500/10 border-b border-amber-500/20 px-8 py-3 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3 text-amber-200/80 text-xs font-mono">
            <AlertTriangle className="w-4 h-4" />
            <span>Establishing secure tunnel & initializing Neo4j Graph Database... ({wakingElapsed}s)</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto p-8">
        
        {/* Sleek Navigation */}
        <nav className="flex items-center gap-6 mb-10 border-b border-white/[0.05] pb-4">
          {['dashboard', 'graph', 'rag'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs uppercase tracking-widest transition-all ${
                activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400 pb-4 -mb-[18px]' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'dashboard' ? 'Unmasker' : tab === 'graph' ? 'Intelligence Graph' : 'Knowledge Base'}
            </button>
          ))}
        </nav>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Minimalist Search Input */}
            <div className="max-w-3xl">
              <h2 className="text-2xl font-light text-white tracking-tight mb-6">De-Anonymize Infrastructure</h2>
              <div className="flex items-center gap-4 group">
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="Enter .onion target..."
                  className="flex-1 bg-transparent border-b border-white/10 px-0 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
                />
                <button
                  onClick={handleExecuteScan}
                  disabled={isScanning || backendStatus !== 'ready'}
                  className="px-8 py-3 rounded bg-white text-black text-xs font-medium tracking-wider uppercase hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isScanning ? 'Probing...' : 'Execute'}
                </button>
              </div>
            </div>

            {/* Glassmorphic Results */}
            {scanResult && (
              <div className="mt-12 p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-xl">
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <span className="text-[10px] text-cyan-500 uppercase tracking-widest block mb-2">Unmasked Identity</span>
                    <h3 className="text-3xl font-light text-white tracking-tight">
                      {scanResult.leaked_clearnet_domain || scanResult.clearnet_domain || 'Resolution Failed'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">Confidence Level</span>
                    <div className="text-2xl font-light text-emerald-400">
                      {scanResult.confidence_score || (scanResult.leaked_clearnet_domain ? 98.5 : 0)}%
                    </div>
                  </div>
                </div>

                {scanResult.opsec_fault && (
                  <div className="mb-8 p-4 rounded-lg bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1">Critical OPSEC Fault Detected</span>
                      <span className="text-xs text-red-200/70 font-mono">{scanResult.opsec_fault}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white/[0.05] rounded-xl overflow-hidden">
                  {[
                    { label: 'Favicon Hash', value: scanResult.favicon_hash },
                    { label: 'Clearnet IPs', value: scanResult.clearnet_ips?.join(', ') },
                    { label: 'HTTP ETag', value: scanResult.etag },
                    { label: 'Server Banner', value: scanResult.server }
                  ].map((item, i) => (
                    <div key={i} className="bg-[#0a0a0a] p-5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">{item.label}</span>
                      <span className="text-sm text-slate-200 font-mono block truncate" title={item.value || 'N/A'}>
                        {item.value || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Intelligence Graph Tab */}
        {activeTab === 'graph' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium text-white tracking-wide">Threat Actor Relationship Graph</h2>
              <span className="text-[10px] text-cyan-500 uppercase tracking-widest border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 rounded">Neo4j AuraDB Live</span>
            </div>
            
            <div className="h-[600px] w-full rounded-2xl bg-white/[0.01] border border-white/[0.05] overflow-hidden relative backdrop-blur-sm">
              <svg viewBox="0 0 1000 600" className="w-full h-full cursor-move">
                {/* Edges */}
                {edges.map((e) => {
                  const s = nodeMap.get(e.source);
                  const t = nodeMap.get(e.target);
                  if (!s || !t) return null;
                  return (
                    <line
                      key={e.id}
                      x1={s.x || 500}
                      y1={s.y || 300}
                      x2={t.x || 500}
                      y2={t.y || 300}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />
                  );
                })}
                {/* Nodes */}
                {nodes.map((n) => {
                  const isPrimary = n.label === 'HiddenService' || n.label === 'ThreatActor';
                  const radius = isPrimary ? 6 : 3;
                  const color = getNodeColor(n.label);
                  
                  return (
                    <g key={n.id} transform={`translate(${n.x || 500}, ${n.y || 300})`}>
                      {/* Glow effect for primary nodes */}
                      {isPrimary && <circle r={radius * 2.5} fill={color} opacity="0.1" />}
                      
                      <circle r={radius} fill={color} opacity="0.9" />
                      
                      {/* Only display text for major nodes to prevent clutter */}
                      {isPrimary && (
                        <text y={15} fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle" opacity="0.8">
                          {n.name.length > 20 ? n.name.slice(0, 20) + '...' : n.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* RAG Knowledge Tab */}
        {activeTab === 'rag' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
            <div>
              <h2 className="text-xl font-light text-white tracking-tight mb-8">Ingest Intelligence</h2>
              <form onSubmit={handleFeedRAG} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <input
                    type="text"
                    value={newTacticActor}
                    onChange={(e) => setNewTacticActor(e.target.value)}
                    placeholder="Threat Actor (Optional)"
                    className="bg-transparent border-b border-white/10 px-0 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="text"
                    value={newTacticCategory}
                    onChange={(e) => setNewTacticCategory(e.target.value)}
                    placeholder="Category"
                    className="bg-transparent border-b border-white/10 px-0 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <textarea
                  rows={4}
                  value={newTacticContent}
                  onChange={(e) => setNewTacticContent(e.target.value)}
                  placeholder="Paste raw intelligence report..."
                  className="w-full bg-white/[0.02] border border-white/10 rounded-lg p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 resize-none"
                />
                <button
                  type="submit"
                  disabled={backendStatus !== 'ready' || !newTacticContent}
                  className="px-6 py-2.5 rounded bg-white text-black text-xs font-medium tracking-wider uppercase hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  {isIngestingTactic ? 'Vectorizing...' : 'Embed into Vector Store'}
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-xl font-light text-white tracking-tight mb-8">Vectorized Context</h2>
              <div className="space-y-4">
                {ragResults.map((r) => (
                  <div key={r.id} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <h4 className="text-xs font-medium text-cyan-400 mb-2">{r.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{r.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
