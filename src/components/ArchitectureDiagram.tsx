import React, { useState, useRef } from 'react';
import { 
  ARCHITECTURE_NODES, 
  ARCHITECTURE_LINKS, 
  FLOW_STAGES 
} from '../data/architectureData';
import { ArchitectureNode } from '../types';
import { 
  Globe, 
  Smartphone, 
  Terminal, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  Sliders, 
  Database, 
  HardDrive, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Copy, 
  Check, 
  Download, 
  X,
  Code2,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';

interface Props {
  onSelectNodeForSimulator?: (nodeId: string) => void;
}

export const ArchitectureDiagram: React.FC<Props> = () => {
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode | null>(ARCHITECTURE_NODES[3]); // Default: HAProxy
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 20, y: 10 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Auto-play timer for step tracing
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setActiveStep((prev) => (prev >= FLOW_STAGES.length ? 1 : prev + 1));
      }, 3500);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  const currentStage = FLOW_STAGES.find((s) => s.step === activeStep) || FLOW_STAGES[0];

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'diagram-bg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const getNodeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Globe': return <Globe className="w-5 h-5 text-sky-400" />;
      case 'Smartphone': return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case 'Terminal': return <Terminal className="w-5 h-5 text-amber-400" />;
      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-cyan-400" />;
      case 'Layers': return <Layers className="w-5 h-5 text-orange-400" />;
      case 'Sliders': return <Sliders className="w-5 h-5 text-pink-400" />;
      case 'Database': return <Database className="w-5 h-5 text-blue-400" />;
      case 'HardDrive': return <HardDrive className="w-5 h-5 text-teal-400" />;
      default: return <Cpu className="w-5 h-5 text-indigo-400" />;
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagrama-sistema-distribuido.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getMermaidCode = () => {
    return `graph TD
    subgraph Clientes ["Clientes del Sistema"]
        C_WEB["Cliente Web (SPA / WebSocket)"]
        C_MOB["Cliente Móvil (TCP Sockets)"]
        C_CLI["Cliente CLI (Python TCP)"]
    end

    subgraph LB ["Balanceo de Carga L4"]
        HAP["HAProxy / Nginx (Port 9000 TCP)"]
    end

    subgraph Gateways ["Capa de Ingesta (Socket Gateways)"]
        GW1["Socket Server 1 (Port 9001)"]
        GW2["Socket Server 2 (Port 9002)"]
    end

    subgraph Broker ["Cola de Mensajes"]
        RMQ[("RabbitMQ Cluster\\ntasks.queue / results.queue")]
    end

    subgraph Workers ["Capa de Cómputo (Worker Servers)"]
        W1["Worker 1\\nThreadPoolExecutor (4 threads)"]
        W2["Worker 2\\nThreadPoolExecutor (4 threads)"]
    end

    subgraph Storage ["Almacenamiento Distribuido"]
        PG[("PostgreSQL (Port 5432)\\nMetadatos ACID & Estados")]
        S3[("S3 / MinIO (Port 9000)\\nArtefactos & Payloads Pesados")]
    end

    C_WEB -->|TCP:9000| HAP
    C_MOB -->|TCP:9000| HAP
    C_CLI -->|TCP:9000| HAP

    HAP -->|Round-Robin| GW1
    HAP -->|Round-Robin| GW2

    GW1 -->|AMQP:5672| RMQ
    GW2 -->|AMQP:5672| RMQ

    GW1 -->|INSERT PENDING| PG
    GW2 -->|INSERT PENDING| PG

    RMQ -->|Prefetch=4| W1
    RMQ -->|Prefetch=4| W2

    W1 -->|UPDATE COMPLETED| PG
    W2 -->|UPDATE COMPLETED| PG

    W1 -->|PUT Object| S3
    W2 -->|PUT Object| S3

    W1 -->|AMQP Result| RMQ
    W2 -->|AMQP Result| RMQ
    
    RMQ -.->|Response| GW1
    RMQ -.->|Response| GW2
    GW1 -.->|TCP Return| C_CLI`;
  };

  const getPlantUmlCode = () => {
    return `@startuml
!theme plain
skinparam componentStyle uml2

package "Clientes" {
  [Cliente Web (Browser)] as Web
  [Cliente Movil (App)] as Mob
  [Cliente CLI (Socket)] as CLI
}

node "Balanceador de Carga" {
  [HAProxy / Nginx (TCP 9000)] as LB
}

package "Cluster Socket Gateways" {
  [Socket Server 1 (9001)] as GW1
  [Socket Server 2 (9002)] as GW2
}

queue "RabbitMQ Message Broker" {
  [tasks.queue] as TaskQ
  [results.queue] as ResQ
}

package "Worker Nodes" {
  node "Worker Server 1" {
    [ThreadPoolExecutor (4 Threads)] as TP1
  }
  node "Worker Server 2" {
    [ThreadPoolExecutor (4 Threads)] as TP2
  }
}

database "PostgreSQL" as PG
cloud "Amazon S3 / MinIO" as S3

Web --> LB : TCP/WebSocket
Mob --> LB : TCP Socket
CLI --> LB : TCP Socket

LB --> GW1 : Round-Robin TCP
LB --> GW2 : Round-Robin TCP

GW1 --> TaskQ : publish()
GW2 --> TaskQ : publish()
GW1 --> PG : insert pending
GW2 --> PG : insert pending

TaskQ --> TP1 : consume(prefetch=4)
TaskQ --> TP2 : consume(prefetch=4)

TP1 --> PG : update completed
TP2 --> PG : update completed
TP1 --> S3 : put artifact
TP2 --> S3 : put artifact

TP1 --> ResQ : publish result
TP2 --> ResQ : publish result
ResQ --> GW1 : return result
GW1 --> CLI : socket response
@enduml`;
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-61px)] bg-slate-950 overflow-hidden select-none">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/60 z-20">
        {/* Step Flow Tracker */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              disabled={activeStep <= 1}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded transition-colors"
              title="Paso Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Animar Flujo</span>
                </>
              )}
            </button>
            <button
              onClick={() => setActiveStep((prev) => Math.min(FLOW_STAGES.length, prev + 1))}
              disabled={activeStep >= FLOW_STAGES.length}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded transition-colors"
              title="Paso Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setActiveStep(1);
                setIsPlaying(false);
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              title="Reiniciar a Paso 1"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-slate-300 font-medium">
            <span className="text-indigo-400 font-semibold">{currentStage.title}</span>
            <span className="text-slate-500 ml-2 hidden lg:inline">({activeStep} de {FLOW_STAGES.length})</span>
          </div>
        </div>

        {/* Canvas & Export Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              title="Alejar Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-400 px-1 w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              title="Acercar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoomLevel(0.85);
                setPan({ x: 20, y: 10 });
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded transition-colors"
              title="Restablecer Vista"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export buttons */}
          <button
            onClick={downloadSvg}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar SVG</span>
          </button>

          <button
            onClick={() => copyToClipboard(getMermaidCode(), 'mermaid')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg transition-colors cursor-pointer"
          >
            {copiedType === 'mermaid' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
            <span>Copiar Mermaid</span>
          </button>

          <button
            onClick={() => copyToClipboard(getPlantUmlCode(), 'plantuml')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 rounded-lg transition-colors cursor-pointer"
          >
            {copiedType === 'plantuml' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>PlantUML</span>
          </button>
        </div>
      </div>

      {/* Stage Explanatory Ribbon */}
      <div className="bg-indigo-950/40 border-b border-indigo-900/30 px-6 py-2 text-xs text-indigo-200/90 flex items-center justify-between">
        <div>
          <span className="font-semibold text-indigo-300 mr-2">Flujo Activo:</span>
          {currentStage.summary}
        </div>
        <div className="text-[11px] text-slate-400 font-mono hidden md:block">
          {currentStage.detail}
        </div>
      </div>

      {/* Main Interactive Diagram Canvas */}
      <div 
        className="relative flex-1 cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg
          ref={svgRef}
          id="diagram-bg"
          className="w-full h-full"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoomLevel})`}>
            {/* Defs: Marker Arrows & Glow Filters */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
              </marker>

              <marker
                id="arrowhead-active"
                markerWidth="9"
                markerHeight="7"
                refX="8"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 9 3.5, 0 7" fill="#6366f1" />
              </marker>

              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Layer Background Zones */}
            <g opacity="0.4">
              {/* Clients Zone */}
              <rect x="50" y="25" width="280" height="460" rx="12" fill="#0f172a" stroke="#1e293b" strokeDasharray="4 4" />
              <text x="70" y="50" fill="#64748b" fontSize="12" fontWeight="600" letterSpacing="0.05em">CAPA 1: CLIENTES</text>

              {/* Load Balancer Zone */}
              <rect x="360" y="140" width="290" height="230" rx="12" fill="#0f172a" stroke="#1e293b" strokeDasharray="4 4" />
              <text x="380" y="165" fill="#64748b" fontSize="12" fontWeight="600" letterSpacing="0.05em">CAPA 2: BALANCEADOR L4</text>

              {/* Gateways Zone */}
              <rect x="680" y="60" width="290" height="380" rx="12" fill="#0f172a" stroke="#1e293b" strokeDasharray="4 4" />
              <text x="700" y="85" fill="#64748b" fontSize="12" fontWeight="600" letterSpacing="0.05em">CAPA 3: SOCKET GATEWAYS</text>

              {/* Queue Zone */}
              <rect x="1000" y="140" width="300" height="230" rx="12" fill="#0f172a" stroke="#1e293b" strokeDasharray="4 4" />
              <text x="1020" y="165" fill="#64748b" fontSize="12" fontWeight="600" letterSpacing="0.05em">CAPA 4: COLA RABBITMQ</text>

              {/* Workers Zone */}
              <rect x="1330" y="60" width="310" height="380" rx="12" fill="#0f172a" stroke="#1e293b" strokeDasharray="4 4" />
              <text x="1350" y="85" fill="#64748b" fontSize="12" fontWeight="600" letterSpacing="0.05em">CAPA 5: WORKER POOLS</text>

              {/* Storage Zone */}
              <rect x="1680" y="50" width="300" height="400" rx="12" fill="#0f172a" stroke="#1e293b" strokeDasharray="4 4" />
              <text x="1700" y="75" fill="#64748b" fontSize="12" fontWeight="600" letterSpacing="0.05em">CAPA 6: ALMACENAMIENTO</text>
            </g>

            {/* Connecting Links */}
            {ARCHITECTURE_LINKS.map((link) => {
              const srcNode = ARCHITECTURE_NODES.find((n) => n.id === link.source);
              const tgtNode = ARCHITECTURE_NODES.find((n) => n.id === link.target);
              if (!srcNode || !tgtNode) return null;

              const isLinkActive = currentStage.activeLinks.includes(link.id);

              const startX = srcNode.x + srcNode.width;
              const startY = srcNode.y + srcNode.height / 2;
              const endX = tgtNode.x;
              const endY = tgtNode.y + tgtNode.height / 2;

              // Cubic Bezier curve control points
              const dx = (endX - startX) * 0.5;
              const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

              return (
                <g key={link.id} className="transition-all duration-300">
                  {/* Background wire */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isLinkActive ? '#6366f1' : '#334155'}
                    strokeWidth={isLinkActive ? '2.5' : '1.5'}
                    strokeDasharray={isLinkActive ? '6 4' : 'none'}
                    markerEnd={isLinkActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                    className={isLinkActive ? 'animate-pulse' : ''}
                  />

                  {/* Animated Traveling Packet Dot when link is active */}
                  {isLinkActive && (
                    <circle r="4" fill="#a5b4fc" filter="url(#glow)">
                      <animateMotion
                        path={pathD}
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Wire Label */}
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 8}
                    fill={isLinkActive ? '#e0e7ff' : '#64748b'}
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                  >
                    {link.label}
                  </text>
                </g>
              );
            })}

            {/* Architecture Nodes */}
            {ARCHITECTURE_NODES.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isStepActive = currentStage.activeNodes.includes(node.id);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                  }}
                  className="cursor-pointer group"
                >
                  {/* Node Outer Shell / Shadow */}
                  <rect
                    width={node.width}
                    height={node.height}
                    rx="10"
                    fill={isSelected ? '#1e1b4b' : '#0f172a'}
                    stroke={
                      isSelected
                        ? '#818cf8'
                        : isStepActive
                        ? '#6366f1'
                        : '#334155'
                    }
                    strokeWidth={isSelected ? '2' : isStepActive ? '2' : '1'}
                    className="transition-colors duration-200"
                  />

                  {/* Active highlight pulse aura */}
                  {isStepActive && (
                    <rect
                      width={node.width + 6}
                      height={node.height + 6}
                      x="-3"
                      y="-3"
                      rx="12"
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="1.5"
                      opacity="0.6"
                      className="animate-pulse"
                    />
                  )}

                  {/* Node Header: Icon & Port */}
                  <g transform="translate(14, 14)">
                    {getNodeIcon(node.icon)}
                  </g>

                  {/* Port Badge */}
                  {node.port && (
                    <g transform={`translate(${node.width - 75}, 12)`}>
                      <rect width="65" height="18" rx="4" fill="#1e293b" />
                      <text
                        x="32.5"
                        y="12"
                        fill="#94a3b8"
                        fontSize="9.5"
                        fontFamily="JetBrains Mono"
                        textAnchor="middle"
                      >
                        {node.port}
                      </text>
                    </g>
                  )}

                  {/* Node Title */}
                  <text
                    x="42"
                    y="28"
                    fill={isSelected ? '#ffffff' : '#f1f5f9'}
                    fontSize="12.5"
                    fontWeight="600"
                    fontFamily="Plus Jakarta Sans"
                  >
                    {node.name}
                  </text>

                  {/* Tech stack & protocol line */}
                  <text
                    x="14"
                    y="56"
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                  >
                    {node.protocol}
                  </text>

                  {/* Summary / Role text */}
                  <foreignObject x="14" y="66" width={node.width - 28} height={node.height - 72}>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                      {node.techStack}
                    </p>
                  </foreignObject>

                  {/* Bottom selection pill indicator */}
                  {isSelected && (
                    <rect
                      x="0"
                      y={node.height - 3}
                      width={node.width}
                      height="3"
                      rx="1.5"
                      fill="#818cf8"
                    />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend / Guide bottom pill */}
        <div className="absolute bottom-4 left-6 bg-slate-900/90 border border-slate-800 rounded-lg px-3.5 py-2 text-[11px] text-slate-400 backdrop-blur z-10 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <span>Nodo o Enlace Activo en el Paso</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded border border-indigo-400"></span>
            <span>Nodo Seleccionado para Inspección</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>Arrastra el lienzo para desplazarte</span>
        </div>
      </div>

      {/* Inspector Drawer / Sidebar for Selected Node */}
      {selectedNode && (
        <aside className="absolute right-0 top-[49px] bottom-0 w-96 bg-slate-900/95 border-l border-slate-800 backdrop-blur-md shadow-2xl z-30 flex flex-col overflow-y-auto">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60 sticky top-0">
            <div className="flex items-center gap-2.5">
              {getNodeIcon(selectedNode.icon)}
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedNode.name}</h3>
                <div className="text-[11px] text-slate-400 font-mono">
                  {selectedNode.protocol} {selectedNode.port ? `· ${selectedNode.port}` : ''}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="p-4 space-y-4 text-xs">
            {/* Tech Stack */}
            <div>
              <div className="text-slate-400 text-[11px] font-medium mb-1">Tecnología & Stack</div>
              <div className="bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 font-mono text-[11px]">
                {selectedNode.techStack}
              </div>
            </div>

            {/* Role & Objective */}
            <div>
              <div className="text-slate-400 text-[11px] font-medium mb-1">Rol en la Arquitectura Distribuida</div>
              <p className="text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded p-2.5">
                {selectedNode.role}
              </p>
            </div>

            {/* Concurrency Model */}
            <div>
              <div className="text-slate-400 text-[11px] font-medium mb-1">Modelo de Concurrencia e Hilos</div>
              <p className="text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded p-2.5">
                {selectedNode.concurrencyModel}
              </p>
            </div>

            {/* Configuration / Code Snippet */}
            <div>
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium mb-1">
                <span>Configuración / Implementación Clave</span>
                <button
                  onClick={() => copyToClipboard(selectedNode.configurationSnippet, 'snippet')}
                  className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  {copiedType === 'snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copiar</span>
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded p-3 text-[11px] font-mono text-indigo-200 overflow-x-auto">
                <code>{selectedNode.configurationSnippet}</code>
              </pre>
            </div>

            {/* Fault Tolerance & Recovery */}
            <div>
              <div className="text-slate-400 text-[11px] font-medium mb-1">Tolerancia a Fallos & Resiliencia</div>
              <p className="text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded p-2.5">
                {selectedNode.failureHandling}
              </p>
            </div>

            {/* Scalability Strategy */}
            <div>
              <div className="text-slate-400 text-[11px] font-medium mb-1">Estrategia de Escalamiento</div>
              <p className="text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded p-2.5">
                {selectedNode.scalabilityNotes}
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
