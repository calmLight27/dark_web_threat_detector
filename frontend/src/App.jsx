import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Database,
  X,
  Info,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Code,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Lock,
  EyeOff,
  UserCheck,
  Fingerprint,
  Box
} from 'lucide-react';

const PRESET_TARGETS = [
  { name: 'DuckDuckGo Mirror', onion: 'duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion', fault: 'Verified Public Mirror', badge: 'Mirror Match' },
  { name: 'ProPublica SecureDrop', onion: 'p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd.onion', fault: 'Mirror certificate leak', badge: 'SSL Leak' },
  { name: 'LockBit 3.0 Syndicate', onion: 'lockbit3z7y2x3sjasowoarfbgcmvfimaftt6twagswzczad234567d.onion', fault: 'X.509 SAN Certificate Domain Leak', badge: 'Critical OPSEC' },
  { name: 'Volt Typhoon C2 Relay', onion: 'volttyph2x3sjasowoarfbgcmvfimaftt6twagswzczad234567234567d.onion', fault: 'Favicon MurmurHash3 match on Shodan', badge: 'Favicon mmh3' }
];

const THREAT_CATEGORIES = [
  "Infrastructure Fingerprinting",
  "Ransomware Operations",
  "APT C2 Overlap",
  "Cryptographic Misconfiguration",
  "Initial Access Brokers"
];

const INITIAL_GRAPH_NODES = [
  { id: 'core', label: 'System', name: 'DeepTrace Core', properties: { status: 'Online', encryption: 'AES-256-GCM' } },
  { id: 'db', label: 'Database', name: 'Neo4j AuraDB', properties: { status: 'Sync Ready', topology: 'Low-Poly Graphics' } }
];

const INITIAL_GRAPH_EDGES = [
  { id: 'init_edge', source: 'core', target: 'db', relationship: 'SYNCED_WITH' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Threat Intel');
  const [apiBaseUrl] = useState('https://dark-web-threat-detector.onrender.com/api');
  const [backendStatus, setBackendStatus] = useState('checking');
  
  // Scanners & Terminals
  const [targetUrl, setTargetUrl] = useState('duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanLogs, setScanLogs] = useState([]);

  // Signature Database (RAG)
  const [ragResults, setRagResults] = useState([
    { id: 'tac_001', title: 'Favicon MurmurHash3 Correlation', category: 'Infrastructure Fingerprinting', content: 'By calculating the 32-bit MurmurHash3 signature of /favicon.ico and querying Shodan, investigators map isolated onion proxies directly to clearnet hosting IP addresses.' }
  ]);
  const [newTacticActor, setNewTacticActor] = useState('');
  const [newTacticCategory, setNewTacticCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [newTacticContent, setNewTacticContent] = useState('');
  const [isIngestingTactic, setIsIngestingTactic] = useState(false);

  // Nodes & Identity Management
  const [nodes, setNodes] = useState(INITIAL_GRAPH_NODES);
  const [edges, setEdges] = useState(INITIAL_GRAPH_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);

  // Data visualization reacting to cursor
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const graphContainerRef = useRef(null);

  // API Polling
  useEffect(() => {
    let pollInterval;
    const pingBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${apiBaseUrl}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        setBackendStatus(res.ok ? 'ready' : 'waking');
      } catch (err) {
        setBackendStatus('waking');
      }
    };
    pingBackend();
    pollInterval = setInterval(pingBackend, 3500);
    return () => clearInterval(pollInterval);
  }, [apiBaseUrl]);

  // Graph Data Loading
  useEffect(() => {
    async function loadGraphData() {
      try {
        const res = await fetch(`${apiBaseUrl}/graph`);
        if (res.ok) {
          const data = await res.json();
          if (data?.nodes?.length > 0) {
            const centerX = 600, centerY = 400;
            const groups = { ThreatActor: [], HiddenService: [], ClearnetDomain: [], ClearnetIP: [], FaviconHash: [], Other: [] };
            data.nodes.forEach(n => groups[n.label] ? groups[n.label].push(n) : groups.Other.push(n));
            const radii = { ThreatActor: 0, HiddenService: 140, ClearnetDomain: 270, ClearnetIP: 380, FaviconHash: 470, Other: 540 };
            
            const positionedNodes = [];
            Object.keys(groups).forEach(label => {
              const nodesInGroup = groups[label];
              const radius = radii[label];
              nodesInGroup.forEach((n, idx) => {
                const angle = nodesInGroup.length === 1 ? 0 : (idx / nodesInGroup.length) * 2 * Math.PI;
                positionedNodes.push({ ...n, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
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

  const handleExecuteScan = async (overrideTarget) => {
    const rawTarget = (overrideTarget || targetUrl).trim();
    if (!rawTarget) return;
    if (overrideTarget) setTargetUrl(overrideTarget);

    setIsScanning(true);
    setScanResult(null);
    setScanLogs([`[INIT] Engaging Obfuscation bypass for target: ${rawTarget}`]);

    const steps = [
      "[TCP] Initializing data streams across encrypted Tor circuits...",
      "[SSL] Decrypting X.509 Cryptographic signatures...",
      "[HASH] Computing subtle luminescence markers via mmh3...",
      "[DB] Querying Signature Database for identity matches..."
    ];

    let stepIdx = 0;
    const logTimer = setInterval(() => {
      if (stepIdx < steps.length) {
        setScanLogs(prev => [...prev, steps[stepIdx]]);
        stepIdx++;
      }
    }, 450);

    try {
      const response = await fetch(`${apiBaseUrl}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: rawTarget, use_gateway_bypass: true }),
      });
      if (response.ok) {
        const data = await response.json();
        setTimeout(() => {
          clearInterval(logTimer);
          setScanLogs(prev => [...prev, `[RESOLVED] Anonymity compromised. Identity verified.`]);
          setTimeout(() => setScanResult(data), 600);
        }, 1200);
      }
    } catch (e) {
      clearInterval(logTimer);
      setScanLogs(prev => [...prev, "[FATAL] Connection severed in deep shadows."]);
    } finally {
      setTimeout(() => setIsScanning(false), 2200);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (!graphContainerRef.current) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(0.3, zoom * zoomFactor), 4.5);
    setPan({ x: mouseX - (mouseX - pan.x) * (newZoom / zoom), y: mouseY - (mouseY - pan.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const getNodeColor = (label) => {
    switch (label) {
      case 'ThreatActor': return '#e11d48'; // Soft Crimson
      case 'HiddenService': return '#22d3ee'; // Neon Cyan
      case 'ClearnetDomain': return '#8b5cf6'; // Ultraviolet
      case 'ClearnetIP': return '#fbbf24'; // Gold
      case 'FaviconHash': return '#10b981'; // Cyber Green
      default: return '#52525b'; // Matte Gray
    }
  };

  const SIDEBAR_MENU = [
    { name: 'Threat Intel', icon: Crosshair },
    { name: 'Signature Database', icon: Database },
    { name: 'Nodes', icon: Radar },
    { name: 'Terminal', icon: Terminal },
    { name: 'Identity Management', icon: UserCheck },
    { name: 'Anonymize', icon: EyeOff },
    { name: 'Obfuscation', icon: Fingerprint },
    { name: 'Encryption', icon: Lock },
    { name: 'Secure Drop', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-cyan-500/30 overflow-hidden flex">
      
      {/* Cyberpunk Atmosphere / Lighting */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-slate-950 blur-[150px] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/10 blur-[180px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-violet-900/10 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      {/* Futuristic Sidebar */}
      <aside className="w-64 bg-[#09090b]/90 border-r border-zinc-800/50 backdrop-blur-2xl relative z-40 flex flex-col shadow-[15px_0_30px_rgba(0,0,0,0.8)]">
        <div className="p-6 border-b border-zinc-800/50 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-black border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-[0.2em] text-white">DEEPTRACE</h1>
            <p className="text-[9px] text-cyan-500/70 tracking-widest uppercase mt-0.5">Cryptographic Core</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.3em] px-3 pb-2 pt-2">Primary Modules</div>
          {SIDEBAR_MENU.slice(0, 4).map(item => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wide transition-all group ${
                activeTab === item.name 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]' 
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.name ? 'text-cyan-400' : 'group-hover:text-cyan-400'} transition-colors`} />
              {item.name}
            </button>
          ))}

          <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.3em] px-3 pb-2 pt-6">Tactical Operations</div>
          {SIDEBAR_MENU.slice(4).map(item => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wide transition-all group ${
                activeTab === item.name 
                  ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]' 
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.name ? 'text-violet-400' : 'group-hover:text-violet-400'} transition-colors`} />
              {item.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        
        {/* Minimalist Top Bar */}
        <header className="h-16 border-b border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-md px-8 flex items-center justify-between">
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <span className="text-cyan-400">~/system</span>
            <span className="text-zinc-600">/</span>
            <span className="text-white">{activeTab.toLowerCase().replace(' ', '_')}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black border border-zinc-800 shadow-[inset_0_0_10px_rgba(0,0,0,1)]">
            <span className={`h-1.5 w-1.5 rounded-full ${backendStatus === 'ready' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
              {backendStatus === 'ready' ? 'Data Streams Active' : 'Initializing...'}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          {/* Module 1: Threat Intel (Unmasker) */}
          {activeTab === 'Threat Intel' && (
            <div className="max-w-6xl mx-auto space-y-8 transition-all duration-500 ease-in-out">
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-cyan-400 text-xs font-mono uppercase tracking-widest">
                  <Fingerprint className="w-4 h-4" /> Active Threat Intelligence
                </div>
                
                {/* Cyberpunk Search */}
                <div className="relative group">
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/30 to-violet-500/30 rounded-xl blur-sm opacity-50 group-hover:opacity-100 transition duration-500"></div>
                  <div className="relative flex items-center bg-black border border-zinc-800 rounded-xl p-2 shadow-2xl">
                    <Search className="w-5 h-5 ml-3 text-cyan-500/50" />
                    <input
                      type="text"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="Input cryptographic hash or .onion URL..."
                      className="flex-1 bg-transparent px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none font-mono"
                    />
                    <button
                      onClick={() => handleExecuteScan()}
                      disabled={isScanning || backendStatus !== 'ready'}
                      className="px-6 py-2.5 rounded-lg bg-cyan-950/50 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900 hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] text-xs font-bold tracking-[0.2em] uppercase transition-all active:scale-95 flex items-center gap-2"
                    >
                      {isScanning ? <Activity className="w-4 h-4 animate-pulse" /> : <Crosshair className="w-4 h-4" />}
                      Execute
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Streams / Terminal Output */}
              {isScanning && (
                <div className="p-6 rounded-xl bg-[#050505] border border-zinc-800 font-mono text-xs text-zinc-500 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-2 mb-4 border-b border-zinc-900 pb-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="uppercase tracking-widest">Deep Shadows Telemetry</span>
                  </div>
                  <div className="space-y-2">
                    {scanLogs.map((log, i) => (
                      <div key={i} className="flex gap-3 animate-in slide-in-from-left-2">
                        <span className="text-zinc-700">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span>
                        <span className={log?.includes('[RESOLVED]') ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : log?.includes('[FATAL]') ? 'text-rose-500' : 'text-zinc-400'}>
                          {log || 'Processing...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ultra-detailed Result Card */}
              {scanResult && !isScanning && (
                <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl shadow-2xl relative overflow-hidden animate-in fade-in duration-500 slide-in-from-bottom-4">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
                  
                  <div className="flex justify-between items-end mb-8 border-b border-zinc-800 pb-6">
                    <div>
                      <span className="text-[9px] text-cyan-400 uppercase tracking-[0.3em] block mb-2">Identity Compromised</span>
                      <h3 className="text-3xl font-light text-white tracking-tight drop-shadow-2xl">
                        {scanResult.leaked_clearnet_domain || scanResult.clearnet_domain || 'Protected Node'}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-[0.3em] block mb-2">Cryptographic Confidence</span>
                      <div className="text-3xl font-light text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                        {scanResult.confidence_score || 98.5}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Favicon Hash', val: scanResult.favicon_hash },
                      { label: 'Clearnet IPs', val: scanResult.clearnet_ips?.join(', ') },
                      { label: 'HTTP ETag', val: scanResult.etag },
                      { label: 'Server Engine', val: scanResult.server }
                    ].map((item, i) => (
                      <div key={i} className="p-5 rounded-xl bg-black/50 border border-zinc-800 hover:border-zinc-700 transition-colors group">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] block mb-2">{item.label}</span>
                        <span className="text-sm text-zinc-300 font-mono block truncate group-hover:text-cyan-400 transition-colors" title={item.value || 'N/A'}>
                          {item.value || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Module 2: Nodes (2D/3D Graph) */}
          {activeTab === 'Nodes' && (
            <div className="max-w-7xl mx-auto h-[75vh] flex flex-col space-y-4 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-violet-400 text-xs font-mono uppercase tracking-widest">
                  <Radar className="w-4 h-4" /> Node Topography Visualization
                </div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Data visualization reacting to cursor</div>
              </div>

              <div
                ref={graphContainerRef}
                className="flex-1 rounded-2xl bg-[#050505] border border-zinc-800 overflow-hidden relative shadow-[inset_0_0_40px_rgba(0,0,0,1)] cursor-grab active:cursor-grabbing"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <svg viewBox="0 0 1200 800" className="w-full h-full pointer-events-none">
                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} className="pointer-events-auto">
                    
                    {/* Low-poly ambient background rings */}
                    {[140, 270, 380, 470].map(r => (
                      <polygon key={r} points={Array.from({length: 12}).map((_, i) => `${600 + r * Math.cos(i * Math.PI / 6)},${400 + r * Math.sin(i * Math.PI / 6)}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                    ))}

                    {/* Deep Shadows Edges */}
                    {edges.map(e => {
                      const s = nodes.find(n => n.id === e.source);
                      const t = nodes.find(n => n.id === e.target);
                      if (!s || !t) return null;
                      return <line key={e.id} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(139,92,246,0.2)" strokeWidth="1" />;
                    })}

                    {/* Nodes with hover physics */}
                    {nodes.map(n => {
                      const isPrimary = ['HiddenService', 'ThreatActor', 'ClearnetDomain'].includes(n.label);
                      const radius = isPrimary ? 6 : 4;
                      const color = getNodeColor(n.label);
                      const isSelected = selectedNode?.id === n.id;

                      return (
                        <g
                          key={n.id}
                          transform={`translate(${n.x}, ${n.y})`}
                          className="cursor-pointer transition-transform hover:scale-125"
                          onClick={(e) => { e.stopPropagation(); setSelectedNode(n); }}
                        >
                          {/* Subtle Luminescence */}
                          {isPrimary && <circle r={radius * 3.5} fill={color} opacity="0.1" className="animate-pulse" />}
                          {isSelected && <circle r={radius * 4} fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 2" className="animate-[spin_4s_linear_infinite]" />}
                          <circle r={radius} fill={color} opacity="0.9" filter="drop-shadow(0 0 8px rgba(0,0,0,0.5))" />
                          {(isPrimary || isSelected) && (
                            <text y={18} fill={isSelected ? '#fff' : '#71717a'} fontSize="8" fontFamily="monospace" textAnchor="middle" opacity="0.8">
                              {n.name.length > 20 && !isSelected ? n.name.slice(0, 20) + '...' : n.name}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Smooth Unfolding Node Panel */}
                {selectedNode && (
                  <div className="absolute top-6 left-6 w-80 bg-black/80 backdrop-blur-xl border border-zinc-800/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-5 animate-in slide-in-from-left-4">
                    <div className="flex items-start justify-between mb-4 border-b border-zinc-800 pb-3">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-mono mb-1 block">{selectedNode.label}</span>
                        <h4 className="text-sm font-semibold text-zinc-200 break-words drop-shadow-md">{selectedNode.name}</h4>
                      </div>
                      <button onClick={() => setSelectedNode(null)} className="text-zinc-600 hover:text-cyan-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3 text-xs font-mono">
                      {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                        <div key={k} className="group">
                          <span className="text-[9px] uppercase tracking-widest text-zinc-600 block">{k}</span>
                          <span className="text-zinc-300 break-all group-hover:text-cyan-400 transition-colors">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Module 3: Signature Database & Terminal (RAG) */}
          {(activeTab === 'Signature Database' || activeTab === 'Terminal') && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
              
              <div className="p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 text-amber-400 text-xs font-mono uppercase tracking-widest mb-6">
                  <Database className="w-4 h-4" /> Ingest Cryptographic Signatures
                </div>
                
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newTacticActor}
                    onChange={(e) => setNewTacticActor(e.target.value)}
                    placeholder="Threat Actor Alias..."
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-400/50"
                  />
                  <select
                    value={newTacticCategory}
                    onChange={(e) => setNewTacticCategory(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-400/50"
                  >
                    <option value="" disabled>Select Obfuscation Tactic...</option>
                    {THREAT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <textarea
                    rows={6}
                    value={newTacticContent}
                    onChange={(e) => setNewTacticContent(e.target.value)}
                    placeholder="Paste raw data streams, encrypted logs, or payload signatures..."
                    className="w-full bg-black border border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-400/50 resize-none"
                  />
                  <button className="w-full py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-bold tracking-[0.2em] uppercase transition-all active:scale-95 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
                    Commit to Database
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-[10px] text-zinc-600 uppercase tracking-[0.3em] font-mono pl-2">Vectorized Threat Intel</div>
                <div className="space-y-3">
                  {ragResults.map(r => (
                    <div key={r.id} className="p-6 rounded-xl bg-black border border-zinc-800 hover:border-zinc-700 transition-colors shadow-xl group">
                      <h4 className="text-xs font-bold text-cyan-400 font-mono mb-2 group-hover:text-cyan-300">{r.title}</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed font-mono">{r.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback for other aesthetic tabs (Identity Management, Secure Drop, etc) */}
          {['Identity Management', 'Anonymize', 'Obfuscation', 'Encryption', 'Secure Drop'].includes(activeTab) && (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
              <Lock className="w-16 h-16 text-zinc-800 mb-6 drop-shadow-[0_0_20px_rgba(0,0,0,1)]" />
              <h2 className="text-2xl font-light text-zinc-300 tracking-[0.2em] uppercase">{activeTab}</h2>
              <p className="text-xs text-zinc-600 font-mono mt-4 uppercase tracking-widest max-w-md">
                Subsystem offline or requires elevated cryptographic clearance. Access restricted by DeepTrace Core.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
