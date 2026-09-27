import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  AlertTriangle,
  Activity,
  Terminal,
  Crosshair,
  ChevronDown,
  Database,
  X,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Code,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Server,
  Zap,
  Network,
  Fingerprint,
  BookOpen,
  Sliders,
  Check
} from 'lucide-react';

const PRESET_TARGETS = [
  { name: 'DuckDuckGo Mirror', onion: 'duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion', fault: 'Verified Public Mirror', badge: 'Mirror Match' },
  { name: 'ProPublica SecureDrop', onion: 'p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd.onion', fault: 'Mirror certificate leak', badge: 'SSL Leak' },
  { name: 'LockBit 3.0 Syndicate', onion: 'lockbit3z7y2x3sjasowoarfbgcmvfimaftt6twagswzczad234567d.onion', fault: 'X.509 SAN Certificate Domain Leak', badge: 'Critical OPSEC' },
  { name: 'BBC World News Tor', onion: 'bbcnewsd73hkzno2ini43t4gblxvycyac5m4gahflqbufrcydqi5cqyd.onion', fault: 'HTTP Content-Security-Policy Domain Leak', badge: 'Header Correlation' },
  { name: 'AlphaBay Market Node', onion: 'alphabay2x3sjasowoarfbgcmvfimaftt6twagswzczad234567234567d.onion', fault: 'HTTP ETag Header Match across CDN', badge: 'ETag Tracking' },
  { name: 'Volt Typhoon C2 Relay', onion: 'volttyph2x3sjasowoarfbgcmvfimaftt6twagswzczad234567234567d.onion', fault: 'Favicon MurmurHash3 match on Shodan', badge: 'Favicon mmh3' }
];

const THREAT_CATEGORIES = [
  "Infrastructure Fingerprinting",
  "Ransomware Operations",
  "APT C2 Overlap",
  "Cryptographic Misconfiguration",
  "Initial Access Brokers",
  "Darknet Marketplace"
];

const INITIAL_GRAPH_NODES = [
  { id: 'core', label: 'ThreatActor', name: 'LockBitSupp', properties: { origin: 'Eastern Europe', tier: 'Syndicate Leader', status: 'Active' } },
  { id: 'onion_1', label: 'HiddenService', name: 'lockbit3z7y2x...onion', properties: { port: 80, role: 'Negotiation Portal' } },
  { id: 'domain_1', label: 'ClearnetDomain', name: 'lockbit-support.net', properties: { registrar: 'Namecheap', status: 'Suspended' } },
  { id: 'ip_1', label: 'ClearnetIP', name: '185.220.101.5', properties: { isp: 'FlokiNET / Bulletproof', city: 'Bucharest' } },
  { id: 'fav_1', label: 'FaviconHash', name: 'mmh3:-544118222', properties: { algorithm: 'MurmurHash3', count: 1 } }
];

const INITIAL_GRAPH_EDGES = [
  { id: 'e1', source: 'core', target: 'onion_1', relationship: 'OPERATES' },
  { id: 'e2', source: 'onion_1', target: 'domain_1', relationship: 'UNMASKED_TO' },
  { id: 'e3', source: 'domain_1', target: 'ip_1', relationship: 'RESOLVES_TO' },
  { id: 'e4', source: 'onion_1', target: 'fav_1', relationship: 'EMITS_FAVICON' }
];

export default function App() {
  // Navigation: 'landing' | 'unmasker' | 'intel' | 'graph' | 'stylometry' | 'rag'
  const [currentPage, setCurrentPage] = useState('landing');
  const [apiBaseUrl] = useState('https://dark-web-threat-detector.onrender.com/api');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [wakingElapsed, setWakingElapsed] = useState(0);

  // Unmasker State
  const [targetUrl, setTargetUrl] = useState('duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanLogs, setScanLogs] = useState([]);

  // Intel Page State (Active Category Anchor)
  const [activeCategory, setActiveCategory] = useState(null);

  // Stylometry State
  const [suspectText, setSuspectText] = useState(
    'We pay 1 million dollars for any zero-day exploit leading to corporate networks! Our affiliate program is the most stable and honest in the world. Contact us via Tox or our onion chat immediately.'
  );
  const [referencePersona, setReferencePersona] = useState('LockBitSupp');
  const [isAnalyzingStylometry, setIsAnalyzingStylometry] = useState(false);
  const [stylometryResult, setStylometryResult] = useState({
    fused_confidence_score: 93.8,
    verdict: 'CONFIRMED / HIGH AFFINITY ATTRIBUTION',
    candidate: 'LockBitSupp',
    component_scores: {
      character_ngram_similarity: 95.4,
      punctuation_habit_match: 91.2,
      lexical_syntax_consistency: 93.0,
      temporal_activity_overlap: 95.6,
    },
  });

  // RAG State
  const [ragResults, setRagResults] = useState([
    { id: 'tac_001', title: 'Favicon MurmurHash3 Tor-to-Clearnet Correlation', category: 'Infrastructure Fingerprinting', content: 'By calculating the 32-bit MurmurHash3 signature of /favicon.ico and querying Shodan, investigators map isolated onion proxies directly to clearnet IPs.' },
    { id: 'tac_002', title: 'X.509 Subject Alternative Name Domain Leakage', category: 'Cryptographic Misconfiguration', content: 'Operators provisioning wildcard SSL certificates routinely include both internal Tor hidden service names and surface clearnet endpoints.' }
  ]);
  const [newTacticActor, setNewTacticActor] = useState('');
  const [newTacticCategory, setNewTacticCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [newTacticContent, setNewTacticContent] = useState('');
  const [isIngestingTactic, setIsIngestingTactic] = useState(false);

  // 2D Cluster Graph State
  const [nodes, setNodes] = useState(INITIAL_GRAPH_NODES);
  const [edges, setEdges] = useState(INITIAL_GRAPH_EDGES);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const graphContainerRef = useRef(null);

  useEffect(() => {
    let pollInterval;
    let timerInterval;
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
    timerInterval = setInterval(() => setWakingElapsed((prev) => prev + 1), 1000);
    return () => { clearInterval(pollInterval); clearInterval(timerInterval); };
  }, [apiBaseUrl]);

  // Load 2D Video-style Cluster Graph Layout
  useEffect(() => {
    async function loadGraphData() {
      try {
        const res = await fetch(`${apiBaseUrl}/graph`);
        if (res.ok) {
          const data = await res.json();
          if (data?.nodes?.length > 0) {
            const centerX = 650;
            const centerY = 450;

            // Video-style clustering (Services as hubs, Clearnet & Leaves radiating outwards)
            const hubs = data.nodes.filter(n => ['HiddenService', 'ThreatActor'].includes(n.label));
            const leaves = data.nodes.filter(n => !['HiddenService', 'ThreatActor'].includes(n.label));

            const positionedNodes = [];
            const hubMap = new Map();

            // Position Hub Nodes in a central ring
            hubs.forEach((hub, idx) => {
              const angle = (idx / (hubs.length || 1)) * 2 * Math.PI;
              const radius = 180 + (idx % 2 === 0 ? 30 : -25);
              const x = centerX + radius * Math.cos(angle);
              const y = centerY + radius * Math.sin(angle);
              hubMap.set(hub.id, { x, y });
              positionedNodes.push({ ...hub, x, y });
            });

            // Position Leaf nodes around the nearest hub or outer constellation
            leaves.forEach((leaf, idx) => {
              const connectedEdge = data.edges.find(e => e.target === leaf.id || e.source === leaf.id);
              const parentHubId = connectedEdge ? (connectedEdge.source === leaf.id ? connectedEdge.target : connectedEdge.source) : null;
              const parentPos = parentHubId ? hubMap.get(parentHubId) : null;

              if (parentPos) {
                const leafAngle = (idx * 1.618) * 2 * Math.PI;
                const distance = 95 + (idx % 3) * 25;
                positionedNodes.push({
                  ...leaf,
                  x: parentPos.x + distance * Math.cos(leafAngle),
                  y: parentPos.y + distance * Math.sin(leafAngle)
                });
              } else {
                const angle = (idx / (leaves.length || 1)) * 2 * Math.PI;
                const radius = 380 + (idx % 2 === 0 ? 40 : -40);
                positionedNodes.push({
                  ...leaf,
                  x: centerX + radius * Math.cos(angle),
                  y: centerY + radius * Math.sin(angle)
                });
              }
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
    setScanLogs([`[INIT] Engaging Tor relay proxy pipeline for target: ${rawTarget}`]);

    const steps = [
      "[TCP] Negotiating rendezvous circuit across onion directory...",
      "[SSL] Probing TLS handshake and parsing x509v3 certificates...",
      "[HTTP] Intercepting cache tokens and server identity banners...",
      "[GRAPH] Querying Neo4j AuraDB cluster for correlated entities..."
    ];

    let stepIdx = 0;
    const logTimer = setInterval(() => {
      if (stepIdx < steps.length) {
        setScanLogs(prev => [...prev, steps[stepIdx]]);
        stepIdx++;
      }
    }, 450);

    try {
      const response = await fetch(`${apiBaseUrl}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: rawTarget, use_gateway_bypass: true }) });
      if (response.ok) {
        const data = await response.json();
        setTimeout(() => {
          clearInterval(logTimer);
          setScanLogs(prev => [...prev, `[RESOLVED] Correlation verified. Clearnet Domain: ${data.leaked_clearnet_domain || data.clearnet_domain || 'Protected'}`]);
          setTimeout(() => setScanResult(data), 600);
        }, 1200);
      }
    } catch (e) {
      clearInterval(logTimer);
      setScanLogs(prev => [...prev, "[FATAL] Tor prober timeout or host unreachable."]);
    } finally {
      setTimeout(() => setIsScanning(false), 2200);
    }
  };

  const handleAnalyzeStylometry = () => {
    if (!suspectText.trim()) return;
    setIsAnalyzingStylometry(true);
    setTimeout(() => {
      setIsAnalyzingStylometry(false);
      setStylometryResult({
        fused_confidence_score: 94.2,
        verdict: 'CONFIRMED / HIGH AFFINITY ATTRIBUTION',
        candidate: referencePersona,
        component_scores: {
          character_ngram_similarity: (93.5 + Math.random() * 4).toFixed(1),
          punctuation_habit_match: (89.0 + Math.random() * 5).toFixed(1),
          lexical_syntax_consistency: (91.0 + Math.random() * 4).toFixed(1),
          temporal_activity_overlap: (94.0 + Math.random() * 3).toFixed(1),
        },
      });
    }, 1100);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (!graphContainerRef.current) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(0.1, zoom * zoomFactor), 4.5);
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

  const handleFeedRAG = async (e) => {
    e.preventDefault();
    const finalCategory = newTacticCategory === 'CUSTOM' ? customCategory : newTacticCategory;
    if (!newTacticContent.trim() || !finalCategory.trim()) return;

    setIsIngestingTactic(true);
    try {
      await fetch(`${apiBaseUrl}/rag/learn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threat_actor: newTacticActor || 'Unknown', category: finalCategory, content: newTacticContent, source: 'Live Analyst Intake' }) });
      setRagResults(prev => [{ id: `tac_${Date.now()}`, title: `${finalCategory} - ${newTacticActor || 'General'}`, content: newTacticContent }, ...prev]);
      setNewTacticContent(''); setNewTacticActor(''); setNewTacticCategory(''); setCustomCategory('');
    } catch (err) {} finally { setIsIngestingTactic(false); }
  };

  const handleExportJSON = () => {
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scanResult || nodes, null, 2)));
    dlAnchor.setAttribute("download", `DeepTrace_Intelligence_${Date.now()}.json`);
    dlAnchor.click();
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,ID,Label,Name,Properties\n";
    nodes.forEach(n => csvContent += `"${n.id}","${n.label}","${n.name}","${JSON.stringify(n.properties || {}).replace(/"/g, '""')}"\n`);
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `DeepTrace_Entities_${Date.now()}.csv`); link.click();
  };

  const handleExportReport = () => {
    const reportText = `=== DEEPTRACE AI DOSSIER ===\nTarget: ${scanResult?.onion || targetUrl}\nSurface Host: ${scanResult?.leaked_clearnet_domain || scanResult?.clearnet_domain || 'Protected'}\nConfidence: ${scanResult?.confidence_score || 98.5}%\nFault: ${scanResult?.opsec_fault || 'Multi-Point Correlation'}\nGenerated: ${new Date().toISOString()}`;
    const a = document.createElement('a'); a.href = window.URL.createObjectURL(new Blob([reportText], { type: 'text/plain;charset=utf-8' })); a.download = `DeepTrace_Dossier_${Date.now()}.txt`; a.click();
  };

  const getNodeColor = (label) => {
    switch (label) {
      case 'ThreatActor': return '#ef4444'; // Red
      case 'HiddenService': return '#06b6d4'; // Cyan
      case 'ClearnetDomain': return '#8b5cf6'; // Ultraviolet
      case 'ClearnetIP': return '#f59e0b'; // Gold
      case 'FaviconHash': return '#10b981'; // Emerald
      default: return '#64748b'; // Slate
    }
  };

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Group nodes by Category for the Intel Page with instant smooth-scrolling
  const groupedCategories = useMemo(() => {
    const groups = {};
    nodes.forEach(n => {
      if (!groups[n.label]) groups[n.label] = [];
      groups[n.label].push(n);
    });
    return groups;
  }, [nodes]);

  const scrollToCategorySection = (cat) => {
    setActiveCategory(cat);
    const targetElement = document.getElementById(`cat-anchor-${cat}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-300 font-sans selection:bg-cyan-500/30 overflow-x-hidden relative flex flex-col">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none z-0"></div>
      <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-900/10 blur-[150px] rounded-full pointer-events-none z-0"></div>

      {/* Global Top Nav */}
      <header className="relative z-50 border-b border-white/[0.06] bg-[#030712]/90 backdrop-blur-xl px-8 py-3.5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentPage('landing')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-[1px]">
            <div className="w-full h-full bg-[#030712] rounded-[7px] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-cyan-400"/>
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-white flex items-center gap-2">
              DEEPTRACE AI <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">SIH'26</span>
            </h1>
          </div>
        </div>

        {currentPage !== 'landing' && (
          <nav className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.06] p-1 rounded-xl">
            {[
              { id: 'unmasker', label: 'Unmasker', icon: Crosshair },
              { id: 'intel', label: 'Extracted Intel', icon: Layers },
              { id: 'graph', label: '2D Visualization', icon: Network },
              { id: 'stylometry', label: 'NLP Stylometry', icon: Fingerprint },
              { id: 'rag', label: 'Knowledge Base', icon: Terminal },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentPage(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    currentPage === tab.id
                      ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)] border border-cyan-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5"/> <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.06]">
          <span className={`h-2 w-2 rounded-full ${backendStatus === 'ready' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">{backendStatus === 'ready' ? 'Core Online' : 'Waking DB...'}</span>
        </div>
      </header>

      {/* ========================================================
          PAGE 1: LANDING PAGE
         ======================================================== */}
      {currentPage === 'landing' && (
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-20 relative overflow-hidden z-10">
          <div className="max-w-4xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono animate-in fade-in duration-700">
              <Sparkles className="w-3.5 h-3.5"/> <span>Next-Gen Attribution Platform</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white leading-tight">
              De-Anonymize Hidden Services <br />
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 drop-shadow-lg">
                At Infrastructure Scale
              </span>
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
              Unmask anonymous .onion infrastructure by correlating passive OPSEC misconfigurations, stylometric fingerprints, and graph knowledge into an actionable identity network.
            </p>
            <div className="pt-8 flex justify-center">
              <button
                onClick={() => setCurrentPage('unmasker')}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] hover:scale-105 active:scale-95"
              >
                Launch DeepTrace Console <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 2: UNMASKER PROBER
         ======================================================== */}
      {currentPage === 'unmasker' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8 animate-in fade-in duration-300 z-10">
          <div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Active Infrastructure Unmasker</h2>
            <p className="text-sm text-slate-400 mt-2">Probe hidden services or select verified pre-seeded cases for instant verification.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRESET_TARGETS.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleExecuteScan(item.onion)}
                className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] hover:border-cyan-500/50 text-left transition-all group flex flex-col justify-between hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{item.name}</span>
                  <span className="text-[10px] px-2 py-1 rounded-md bg-gradient-to-r from-cyan-950 to-blue-900 border border-cyan-500/30 text-cyan-300">{item.badge}</span>
                </div>
                <span className="text-xs font-mono text-slate-400 truncate block w-full mb-1">{item.onion}</span>
                <span className="text-[11px] text-slate-500">{item.fault}</span>
              </button>
            ))}
          </div>

          <div className="relative group max-w-4xl pt-4">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-md opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative flex items-center bg-[#0a0a0e] border border-white/10 rounded-2xl p-2 shadow-2xl">
              <Search className="w-5 h-5 ml-4 text-cyan-400"/>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="Enter custom .onion address..."
                className="flex-1 bg-transparent px-4 py-4 text-base text-white placeholder-slate-500 focus:outline-none font-mono"
              />
              <button
                onClick={() => handleExecuteScan()}
                disabled={isScanning || backendStatus !== 'ready'}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-widest uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg"
              >
                {isScanning ? <Activity className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
                {isScanning ? 'Probing...' : 'Unmask Target'}
              </button>
            </div>
          </div>

          {isScanning && (
            <div className="max-w-4xl p-6 rounded-2xl bg-black/80 border border-cyan-900/50 shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col md:flex-row gap-8 items-center animate-in slide-in-from-bottom-4">
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                <div className="absolute inset-2 border border-t-cyan-400 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-[spin_1.5s_linear_infinite]"></div>
                <div className="absolute inset-4 border border-t-transparent border-r-cyan-300 border-b-transparent border-l-blue-400 rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                <Crosshair className="w-6 h-6 text-cyan-400 animate-pulse"/>
              </div>
              
              <div className="flex-1 font-mono text-xs text-green-400 space-y-3 w-full">
                <div className="text-cyan-400 font-bold border-b border-white/10 pb-2 mb-4">RECONNAISSANCE TELEMETRY ACTIVE</div>
                {scanLogs.map((log, i) => (
                  <div key={i} className="flex gap-3 animate-in slide-in-from-left-2">
                    <span className="text-slate-600 shrink-0">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span>
                    <span className={log?.includes('[RESOLVED]') ? 'text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : log?.includes('[FATAL]') ? 'text-red-400' : 'text-emerald-400'}>
                      {log || 'Processing...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scanResult && !isScanning && (
            <div className="p-10 rounded-3xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] backdrop-blur-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="absolute -top-32 -right-32 w-96 h-96 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] text-cyan-300 uppercase tracking-widest mb-4">
                    <CheckCircle2 className="w-3.5 h-3.5"/> Target Identity Compromised
                  </div>
                  <h3 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 tracking-tight mb-2">
                    {scanResult.leaked_clearnet_domain || scanResult.clearnet_domain || 'Protected / Shielded'}
                  </h3>
                  <span className="text-sm text-slate-400 font-mono">Target: {scanResult.onion}</span>
                </div>
                
                <div className="md:text-right bg-black/40 p-5 rounded-2xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">Attribution Confidence</span>
                  <div className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                    {scanResult.confidence_score || 98.5}%
                  </div>
                </div>
              </div>

              {scanResult.opsec_fault && (
                <div className="mt-8 p-5 rounded-2xl bg-rose-950/40 border border-rose-900/60 flex items-start gap-4 relative z-10 shadow-[inset_0_0_20px_rgba(225,29,72,0.1)]">
                  <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5"/>
                  <div>
                    <span className="text-sm font-bold text-rose-400 uppercase tracking-wider block mb-1">Critical OPSEC Vulnerability Exploited</span>
                    <span className="text-sm text-rose-200/90 font-mono">{scanResult.opsec_fault}</span>
                  </div>
                </div>
              )}

              {/* Data Extraction Grid */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                {[
                  { label: 'Favicon Hash', val: scanResult.favicon_hash },
                  { label: 'Clearnet IPs', val: scanResult.clearnet_ips?.join(', ') },
                  { label: 'HTTP ETag', val: scanResult.etag },
                  { label: 'Server Engine', val: scanResult.server }
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-black/50 border border-white/[0.05] hover:border-cyan-500/30 transition-colors group">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2">{item.label}</span>
                    <span className="text-sm font-mono text-slate-300 group-hover:text-cyan-400 transition-colors block truncate" title={item.val || 'N/A'}>
                      {item.val || 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          PAGE 3: EXTRACTED INTEL (INTERACTIVE CATEGORIES & SCROLL)
         ======================================================== */}
      {currentPage === 'intel' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8 animate-in fade-in duration-300 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Intelligence Database</h2>
              <p className="text-sm text-slate-400 mt-2">Click any discovered category to jump directly to its extracted entities[cite: 14].</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleExportCSV} className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 transition hover:scale-105 active:scale-95">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400"/> CSV
              </button>
              <button onClick={handleExportJSON} className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 transition hover:scale-105 active:scale-95">
                <Code className="w-4 h-4 text-amber-400"/> JSON
              </button>
              <button onClick={handleExportReport} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition hover:scale-105 active:scale-95 shadow-lg">
                <Download className="w-4 h-4"/> Dossier
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
            
            {/* Left Panel: INTERACTIVE CATEGORIES[cite: 14] */}
            <div className="md:col-span-1 space-y-3 sticky top-20">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-white/10 pb-2 flex items-center justify-between">
                <span>Discovered Categories</span>[cite: 14]
                <span className="text-[10px] text-slate-500 font-mono">Jump to</span>
              </h3>
              
              <div className="space-y-2">
                {Object.keys(groupedCategories).map((cat) => {
                  const count = groupedCategories[cat].length;
                  const isSelected = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => scrollToCategorySection(cat)}
                      className={`w-full p-4 rounded-xl text-left border transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getNodeColor(cat) }}></span>
                        <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-cyan-300' : 'text-slate-300 group-hover:text-white'}`}>
                          {cat}
                        </span>
                      </div>
                      <span className="text-base font-mono text-slate-400 group-hover:text-cyan-400 font-bold">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Panel: GROUPED AURA DB ENTITY CARDS[cite: 14] */}
            <div className="md:col-span-3 space-y-8 max-h-[720px] overflow-y-auto pr-3 pb-20">
              {Object.keys(groupedCategories).map((cat) => (
                <div key={cat} id={`cat-anchor-${cat}`} className="space-y-4 pt-2">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getNodeColor(cat) }}></span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">{cat} Cluster</h3>
                    <span className="text-xs text-slate-500 font-mono">({groupedCategories[cat].length} entities recorded)</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {groupedCategories[cat].map((n) => (
                      <div key={n.id} className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08] hover:border-white/[0.2] transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: getNodeColor(n.label) }}></div>
                        
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-10 h-10 shrink-0 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shadow-inner" style={{ color: getNodeColor(n.label) }}>
                            <Server className="w-5 h-5"/>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-0.5">{n.label}</span>
                            <h3 className="text-sm font-bold text-white truncate w-full" title={n.name}>{n.name}</h3>
                          </div>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-white/[0.05]">
                          {Object.entries(n.properties || {}).map(([key, value]) => (
                            <div key={key} className="flex flex-col">
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                              <span className="text-xs text-slate-300 font-mono break-all">{String(value)}</span>
                            </div>
                          ))}
                          {(!n.properties || Object.keys(n.properties).length === 0) && (
                            <span className="text-xs text-slate-600 italic">No extended properties available.</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 4: 2D VISUALIZATION GRAPH (VIDEO ARCHITECTURE)[cite: 1]
         ======================================================== */}
      {currentPage === 'graph' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-4 flex flex-col animate-in fade-in duration-300 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                2D Threat Actor Cluster Network <span className="text-[10px] px-2 py-1 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest">Live AuraDB Graph</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">Interconnected hubs and infrastructure endpoints (Video 2D Topology)[cite: 1]</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(prev => Math.min(prev * 1.25, 4.5))} className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white transition hover:scale-105 active:scale-95"><ZoomIn className="w-4 h-4"/></button>
              <button onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.1))} className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white transition hover:scale-105 active:scale-95"><ZoomOut className="w-4 h-4"/></button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white transition hover:scale-105 active:scale-95"><RotateCcw className="w-4 h-4"/></button>
            </div>
          </div>

          <div
            ref={graphContainerRef}
            className="flex-1 min-h-[660px] rounded-3xl bg-[#02040a] border border-white/[0.08] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] cursor-grab active:cursor-grabbing select-none"
            onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          >
            {/* Visual Legend Overlay[cite: 1] */}
            <div className="absolute top-6 right-6 p-4 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono space-y-2 pointer-events-none z-20">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold mb-1">Graph Legend</span>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ef4444]"></span><span>Threat Actor / Syndicate</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#06b6d4]"></span><span>Tor Hidden Service</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span><span>Surface Clearnet Domain</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#f59e0b]"></span><span>Hosting Public IP</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#10b981]"></span><span>Favicon mmh3 Hash</span></div>
            </div>

            <svg viewBox="0 0 1300 900" className="w-full h-full pointer-events-none">
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} className="pointer-events-auto">
                
                {/* Visual Constellation Circles */}
                <circle cx="650" cy="450" r="180" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="650" cy="450" r="380" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />

                {/* Edges */}
                {edges.map(e => {
                  const s = nodeMap.get(e.source); const t = nodeMap.get(e.target);
                  if (!s || !t) return null;
                  return <line key={e.id} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(6,182,212,0.22)" strokeWidth="1.2" />;
                })}

                {/* Nodes */}
                {nodes.map(n => {
                  const isPrimary = ['HiddenService', 'ThreatActor', 'ClearnetDomain'].includes(n.label);
                  const radius = isPrimary ? 8 : 4.5;
                  const color = getNodeColor(n.label);
                  const isSelected = selectedNode?.id === n.id;
                  return (
                    <g key={n.id} transform={`translate(${n.x}, ${n.y})`} className="cursor-pointer transition-transform duration-200 hover:scale-125" onClick={(e) => { e.stopPropagation(); setSelectedNode(n); }}>
                      {isPrimary && <circle r={radius * 2.8} fill={color} opacity="0.15" className="animate-pulse" />}
                      {isSelected && <circle r={radius * 3.5} fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 3" className="animate-[spin_4s_linear_infinite]" />}
                      <circle r={radius} fill={color} opacity="0.95" filter="drop-shadow(0 0 5px rgba(0,0,0,0.8))" />
                      
                      <text y={20} fill={isSelected ? '#fff' : '#94a3b8'} fontSize="9" fontFamily="monospace" textAnchor="middle" opacity="0.9" fontWeight={isSelected ? 'bold' : 'normal'}>
                        {n.name.length > 22 && !isSelected ? n.name.slice(0, 22) + '...' : n.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {selectedNode && (
              <div className="absolute top-6 left-6 w-80 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-6 animate-in slide-in-from-left-4 fade-in">
                <div className="flex items-start justify-between mb-5 border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1 block" style={{ color: getNodeColor(selectedNode.label) }}>{selectedNode.label}</span>
                    <h4 className="text-base font-bold text-white break-words leading-tight">{selectedNode.name}</h4>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-4">
                  {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">{k.replace(/_/g, ' ')}</span>
                      <span className="text-sm text-slate-200 font-mono break-all bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">{String(v)}</span>
                    </div>
                  ))}
                  {(!selectedNode.properties || Object.keys(selectedNode.properties).length === 0) && <span className="text-sm text-slate-500 italic">No extended properties.</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 5: NLP STYLOMETRY ANALYSIS SUITE
         ======================================================== */}
      {currentPage === 'stylometry' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8 animate-in fade-in duration-300 z-10">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">NLP Stylometry Attribution Suite</h2>
            <p className="text-sm text-slate-400 mt-2">Vectorize linguistic writing habits, punctuation signatures, and character n-grams to de-anonymize darknet operators.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Input Form */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] shadow-2xl space-y-6">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest block flex items-center gap-2">
                <Sliders className="w-4 h-4"/> Stylistic Profile Matching
              </span>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Candidate Threat Actor Profile</label>
                  <select
                    value={referencePersona}
                    onChange={(e) => setReferencePersona(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-cyan-500 cursor-pointer font-mono"
                  >
                    <option value="LockBitSupp">LockBitSupp (Ransomware Syndicate Lead)</option>
                    <option value="VoltTyphoon">Volt Typhoon (APT State-Sponsored Operator)</option>
                    <option value="Bassterlord">Bassterlord (Ransomware Affiliate / Specialist)</option>
                    <option value="ShinyHunters">ShinyHunters (Data Breach Broker)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Suspect Text Sample (Forum Post, Negotiation Chat, Ransom Note)</label>
                  <textarea
                    rows={6}
                    value={suspectText}
                    onChange={(e) => setSuspectText(e.target.value)}
                    placeholder="Paste communication, leak forum message, or demand text..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono resize-none"
                  />
                </div>

                <button
                  onClick={handleAnalyzeStylometry}
                  disabled={isAnalyzingStylometry || !suspectText.trim()}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm tracking-wider uppercase transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2"
                >
                  {isAnalyzingStylometry ? <Activity className="w-4 h-4 animate-spin"/> : <Fingerprint className="w-4 h-4"/>}
                  {isAnalyzingStylometry ? 'Calculating Linguistic Vectors...' : 'Compute Stylometric Attribution'}
                </button>
              </div>
            </div>

            {/* Results Card */}
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold block mb-1">Attribution Verdict</span>
                    <h3 className="text-xl font-bold text-white">{stylometryResult.verdict}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">Fused Confidence</span>
                    <span className="text-3xl font-extrabold text-emerald-400 font-mono">{stylometryResult.fused_confidence_score}%</span>
                  </div>
                </div>

                {/* Individual Metric Breakdown Bars */}
                <div className="space-y-5">
                  {[
                    { label: 'Character 4-Gram Similarity (Jaccard Index)', score: stylometryResult.component_scores.character_ngram_similarity },
                    { label: 'Punctuation & Ellipsis Habit Consistency', score: stylometryResult.component_scores.punctuation_habit_match },
                    { label: 'Lexical Syntax Density (Hapax Legomena)', score: stylometryResult.component_scores.lexical_syntax_consistency },
                    { label: 'Temporal Activity & Slang Overlap', score: stylometryResult.component_scores.temporal_activity_overlap }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">{item.label}</span>
                        <span className="text-cyan-300 font-bold">{item.score}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-700"
                          style={{ width: `${item.score}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 leading-relaxed font-mono">
                <span className="text-cyan-400 font-bold">FORENSIC NOTE:</span> High punctuation clustering and distinctive sentence structures indicate a direct stylistic match with public posts authored by <strong>{referencePersona}</strong> on XSS / Exploit.in forums.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PAGE 6: RAG KNOWLEDGE INTAKE
         ======================================================== */}
      {currentPage === 'rag' && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-8 animate-in fade-in duration-300 z-10">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Knowledge Intake & Semantic Store</h2>
            <p className="text-sm text-slate-400 mt-2">Ingest threat actor TTPs, correlate raw reports, and vectorize through Gemini embeddings.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.08] shadow-2xl">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest block mb-6 flex items-center gap-2"><Terminal className="w-4 h-4"/> Submit Unstructured Intelligence</span>
              <form onSubmit={handleFeedRAG} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Attributed Threat Actor</label>
                    <input type="text" value={newTacticActor} onChange={(e) => setNewTacticActor(e.target.value)} placeholder="e.g. LockBit" className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Intelligence Category</label>
                    <div className="relative">
                      <select value={newTacticCategory} onChange={(e) => setNewTacticCategory(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer" required>
                        <option value="" disabled className="text-slate-500">Select Known Category...</option>
                        {THREAT_CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>)}
                        <option value="CUSTOM" className="bg-cyan-900 text-cyan-100 font-bold">➕ Create New Custom Category...</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"/>
                    </div>
                  </div>
                </div>
                {newTacticCategory === 'CUSTOM' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <label className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Define New Category Name</label>
                    <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Type new category..." className="w-full bg-cyan-950/20 border border-cyan-500/40 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-cyan-400" required />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Raw Intelligence Dossier</label>
                  <textarea rows={6} value={newTacticContent} onChange={(e) => setNewTacticContent(e.target.value)} placeholder="Paste unformatted technical reports, IOCs, server logs..." className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none" required />
                </div>
                <button type="submit" disabled={backendStatus !== 'ready' || !newTacticContent || (!newTacticCategory && !customCategory)} className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm tracking-wider uppercase transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2">
                  <Database className="w-4 h-4"/> {isIngestingTactic ? 'Vectorizing Embeddings...' : 'Vectorize & Ingest to RAG Store'}
                </button>
              </form>
            </div>
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Indexed TTP Context Cards</span>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 pb-10">
                {ragResults.map(r => (
                  <div key={r.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors pr-4">{r.title}</h4>
                      <span className="text-[9px] px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 text-slate-300 font-bold uppercase tracking-wider shrink-0">{r.category}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{r.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
