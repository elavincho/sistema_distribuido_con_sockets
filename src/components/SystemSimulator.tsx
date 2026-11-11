import React, { useState, useEffect, useRef } from 'react';
import { 
  SimulatedTask, 
  ClientType, 
  TaskType, 
  WorkerState, 
  SocketPacketLog 
} from '../types';
import { 
  Send, 
  Layers, 
  Database, 
  HardDrive, 
  Cpu, 
  Sliders, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Trash2,
  FileJson,
  FileCode,
  Eye,
  X
} from 'lucide-react';

export const SystemSimulator: React.FC = () => {
  // Config state
  const [selectedClient, setSelectedClient] = useState<ClientType>('cli');
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType>('matrix_mult');
  const [matrixSize, setMatrixSize] = useState<number>(64);
  const [hashDifficulty, setHashDifficulty] = useState<number>(3);
  const [numWorkers, setNumWorkers] = useState<number>(2);
  const [threadsPerWorker, setThreadsPerWorker] = useState<number>(4);
  const [lbAlgorithm, setLbAlgorithm] = useState<'round_robin' | 'least_conn'>('round_robin');
  const lbCounterRef = useRef<number>(0);

  // Simulation state
  const [tasks, setTasks] = useState<SimulatedTask[]>([]);
  const [workers, setWorkers] = useState<WorkerState[]>([]);
  const [queueTasks, setQueueTasks] = useState<string[]>([]);
  const [packets, setPackets] = useState<SocketPacketLog[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<{ key: string; data: any } | null>(null);

  // Initialize workers whenever numWorkers or threadsPerWorker changes
  useEffect(() => {
    const newWorkers: WorkerState[] = [];
    for (let i = 1; i <= numWorkers; i++) {
      newWorkers.push({
        id: `wrk-${i}`,
        name: `Worker Node #${i}`,
        maxThreads: threadsPerWorker,
        activeThreads: Array.from({ length: threadsPerWorker }, (_, idx) => ({
          threadId: idx + 1,
          progress: 0,
        })),
        tasksProcessed: 0,
        cpuLoad: 0,
      });
    }
    setWorkers(newWorkers);
  }, [numWorkers, threadsPerWorker]);

  // Main task dispatcher loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Find idle threads across all workers
      setWorkers((prevWorkers) => {
        let queueCopy = [...queueTasks];
        if (queueCopy.length === 0) return prevWorkers;

        const updatedWorkers = prevWorkers.map((w) => {
          const updatedThreads = w.activeThreads.map((thread) => {
            if (!thread.taskId && queueCopy.length > 0) {
              const nextTaskId = queueCopy.shift()!;
              // Start computation on this thread
              return {
                ...thread,
                taskId: nextTaskId,
                progress: 5,
              };
            }
            if (thread.taskId) {
              // Advance computation progress
              const nextProgress = thread.progress + 20;
              if (nextProgress >= 100) {
                // Task is completed on this thread!
                completeTask(thread.taskId, w.id, thread.threadId);
                return {
                  ...thread,
                  taskId: undefined,
                  taskType: undefined,
                  progress: 0,
                };
              }
              return {
                ...thread,
                progress: nextProgress,
              };
            }
            return thread;
          });

          const activeCount = updatedThreads.filter((t) => !!t.taskId).length;
          return {
            ...w,
            activeThreads: updatedThreads,
            cpuLoad: Math.round((activeCount / w.maxThreads) * 100),
          };
        });

        setQueueTasks(queueCopy);
        return updatedWorkers;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [queueTasks]);

  const completeTask = (taskId: string, workerId: string, threadId: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const duration = Date.now() - t.createdAt;
          const artifactKey = `artifacts/${taskId}_${t.taskType}.json`;
          return {
            ...t,
            status: 'COMPLETED',
            currentStage: 'Respuesta retornada al socket del cliente',
            assignedWorker: workerId,
            assignedThreadId: threadId,
            latencyMs: duration,
            s3ArtifactUrl: `s3://distributed-tasks/${artifactKey}`,
            postgresRecordId: Math.floor(1000 + Math.random() * 9000),
            resultSummary: `Cálculo exitoso finalizado en ${duration}ms por ${workerId} (Hilo #${threadId}).`,
          };
        }
        return t;
      })
    );

    setWorkers((prev) =>
      prev.map((w) =>
        w.id === workerId ? { ...w, tasksProcessed: w.tasksProcessed + 1 } : w
      )
    );

    // Record return socket packet
    addPacketLog('OUTGOING', 'Socket Gateway', 'Cliente', 'TCP Socket (Framed)', {
      task_id: taskId,
      status: 'COMPLETED',
      worker_id: workerId,
      thread_id: threadId,
    });
  };

  const addPacketLog = (
    direction: 'INCOMING' | 'OUTGOING' | 'INTERNAL',
    from: string,
    to: string,
    protocol: string,
    payloadObj: any
  ) => {
    const jsonStr = JSON.stringify(payloadObj);
    const byteLen = new TextEncoder().encode(jsonStr).length;
    // Format 4 bytes hex header
    const hexHeader = `00 00 ${((byteLen >> 8) & 0xff).toString(16).padStart(2, '0')} ${(byteLen & 0xff).toString(16).padStart(2, '0')}`;

    const newPacket: SocketPacketLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      direction,
      from,
      to,
      protocol,
      rawHex: `[${hexHeader.toUpperCase()}] ${jsonStr.substring(0, 48)}...`,
      payloadSummary: jsonStr,
      sizeBytes: byteLen + 4,
    };

    setPackets((prev) => [newPacket, ...prev.slice(0, 19)]);
  };

  const submitSingleTask = () => {
    const taskId = `task-${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    // Load balancer node selection
    let chosenGateway = 'srv-node-1';
    if (lbAlgorithm === 'round_robin') {
      lbCounterRef.current += 1;
      chosenGateway = lbCounterRef.current % 2 === 0 ? 'srv-node-2' : 'srv-node-1';
    }

    const payloadObj = {
      task_id: taskId,
      client_id: `${selectedClient}_client_01`,
      task_type: selectedTaskType,
      priority: 'normal',
      payload: selectedTaskType === 'matrix_mult' 
        ? { size: matrixSize } 
        : selectedTaskType === 'hash_mining' 
        ? { difficulty: hashDifficulty } 
        : { count: 10000 },
      sync: true,
      timestamp: now / 1000,
    };

    // 1. Log incoming socket frame
    addPacketLog('INCOMING', `Cliente (${selectedClient})`, `HAProxy -> ${chosenGateway}`, 'TCP Socket (Framed)', payloadObj);

    const newTask: SimulatedTask = {
      id: taskId,
      clientType: selectedClient,
      taskType: selectedTaskType,
      priority: 'normal',
      createdAt: now,
      status: 'ENQUEUED_RABBITMQ',
      currentStage: `Encolado en RabbitMQ tasks.queue vía ${chosenGateway}`,
      assignedGateway: chosenGateway,
      progress: 0,
      computeDurationMs: 0,
      rawPayloadSnippet: JSON.stringify(payloadObj.payload),
    };

    setTasks((prev) => [newTask, ...prev.slice(0, 39)]);
    setQueueTasks((prev) => [...prev, taskId]);
  };

  const submitBatchTasks = () => {
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        submitSingleTask();
      }, i * 150);
    }
  };

  const clearHistory = () => {
    setTasks([]);
    setQueueTasks([]);
    setPackets([]);
    setWorkers((prev) =>
      prev.map((w) => ({
        ...w,
        tasksProcessed: 0,
        cpuLoad: 0,
        activeThreads: w.activeThreads.map((t) => ({ ...t, taskId: undefined, progress: 0 })),
      }))
    );
  };

  // Metrics
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
  const avgLatency = completedTasks.length > 0
    ? Math.round(completedTasks.reduce((acc, cur) => acc + (cur.latencyMs || 0), 0) / completedTasks.length)
    : 0;

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] bg-slate-950 overflow-y-auto">
      {/* Top Configuration & Dispatcher Toolbar */}
      <div className="p-4 bg-slate-900/70 border-b border-slate-800 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Client & Task Type controls */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Client selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <span className="text-slate-400 font-medium px-1.5">Cliente:</span>
              {(['cli', 'web', 'mobile'] as ClientType[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedClient(c)}
                  className={`px-2.5 py-1 rounded capitalize font-medium transition-colors ${
                    selectedClient === c
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c === 'cli' ? 'Terminal CLI' : c === 'web' ? 'Navegador Web' : 'App Móvil'}
                </button>
              ))}
            </div>

            {/* Task Type selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <span className="text-slate-400 font-medium px-1.5">Tarea:</span>
              <select
                value={selectedTaskType}
                onChange={(e) => setSelectedTaskType(e.target.value as TaskType)}
                aria-label="Seleccionar tipo de tarea"
                className="bg-transparent text-slate-200 border-none outline-none font-medium text-xs cursor-pointer pr-2"
              >
                <option value="matrix_mult" className="bg-slate-900">Multiplicación Matricial (CPU)</option>
                <option value="image_filter" className="bg-slate-900">Filtro de Imagen / Convolución</option>
                <option value="data_aggregate" className="bg-slate-900">Agregación Estadística Batch</option>
                <option value="hash_mining" className="bg-slate-900">Hash Mining (Proof of Work)</option>
              </select>
            </div>

            {/* Task Parameter */}
            {selectedTaskType === 'matrix_mult' && (
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                <span className="text-slate-400">Tamaño N:</span>
                <select
                  value={matrixSize}
                  onChange={(e) => setMatrixSize(Number(e.target.value))}
                  aria-label="Tamaño de la matriz"
                  className="bg-transparent text-indigo-300 font-mono text-xs cursor-pointer outline-none"
                >
                  <option value={32} className="bg-slate-900">32x32</option>
                  <option value={64} className="bg-slate-900">64x64</option>
                  <option value={128} className="bg-slate-900">128x128</option>
                </select>
              </div>
            )}

            {/* Cluster sizing controls */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
              <span className="text-slate-400">Workers:</span>
              <select
                value={numWorkers}
                onChange={(e) => setNumWorkers(Number(e.target.value))}
                aria-label="Cantidad de workers"
                className="bg-transparent text-indigo-300 font-mono text-xs cursor-pointer outline-none"
              >
                <option value={1} className="bg-slate-900">1 Nodo</option>
                <option value={2} className="bg-slate-900">2 Nodos</option>
                <option value={4} className="bg-slate-900">4 Nodos</option>
              </select>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Hilos/Pool:</span>
              <select
                value={threadsPerWorker}
                onChange={(e) => setThreadsPerWorker(Number(e.target.value))}
                aria-label="Hilos por pool"
                className="bg-transparent text-indigo-300 font-mono text-xs cursor-pointer outline-none"
              >
                <option value={2} className="bg-slate-900">2 Hilos</option>
                <option value={4} className="bg-slate-900">4 Hilos</option>
                <option value={8} className="bg-slate-900">8 Hilos</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={submitSingleTask}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar Tarea Socket</span>
            </button>
            <button
              onClick={submitBatchTasks}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-200 bg-amber-900/40 hover:bg-amber-800/40 border border-amber-700/50 rounded-lg transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Ráfaga (10 Tareas)</span>
            </button>
            <button
              onClick={clearHistory}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Limpiar Simulación"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-medium text-slate-400">Cola RabbitMQ</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
              {queueTasks.length} <span className="text-xs font-normal text-slate-500">en espera</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-medium text-slate-400">Tareas Completadas</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
              {completedTasks.length} <span className="text-xs font-normal text-slate-500">finalizadas</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-medium text-slate-400">Latencia Media Socket</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1 tabular-nums">
              {avgLatency} <span className="text-xs font-normal text-slate-500">ms</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-medium text-slate-400">Capacidad de Hilos Activos</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mt-1 tabular-nums">
              {workers.reduce((acc, w) => acc + w.activeThreads.filter((t) => !!t.taskId).length, 0)} / {numWorkers * threadsPerWorker}
            </div>
          </div>
        </div>

        {/* Distributed Execution Stages Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Load Balancer & Socket Gateways */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-semibold text-slate-200">Balanceador & Gateways TCP</h3>
              </div>
              <div className="text-[11px] font-mono text-slate-400">HAProxy :9000</div>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Algoritmo Balanceo:</span>
                  <span className="font-mono text-indigo-400 uppercase">{lbAlgorithm}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Conexiones Sockets Abiertas:</span>
                  <span className="font-mono text-slate-200 tabular-nums">{tasks.filter(t => t.status !== 'COMPLETED').length}</span>
                </div>
              </div>

              {/* Gateways Status */}
              <div className="space-y-2">
                <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Gateway srv-node-1</div>
                    <div className="text-[10px] text-slate-400 font-mono">TCP :9001 · ThreadingTCPServer</div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">SALUDABLE</span>
                </div>

                <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Gateway srv-node-2</div>
                    <div className="text-[10px] text-slate-400 font-mono">TCP :9002 · ThreadingTCPServer</div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">SALUDABLE</span>
                </div>
              </div>

              {/* RabbitMQ Queue Depth visual */}
              <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-lg">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-amber-300">RabbitMQ: tasks.queue</span>
                  <span className="font-mono text-amber-400 tabular-nums">{queueTasks.length} msgs</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (queueTasks.length / 15) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Worker Nodes & Internal ThreadPools */}
          <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-pink-400" />
                <h3 className="text-xs font-semibold text-slate-200">Servidores Workers con ThreadPoolExecutor</h3>
              </div>
              <div className="text-[11px] font-mono text-slate-400">{numWorkers} Nodos · {threadsPerWorker} Hilos c/u</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workers.map((worker) => (
                <div key={worker.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">{worker.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">Carga CPU: {worker.cpuLoad}%</div>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded">
                      {worker.tasksProcessed} procesadas
                    </div>
                  </div>

                  {/* Individual Thread Slots */}
                  <div className="space-y-2">
                    {worker.activeThreads.map((thread) => (
                      <div 
                        key={thread.threadId}
                        className="p-2 bg-slate-900/80 border border-slate-800/80 rounded-lg text-[11px] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-mono">Hilo #{thread.threadId}</span>
                          {thread.taskId ? (
                            <span className="text-cyan-400 font-mono text-[10px] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                              Computando {thread.taskId}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[10px]">LIBRE (IDLE)</span>
                          )}
                        </div>

                        {/* Thread Progress bar */}
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${thread.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Persistence Inspection: PostgreSQL & S3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PostgreSQL Task Ledger */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-semibold text-slate-200">PostgreSQL: Tabla distributed_tasks (ACID)</h3>
              </div>
              <div className="text-[10px] font-mono text-slate-400">Puerto 5432</div>
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0">
                  <tr>
                    <th className="py-2 px-3">task_id</th>
                    <th className="py-2 px-3">cliente</th>
                    <th className="py-2 px-3">tipo</th>
                    <th className="py-2 px-3">estado</th>
                    <th className="py-2 px-3 text-right">duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {tasks.slice(0, 8).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 text-slate-300">{t.id}</td>
                      <td className="py-2 px-3 text-slate-400">{t.clientType}</td>
                      <td className="py-2 px-3 text-indigo-300">{t.taskType}</td>
                      <td className="py-2 px-3">
                        <span className={t.status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                        {t.latencyMs ? `${t.latencyMs} ms` : '—'}
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-sans text-xs">
                        No hay tareas registradas aún. Haz clic en "Enviar Tarea Socket".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* S3 / MinIO Object Storage Bucket */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-teal-400" />
                <h3 className="text-xs font-semibold text-slate-200">S3 / MinIO: Bucket "distributed-tasks"</h3>
              </div>
              <div className="text-[10px] font-mono text-slate-400">Objetos & Artefactos</div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {completedTasks.slice(0, 6).map((t) => (
                <div 
                  key={t.id}
                  className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-teal-400 shrink-0" />
                    <div>
                      <div className="font-mono text-slate-200 text-[11px]">{t.id}_{t.taskType}.json</div>
                      <div className="text-[10px] text-slate-400">
                        {t.assignedWorker} · {t.latencyMs}ms
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSelectedArtifact({
                        key: `${t.id}_${t.taskType}.json`,
                        data: {
                          task_id: t.id,
                          task_type: t.taskType,
                          worker: t.assignedWorker,
                          thread: t.assignedThreadId,
                          latency_ms: t.latencyMs,
                          status: 'COMPLETED',
                          artifact_payload: t.rawPayloadSnippet,
                        },
                      })
                    }
                    className="flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 font-medium px-2 py-1 rounded bg-teal-950/40 border border-teal-900/50 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Inspeccionar</span>
                  </button>
                </div>
              ))}
              {completedTasks.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Los artefactos JSON pesados subidos a S3 aparecerán aquí al completarse las tareas.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wire Protocol & Hex Socket Frame Inspector */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-slate-200">
                Monitor de Tramas de Socket TCP (Prefijo de Longitud + JSON)
              </h3>
            </div>
            <div className="text-[10px] font-mono text-slate-400">Protocolo !I (Big-Endian uint32)</div>
          </div>

          <div className="overflow-x-auto max-h-56">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0">
                <tr>
                  <th className="py-2 px-3">Hora</th>
                  <th className="py-2 px-3">Dirección</th>
                  <th className="py-2 px-3">Origen -&gt; Destino</th>
                  <th className="py-2 px-3">Encabezado Binario (Hex) + Muestra Payload</th>
                  <th className="py-2 px-3 text-right">Tamaño</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {packets.map((pkt) => (
                  <tr key={pkt.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-400">{pkt.timestamp}</td>
                    <td className="py-2 px-3">
                      <span className={pkt.direction === 'INCOMING' ? 'text-sky-400' : 'text-emerald-400'}>
                        {pkt.direction}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{pkt.from} → {pkt.to}</td>
                    <td className="py-2 px-3 text-indigo-300 truncate max-w-md">{pkt.rawHex}</td>
                    <td className="py-2 px-3 text-right text-slate-400 tabular-nums">{pkt.sizeBytes} B</td>
                  </tr>
                ))}
                {packets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 font-sans text-xs">
                      Envía una tarea para observar las tramas de socket decodificadas a nivel de bytes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* S3 Artifact Modal Viewer */}
      {selectedArtifact && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-teal-400" />
                <h4 className="text-xs font-semibold text-white font-mono">{selectedArtifact.key}</h4>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-teal-200 max-h-72 overflow-y-auto">
              <code>{JSON.stringify(selectedArtifact.data, null, 2)}</code>
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedArtifact(null)}
                className="px-4 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
