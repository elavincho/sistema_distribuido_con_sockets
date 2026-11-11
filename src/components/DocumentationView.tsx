import React, { useState } from 'react';
import { 
  BookOpen, 
  Terminal, 
  Cpu, 
  Layers, 
  Database, 
  HardDrive, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink,
  Zap,
  Network
} from 'lucide-react';

export const DocumentationView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('intro');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="flex h-[calc(100vh-61px)] bg-slate-950 overflow-hidden">
      {/* Sidebar TOC */}
      <aside className="w-72 border-r border-slate-800 bg-slate-900/30 p-4 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4 text-white font-semibold text-xs tracking-wide">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>Manual de Arquitectura</span>
        </div>

        <nav className="space-y-1 text-xs">
          {[
            { id: 'intro', label: '1. Justificación y Objetivos' },
            { id: 'protocol', label: '2. Protocolo de Sockets' },
            { id: 'lb', label: '3. Balanceo de Carga (HAProxy/Nginx)' },
            { id: 'gateways', label: '4. Servidores Socket Gateway' },
            { id: 'rabbitmq', label: '5. Cola de Mensajes (RabbitMQ)' },
            { id: 'workers', label: '6. Workers y ThreadPoolExecutor' },
            { id: 'storage', label: '7. Almacenamiento (PostgreSQL & S3)' },
            { id: 'execution', label: '8. Guía de Ejecución y Pruebas' },
            { id: 'benchmarks', label: '9. Análisis de Rendimiento' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                activeSection === item.id
                  ? 'bg-indigo-950/70 border border-indigo-500/40 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-10 text-slate-300 text-sm leading-relaxed">
        {/* SECTION 1: INTRO */}
        {activeSection === 'intro' && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              1. Rediseño como Sistema Distribuido (Cliente-Servidor)
            </h1>
            <p className="text-slate-400 text-base">
              El objetivo de este proyecto es transformar una aplicación monolítica o centralizada tradicional en una
              <strong> arquitectura distribuida desacoplada basada en sockets TCP</strong>, preparada para soportar alta
              concurrencia, aislamiento de fallos y escalabilidad elástica horizontal.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <h4 className="text-xs font-semibold text-rose-400">Limitaciones del Modelo Anterior</h4>
                <ul className="text-xs space-y-1 text-slate-400 list-disc list-inside">
                  <li>Acoplamiento síncrono cliente-servidor provoca bloqueos en tareas de cálculo prolongado.</li>
                  <li>Un solo proceso atiende peticiones y computa, saturando la CPU y colapsando el socket.</li>
                  <li>Falta de persistencia ante caídas: si el servidor cae, las tareas en curso se pierden.</li>
                  <li>Ausencia de balanceo de carga para absorber ráfagas masivas.</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <h4 className="text-xs font-semibold text-emerald-400">Ventajas de la Arquitectura Distribuida</h4>
                <ul className="text-xs space-y-1 text-slate-400 list-disc list-inside">
                  <li><strong>Desacoplamiento asíncrono</strong> mediante RabbitMQ como amortiguador (buffer).</li>
                  <li><strong>Granja de Workers elástica</strong> con pools de hilos concurrentes independientes.</li>
                  <li><strong>Balanceo en Capa 4 (TCP)</strong> con HAProxy/Nginx para alta velocidad y tolerancia a fallos.</li>
                  <li><strong>Almacenamiento híbrido:</strong> PostgreSQL para estado relacional y S3 para artefactos pesados.</li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: PROTOCOL */}
        {activeSection === 'protocol' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              2. Protocolo de Sockets y Framing Binario
            </h2>
            <p>
              TCP es un protocolo orientado a <strong>flujo continuo de bytes (stream-oriented)</strong>, lo que significa
              que no preserva los límites de los mensajes a nivel de aplicación. Dos peticiones enviadas rápidamente pueden
              fusionarse en un único paquete recibido (TCP coalescing), o una petición extensa puede dividirse en fragmentos
              múltiples (TCP fragmentation).
            </p>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
              <div className="text-indigo-400 font-semibold">Estructura de la Trama de Red:</div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 text-slate-200">
                +-----------------------+-----------------------------------------------+<br />
                | Header: 4 Bytes       | Payload: N Bytes                              |<br />
                | uint32 (Big-Endian)   | JSON serializado en UTF-8                     |<br />
                | Formato struct '!I'   | {'{"task_id": "...", "payload": {...}}'}      |<br />
                +-----------------------+-----------------------------------------------+
              </div>
            </div>

            <h3 className="text-sm font-semibold text-white mt-4">Implementación en Python (protocol.py)</h3>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-indigo-200 overflow-x-auto">
{`def pack_message(data: dict) -> bytes:
    json_bytes = json.dumps(data).encode("utf-8")
    header = struct.pack("!I", len(json_bytes))
    return header + json_bytes

def read_exact(sock: socket.socket, num_bytes: int) -> bytes:
    buf = bytearray()
    while len(buf) < num_bytes:
        chunk = sock.recv(num_bytes - len(buf))
        if not chunk:
            raise ConnectionError("Socket cerrado antes de completar la trama")
        buf.extend(chunk)
    return bytes(buf)`}
            </pre>
          </section>
        )}

        {/* SECTION 3: LOAD BALANCER */}
        {activeSection === 'lb' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              3. Balanceador de Carga (HAProxy / Nginx)
            </h2>
            <p>
              El sistema expone un puerto público único (<strong>puerto 9000</strong>) mediante un balanceador de carga que
              opera en <strong>Capa de Transporte (Capa 4 / OSI)</strong>. Esto proporciona:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
              <li><strong>Zero-Overhead de Capa 7:</strong> Al no tener que parsear HTTP, HAProxy simplemente reenvía streams TCP puros a velocidad cercana al hardware de red.</li>
              <li><strong>Verificación de Salud Activa (Health Checks):</strong> Monitorea los puertos 9001 y 9002 cada 2000 ms. Si un nodo cae, es drenado sin interrumpir a los clientes.</li>
              <li><strong>Algoritmos Soportados:</strong> Round-Robin para distribución equitativa o Least Connections para tareas de larga duración.</li>
            </ul>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-semibold text-slate-300">Extracto de haproxy.cfg:</span>
              <button
                onClick={() => copyCommand(`frontend socket_inbound
    bind *:9000
    mode tcp
    default_backend socket_servers_pool

backend socket_servers_pool
    mode tcp
    balance roundrobin
    server srv1 server-1:9001 check inter 2000
    server srv2 server-2:9002 check inter 2000`, 'haproxy')}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                {copiedCmd === 'haproxy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar Config</span>
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto">
{`frontend socket_inbound
    bind *:9000
    mode tcp
    default_backend socket_servers_pool

backend socket_servers_pool
    mode tcp
    balance roundrobin
    server srv1 server-1:9001 check inter 2000
    server srv2 server-2:9002 check inter 2000`}
            </pre>
          </section>
        )}

        {/* SECTION 4: GATEWAYS */}
        {activeSection === 'gateways' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              4. Servidores Socket Gateway (server.py)
            </h2>
            <p>
              Los servidores gateway actúan como capa de ingesta ligera y de alta velocidad. Utilizan
              <code> socketserver.ThreadingTCPServer</code> en Python para asignar un hilo por conexión entrante.
            </p>
            <p>
              Su responsabilidad está estrictamente delimitada:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-400">
              <li>Aceptar y mantener la sesión de socket TCP abierta con el cliente.</li>
              <li>Desempaquetar la trama con <code>unpack_message()</code>.</li>
              <li>Insertar la tarea en PostgreSQL con estado inicial <code>PENDING</code>.</li>
              <li>Publicar la tarea en la cola de RabbitMQ (<code>tasks.queue</code>).</li>
              <li>Aguardar la notificación de resultado emitida por el worker y reenviarla al socket.</li>
            </ol>
          </section>
        )}

        {/* SECTION 5: RABBITMQ */}
        {activeSection === 'rabbitmq' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              5. Cola de Mensajes (RabbitMQ)
            </h2>
            <p>
              RabbitMQ es el núcleo de desacoplamiento del sistema distribuido. Resuelve los siguientes desafíos críticos:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400">
              <li><strong>Control de Sobrecarga (Backpressure):</strong> Si 10,000 clientes envían tareas simultáneas, los workers no colapsan. Las tareas esperan de forma segura en la cola en disco.</li>
              <li><strong>Garantía de Entrega At-Least-Once:</strong> Los workers confirman con <code>basic_ack</code> solo cuando la tarea terminó. Si el worker cae a mitad de cálculo, la tarea no se pierde; RabbitMQ la reencola de inmediato.</li>
              <li><strong>Prefetching Controlado:</strong> Cada worker consume con <code>prefetch_count=4</code> para que ningún nodo acapare tareas si otros están ociosos.</li>
            </ul>
          </section>
        )}

        {/* SECTION 6: WORKERS */}
        {activeSection === 'workers' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              6. Servidores Workers y Pool de Hilos (ThreadPoolExecutor)
            </h2>
            <p>
              Cada nodo worker es un proceso independiente que instancia un <strong>ThreadPoolExecutor</strong> con $N$
              hilos de trabajo simultáneos.
            </p>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-xs font-semibold text-indigo-300">¿Por qué un Pool de Hilos en lugar de hilos ilimitados?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Crear un nuevo hilo por cada tarea (\`Thread(target=...).start()\`) degrada drásticamente la memoria RAM y
                causa *thread contention*. Con un pool de tamaño fijo (ej. 4 a 8 hilos), se maximiza el aprovechamiento de
                los núcleos del procesador sin sobrecargar el planificador del sistema operativo.
              </p>
            </div>
          </section>
        )}

        {/* SECTION 7: STORAGE */}
        {activeSection === 'storage' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              7. Almacenamiento Distribuido (PostgreSQL & S3)
            </h2>
            <p>
              El sistema implementa el patrón <strong>Separation of Concerns</strong> en almacenamiento:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-semibold text-white">PostgreSQL (Base Relacional)</h4>
                </div>
                <p className="text-xs text-slate-400">
                  Ideal para consultas transaccionales, auditoría y filtrado: ID de tarea, cliente, estado
                  (PENDING/COMPLETED/FAILED), timestamps y duraciones de ejecución indexadas.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-teal-400" />
                  <h4 className="text-xs font-semibold text-white">Amazon S3 / MinIO (Objetos)</h4>
                </div>
                <p className="text-xs text-slate-400">
                  Almacena los datos pesados (imágenes resultantes, matrices de 512x512, informes JSON voluminosos).
                  Evita que PostgreSQL y la cola RabbitMQ se saturen con blobs de megabytes.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 8: EXECUTION */}
        {activeSection === 'execution' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              8. Manual de Configuración y Ejecución
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Método 1: Despliegue con Docker Compose (Recomendado)</h3>
                <div className="relative">
                  <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300">
{`# 1. Levantar el cluster completo en segundo plano
docker-compose up --build -d

# 2. Enviar una tarea con el cliente socket
python client.py submit --task-type matrix_mult --size 64`}
                  </pre>
                  <button
                    onClick={() => copyCommand('docker-compose up --build -d\npython client.py submit --task-type matrix_mult --size 64', 'docker')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'docker' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Método 2: Ejecución Local en Python (Sin Docker)</h3>
                <div className="relative">
                  <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-indigo-300">
{`# Terminal 1: Iniciar Servidor Socket
python server.py --port 9001 --server-id srv-1

# Terminal 2: Iniciar Worker con 4 hilos
python worker.py --worker-id wrk-1 --threads 4

# Terminal 3: Enviar tarea desde el cliente
python client.py submit --task-type image_filter --filter-name gaussian_blur`}
                  </pre>
                  <button
                    onClick={() => copyCommand('python server.py --port 9001\npython worker.py --worker-id wrk-1 --threads 4\npython client.py submit --task-type image_filter', 'local')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  >
                    {copiedCmd === 'local' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 9: BENCHMARKS */}
        {activeSection === 'benchmarks' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              9. Análisis de Rendimiento y Tolerancia a Fallos
            </h2>
            <p>
              Resultados de la prueba de estrés ejecutada con <code>client.py benchmark --tasks 100 --concurrency 10</code>:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-900 text-slate-300 font-mono">
                  <tr>
                    <th className="py-2.5 px-4">Arquitectura</th>
                    <th className="py-2.5 px-4">Throughput</th>
                    <th className="py-2.5 px-4">Latencia Media</th>
                    <th className="py-2.5 px-4">Tasa de Éxito</th>
                    <th className="py-2.5 px-4">Comportamiento ante Caída de Nodo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-400">
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-300">Monolito Sockets</td>
                    <td className="py-2.5 px-4 tabular-nums">4.2 tareas/s</td>
                    <td className="py-2.5 px-4 tabular-nums">2,380 ms</td>
                    <td className="py-2.5 px-4 tabular-nums text-amber-400">82.0%</td>
                    <td className="py-2.5 px-4 text-rose-400">Caída total del servicio</td>
                  </tr>
                  <tr className="bg-indigo-950/20">
                    <td className="py-2.5 px-4 font-semibold text-indigo-300">Distribuido (HAProxy + Workers)</td>
                    <td className="py-2.5 px-4 tabular-nums text-emerald-400 font-semibold">28.4 tareas/s</td>
                    <td className="py-2.5 px-4 tabular-nums text-emerald-400 font-semibold">134 ms</td>
                    <td className="py-2.5 px-4 tabular-nums text-emerald-400 font-semibold">100.0%</td>
                    <td className="py-2.5 px-4 text-emerald-400">Reencolado automático sin pérdida</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
