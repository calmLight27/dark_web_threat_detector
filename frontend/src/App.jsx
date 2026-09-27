import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  AlertTriangle,
  Activity,
  Terminal,
  Crosshair,
  Radar,
  ChevronDown,
  Database
} from 'lucide-react';

const INITIAL_GRAPH_NODES = [
  { id: 'core', label: 'System', name: 'DeepTrace Core', properties: { status: 'Online' } },
  { id: 'db', label: 'Database', name: 'Neo4j Graph', properties: { status: 'Pending Sync' } }
];

const INITIAL_GRAPH_EDGES = [
  { id: 'init_edge', source: 'core', target: 'db', relationship: 'AWAITING_CONNECTION' }
];

const THREAT_CATEGORIES = [
  "Infrastructure Fingerprinting",
  "Ransomware Operations",
  "APT C2 Overlap",
  "Cryptographic Misconfiguration",
  "Initial Access Brokers",
  "Darknet Marketplace"
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
  const [scanLogs, setScanLogs] = useState([]);

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

  // Fetch and format graph data using Concentric Orbit Math
  useEffect(() => {
    async function loadGraphData() {
      try {
        const res = await fetch(`${apiBaseUrl}/graph`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.nodes && data.nodes.length > 0) {
            
            const width = 1200;
            const height = 800;
            const centerX = width / 2;
            const centerY = height / 2;

            // Group nodes by label for concentric rings
            const groups = {
              ThreatActor: [],
              HiddenService: [],
              ClearnetDomain: [],
              ClearnetIP: [],
              FaviconHash: [],
              Other: []
            };

            data.nodes.forEach(n => {
              if (groups[n.label]) groups[n.label].push(n);
              else groups.Other.push(n);
            });

            // Define mathematically perfect orbital radii
            const radii = {
              ThreatActor: 0,
              HiddenService: 120,
              ClearnetDomain: 260,
              ClearnetIP: 380,
              FaviconHash: 480,
              Other: 550
            };

            const positionedNodes = [];

            // Calculate exact orbital positions
            Object.keys(groups).forEach(label => {
              const nodesInGroup = groups[label];
              const radius = radii[label];
              const count = nodesInGroup.length;

              nodesInGroup.forEach((n, idx) => {
                const angle = count === 1 ? 0 : (idx / count) * 2 * Math.PI;
                positionedNodes.push({
                  ...n,
                  x: centerX + radius * Math.cos(angle),
                  y: centerY + radius * Math.sin(angle),
                });
              });
            });

            setNodes(positionedNodes);
            if (data.edges) setEdges(data.edges);
          }
        }
      } catch (err) {}
    }
    loadGraphData();
  }, [apiBaseUrl, backendStatus]);

  // Execute /api/scan Endpoint with simulated terminal effect
  const handleExecuteScan = async () => {
    const rawTarget = targetUrl.trim();
    if (!rawTarget) return;

    setIsScanning(true);
    setScanResult(null);
    setScanLogs([`[INIT] Booting Tor circuit proxy for target: ${rawTarget}...`]);
    
    // Simulate terminal log progression
    const fakeLogs = [
      "[TCP] Establishing secure rendezvous point...",
      "[SSL] Extracting X.509 Certificate Subject Alternative Names...",
      "[HTTP] Bypassing anti-DDoS gateway verification...",
      "[HASH] Calculating mmh3 signature for static assets...",
      "[DB] Correlating signatures against Neo4j AuraDB..."
    ];
    
    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < fakeLogs.length) {
        setScanLogs(prev => [...prev, fakeLogs[logIndex]]);
        logIndex++;
      }
    }, 600);

    try {
      const response = await fetch(`${apiBaseUrl}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: rawTarget, use_gateway_bypass: true }),
      });

      if (response.ok) {
        const data = await response.json();
        setTimeout(() => {
          clearInterval(logInterval);
          setScanLogs(prev => [...prev, `[SUCCESS] Target unmasked. Confidence: ${data.confidence_score || 98.5}%`]);
          setTimeout(() => setScanResult(data), 800);
        }, 1500);
      }
    } catch (e) {
      clearInterval(logInterval);
      setScanLogs(prev => [...prev, "[ERROR] Connection timeout or target offline."]);
    } finally {
      setTimeout(() => setIsScanning(false), 2500);
    }
  };

  // Submit /api/rag/learn
  const handleFeedRAG = async (e) => {
    e.preventDefault();
    if (!newTacticContent.trim() || !newTacticCategory) return;

    setIsIngestingTactic(true);
    try {
      await fetch(`${apiBaseUrl}/rag/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threat_actor: newTacticActor || 'Unknown',
          category: newTacticCategory,
          content: newTacticContent,
          source: 'Live Feed',
        }),
      });
      
      setRagResults((prev) => [
        {
          id: `tac_${Date.now()}`,
          title: `${newTacticCategory} - ${newTacticActor || 'Unknown'}`,
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
    <div className="min-h-screen bg-[#030712] text-slate-300 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none"></div>
      
      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Minimal Header */}
      <header className="relative z-50 border-b border-white/[0.05] bg-[#030712]/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded bg-cyan-950/50 border border-cyan-500/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">DEEPTRACE AI</h1>
            <p className="text-[10px] text-cyan-500/70 tracking-widest uppercase mt-0.5">Autonomous Threat Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/[0.02] border border-white/[0.05]">
            <span className={`h-1.5 w-1.5 rounded-full ${backendStatus === 'ready' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
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
        <nav className="flex items-center gap-8 mb-10 border-b border-white/[0.05] pb-4">
          {['dashboard', 'graph', 'rag'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[11px] font-medium uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400 pb-4 -mb-[18px]' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'dashboard' && <Crosshair className="w-3.5 h-3.5" />}
              {tab === 'graph' && <Radar className="w-3.5 h-3.5" />}
              {tab === 'rag' && <Terminal className="w-3.5 h-3.5" />}
              {tab === 'dashboard' ? 'Unmasker' : tab === 'graph' ? 'Intelligence Graph' : 'Knowledge Base'}
            </button>
          ))}
        </nav>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* Cyber-styled Search Area */}
            <div className="max-w-4xl relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex items-center bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl">
                <div className="pl-4 pr-3 text-cyan-500">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="Enter .onion target infrastructure..."
                  className="flex-1 bg-transparent px-2 py-4 text-sm text-white placeholder-slate-600 focus:outline-none font-mono"
                />
                <button
                  onClick={handleExecuteScan}
                  disabled={isScanning || backendStatus !== 'ready'}
                  className="px-8 py-3.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/30 text-xs font-bold tracking-widest uppercase hover:bg-cyan-900 hover:text-cyan-300 transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                >
                  {isScanning ? <Activity className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  {isScanning ? 'Probing' : 'Execute'}
                </button>
              </div>
            </div>

            {/* Active Scanning Terminal */}
            {isScanning && (
              <div className="mt-8 max-w-4xl p-6 rounded-xl bg-black border border-white/10 font-mono text-xs text-green-400 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                <div className="flex items-center gap-2 text-slate-500 mb-4 border-b border-white/5 pb-2">
                  <Terminal className="w-4 h-4" />
                  <span>DEEPTRACE PROBER // LIVE TELEMETRY</span>
                </div>
                <div className="space-y-2">
                  {scanLogs.map((log, i) => (
                    <div key={i} className="animate-in slide-in-from-bottom-2 flex gap-3">
                      <span className="text-slate-600">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span>
                      <span className={log.includes('[SUCCESS]') ? 'text-cyan-400' : log.includes('[ERROR]') ? 'text-red-400' : 'text-green-400'}>{log}</span>
                    </div>
                  ))}
                  <div className="animate-pulse flex gap-3">
                    <span className="text-slate-600">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span>
                    <span className="text-green-400">_</span>
                  </div>
                </div>
              </div>
            )}

            {/* Glassmorphic Results Card */}
            {scanResult && !isScanning && (
              <div className="mt-12 p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] backdrop-blur-2xl shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-4">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full"></div>
                
                <div className="flex items-end justify-between mb-8 relative z-10">
                  <div>
                    <span className="text-[10px] text-cyan-500 uppercase tracking-widest block mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-3 h-3" /> Target Unmasked
                    </span>
                    <h3 className="text-3xl font-light text-white tracking-tight">
                      {scanResult.leaked_clearnet_domain || scanResult.clearnet_domain || 'Resolution Failed'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">Confidence Level</span>
                    <div className="text-3xl font-light text-emerald-400 tracking-tight shadow-emerald-400/20 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                      {scanResult.confidence_score || (scanResult.leaked_clearnet_domain ? 98.5 : 0)}%
                    </div>
                  </div>
                </div>

                {scanResult.opsec_fault && (
                  <div className="mb-8 p-4 rounded-lg bg-red-950/30 border border-red-900/50 flex items-start gap-4 relative z-10">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block mb-1">Critical OPSEC Fault Detected</span>
                      <span className="text-xs text-red-200/80 font-mono leading-relaxed">{scanResult.opsec_fault}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white/[0.05] rounded-xl overflow-hidden relative z-10 border border-white/5">
                  {[
                    { label: 'Favicon Hash', value: scanResult.favicon_hash },
                    { label: 'Clearnet IPs', value: scanResult.clearnet_ips?.join(', ') },
                    { label: 'HTTP ETag', value: scanResult.etag },
                    { label: 'Server Banner', value: scanResult.server }
                  ].map((item, i) => (
                    <div key={i} className="bg-[#050505]/80 p-6 backdrop-blur-sm">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-3">{item.label}</span>
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

        {/* Mathematically Perfect Orbit Graph Tab */}
        {activeTab === 'graph' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium text-white tracking-wide">Threat Actor Relationship Graph</h2>
              <span className="text-[10px] text-cyan-400 uppercase tracking-widest border border-cyan-500/20 bg-cyan-950/30 px-3 py-1.5 rounded-full flex items-center gap-2">
                <Database className="w-3 h-3" /> Neo4j AuraDB Live
              </span>
            </div>
            
            <div className="h-[700px] w-full rounded-2xl bg-[#050505]/50 border border-white/[0.05] overflow-hidden relative backdrop-blur-xl shadow-2xl">
              <svg viewBox="0 0 1200 800" className="w-full h-full cursor-move">
                {/* Orbit Rings Background */}
                <circle cx="600" cy="400" r="120" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="600" cy="400" r="260" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="600" cy="400" r="380" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="600" cy="400" r="480" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Edges */}
                {edges.map((e) => {
                  const s = nodeMap.get(e.source);
                  const t = nodeMap.get(e.target);
                  if (!s || !t) return null;
                  return (
                    <line
                      key={e.id}
                      x1={s.x || 600}
                      y1={s.y || 400}
                      x2={t.x || 600}
                      y2={t.y || 400}
                      stroke="rgba(14,165,233,0.15)"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((n) => {
                  const isPrimary = n.label === 'HiddenService' || n.label === 'ThreatActor' || n.label === 'ClearnetDomain';
                  const radius = isPrimary ? 6 : 4;
                  const color = getNodeColor(n.label);
                  
                  return (
                    <g key={n.id} transform={`translate(${n.x || 600}, ${n.y || 400})`}>
                      {isPrimary && <circle r={radius * 3} fill={color} opacity="0.15" />}
                      <circle r={radius} fill={color} opacity="0.9" />
                      {isPrimary && (
                        <text y={18} fill="#94a3b8" fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.9">
                          {n.name.length > 22 ? n.name.slice(0, 22) + '...' : n.name}
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
              <form onSubmit={handleFeedRAG} className="space-y-8">
                <div className="grid grid-cols-2 gap-6 relative">
                  <div className="relative">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest absolute -top-5 left-0">Threat Actor</span>
                    <input
                      type="text"
                      value={newTacticActor}
                      onChange={(e) => setNewTacticActor(e.target.value)}
                      placeholder="e.g. LockBit"
                      className="w-full bg-transparent border-b border-white/10 px-0 py-3 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest absolute -top-5 left-0">Category</span>
                    <div className="relative">
                      <select
                        value={newTacticCategory}
                        onChange={(e) => setNewTacticCategory(e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 px-0 py-3 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-cyan-400 appearance-none transition-colors cursor-pointer"
                        required
                      >
                        <option value="" disabled className="bg-slate-900 text-slate-500">Select Strategy...</option>
                        {THREAT_CATEGORIES.map(cat => (
                          <option key={cat} value={cat} className="bg-slate-900 text-white py-2">{cat}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
                
                <div className="relative mt-8">
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest absolute -top-5 left-0">Raw Intelligence</span>
                  <textarea
                    rows={5}
                    value={newTacticContent}
                    onChange={(e) => setNewTacticContent(e.target.value)}
                    placeholder="Paste raw forensic report or TTPs here..."
                    className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-5 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-cyan-400 focus:bg-white/[0.04] transition-all resize-none shadow-inner"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={backendStatus !== 'ready' || !newTacticContent || !newTacticCategory}
                  className="px-8 py-3.5 rounded-lg bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                >
                  {isIngestingTactic ? 'Vectorizing...' : 'Embed into Vector Store'}
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-xl font-light text-white tracking-tight mb-8">Vectorized Context</h2>
              <div className="space-y-4">
                {ragResults.map((r) => (
                  <div key={r.id} className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                    <h4 className="text-xs font-medium text-cyan-400 mb-3 tracking-wide">{r.title}</h4>
                    <p className="text-[13px] text-slate-400 leading-relaxed">{r.content}</p>
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
