import { ArchitectureNode, ArchitectureLink } from '../types';

export const ARCHITECTURE_NODES: ArchitectureNode[] = [
  // LAYER 1: CLIENTES
  {
    id: 'client_web',
    name: 'Cliente Web (SPA)',
    category: 'client',
    layer: 1,
    icon: 'Globe',
    protocol: 'WebSocket / HTTP',
    techStack: 'React / TypeScript / Browser Sockets',
    role: 'Interfaz gráfica de usuario para monitoreo en tiempo real, envío interactivo de tareas y visualización de resultados.',
    concurrencyModel: 'Event-driven, asíncrono en navegador con reconexión automática.',
    configurationSnippet: `const ws = new WebSocket("wss://api.distrib-system.internal:9000/ws");
ws.binaryType = "arraybuffer";
ws.onmessage = (event) => handleTaskResult(event.data);`,
    failureHandling: 'Buffer de reintento exponencial local y fallback a HTTP polling en caso de caída de socket.',
    scalabilityNotes: 'Servido vía CDN (Cloudflare/CloudFront); escala horizontalmente sin carga para el backend.',
    x: 80,
    y: 60,
    width: 220,
    height: 110,
  },
  {
    id: 'client_mobile',
    name: 'Cliente Móvil',
    category: 'client',
    layer: 1,
    icon: 'Smartphone',
    protocol: 'TCP Socket / TLS',
    techStack: 'Android (Kotlin) / iOS (Swift) Native Sockets',
    role: 'Captura de datos de campo, subida de fotos/telemetría y recepción de notificaciones de finalización de tareas.',
    concurrencyModel: 'Hilos en segundo plano (Coroutines / Grand Central Dispatch) sin bloquear la interfaz.',
    configurationSnippet: `val socket = Socket("lb.distrib-system.internal", 9000)
val outputStream = DataOutputStream(socket.getOutputStream())
outputStream.writeInt(payloadBytes.size)
outputStream.write(payloadBytes)`,
    failureHandling: 'Persistencia offline en SQLite local antes del envío; sincronización al recuperar conectividad.',
    scalabilityNotes: 'Manejo de estados de suspensión del SO móvil y conmutación transparente entre WiFi y red celular.',
    x: 80,
    y: 200,
    width: 220,
    height: 110,
  },
  {
    id: 'client_cli',
    name: 'Cliente CLI / Socket Puro',
    category: 'client',
    layer: 1,
    icon: 'Terminal',
    protocol: 'Raw TCP (Custom Protocol)',
    techStack: 'Python 3.11 / socket / struct',
    role: 'Herramienta de terminal para desarrolladores, scripts de batch automatizados y pruebas de estrés masivas.',
    concurrencyModel: 'Conexiones socket síncronas o multihilo (ThreadPoolExecutor) para benchmarks.',
    configurationSnippet: `client = DistributedSocketClient(host="127.0.0.1", port=9000)
result = client.send_task_sync("matrix_mult", {"size": 128})
print("Resultado:", result["result_summary"])`,
    failureHandling: 'Reintentos configurables con backoff aleatorio y timeouts de lectura/escritura de 35 segundos.',
    scalabilityNotes: 'Bajo footprint de memoria (<15MB); puede lanzar 500 instancias concurrentes por host.',
    x: 80,
    y: 340,
    width: 220,
    height: 110,
  },

  // LAYER 2: LOAD BALANCER
  {
    id: 'lb_haproxy',
    name: 'Balanceador de Carga (HAProxy / Nginx)',
    category: 'lb',
    layer: 2,
    icon: 'ShieldCheck',
    port: '9000 (TCP)',
    protocol: 'TCP Stream (Capa 4 OSI)',
    techStack: 'HAProxy 2.8 / Nginx Stream',
    role: 'Punto único de entrada (Single Point of Contact). Termina conexiones TCP y distribuye el tráfico hacia los gateways.',
    concurrencyModel: 'Arquitectura orientada a eventos no bloqueante (epoll en Linux); maneja hasta 100,000 conexiones concurrentes.',
    configurationSnippet: `frontend socket_inbound
    bind *:9000
    mode tcp
    default_backend socket_gateways

backend socket_gateways
    mode tcp
    balance roundrobin
    server gw1 10.0.1.10:9001 check inter 2000
    server gw2 10.0.1.11:9002 check inter 2000`,
    failureHandling: 'Health checks activos cada 2000ms. Si un gateway no responde en 3 checks consecutivos, se drena y retira automáticamente.',
    scalabilityNotes: 'Configuración en par activo-pasivo con Keepalived / VRRP para alta disponibilidad sin punto único de fallo.',
    x: 390,
    y: 190,
    width: 230,
    height: 130,
  },

  // LAYER 3: SOCKET GATEWAYS
  {
    id: 'gw_server_1',
    name: 'Socket Gateway #1',
    category: 'gateway',
    layer: 3,
    icon: 'Cpu',
    port: '9001 (TCP)',
    protocol: 'Length-Prefixed Binary + JSON',
    techStack: 'Python 3.11 / socketserver.ThreadingTCPServer',
    role: 'Desempaqueta las tramas binarias de 4 bytes + JSON, autentica peticiones, registra estado inicial en Postgres y publica en RabbitMQ.',
    concurrencyModel: 'Multihilo (1 hilo por conexión de socket activa) con reciclaje rápido tras encolar la tarea.',
    configurationSnippet: `server = DistributedSocketServer(("0.0.0.0", 9001), TaskSocketHandler, server_id="srv-1")
server.serve_forever()`,
    failureHandling: 'Si se desconecta el socket antes de completar la tarea, la transacción en Postgres queda registrada con log de advertencia.',
    scalabilityNotes: 'Completamente Stateless: se pueden instanciar N réplicas detrás de HAProxy simplemente añadiendo líneas en haproxy.cfg.',
    x: 710,
    y: 100,
    width: 230,
    height: 120,
  },
  {
    id: 'gw_server_2',
    name: 'Socket Gateway #2',
    category: 'gateway',
    layer: 3,
    icon: 'Cpu',
    port: '9002 (TCP)',
    protocol: 'Length-Prefixed Binary + JSON',
    techStack: 'Python 3.11 / socketserver.ThreadingTCPServer',
    role: 'Instancia réplica de ingesta para alta disponibilidad y absorción de picos de conexiones de clientes.',
    concurrencyModel: 'Multihilo (ThreadingTCPServer), conexión directa a RabbitMQ con canal persistente.',
    configurationSnippet: `server = DistributedSocketServer(("0.0.0.0", 9002), TaskSocketHandler, server_id="srv-2")
server.serve_forever()`,
    failureHandling: 'Detección automática de caída de conexión a RabbitMQ con reintentos antes de devolver código de error 503.',
    scalabilityNotes: 'Empaquetado en contenedor Docker idéntico a Gateway #1.',
    x: 710,
    y: 280,
    width: 230,
    height: 120,
  },

  // LAYER 4: MESSAGE QUEUE
  {
    id: 'rabbitmq_broker',
    name: 'Cola de Mensajes (RabbitMQ)',
    category: 'queue',
    layer: 4,
    icon: 'Layers',
    port: '5672 (AMQP) / 15672 (UI)',
    protocol: 'AMQP 0-9-1',
    techStack: 'RabbitMQ 3.13 / Erlang OTP',
    role: 'Desacopla de forma asíncrona la recepción de tareas de su ejecución. Amortigua picos de carga (backpressure) y gestiona prioridades.',
    concurrencyModel: 'Procesos ligeros concurrentes en máquina virtual Erlang (BEAM); persistencia a disco en colas durables.',
    configurationSnippet: `channel.queue_declare(queue="tasks.queue", durable=True)
channel.basic_publish(
    exchange="",
    routing_key="tasks.queue",
    body=json.dumps(envelope),
    properties=pika.BasicProperties(delivery_mode=2) # Persistente
)`,
    failureHandling: 'ACKs manuales (basic_ack). Si un worker se apaga abruptamente a mitad de cálculo, la tarea vuelve a la cola (requeue=True).',
    scalabilityNotes: 'Soporte para RabbitMQ Clustered con Quorum Queues para tolerancia a particiones de red (Raft consensus).',
    x: 1030,
    y: 190,
    width: 240,
    height: 130,
  },

  // LAYER 5: WORKER POOL SERVERS
  {
    id: 'worker_1',
    name: 'Worker Server #1 (Pool de Hilos)',
    category: 'worker',
    layer: 5,
    icon: 'Sliders',
    protocol: 'AMQP Consumer / Internal ThreadPool',
    techStack: 'Python 3.11 / ThreadPoolExecutor(max_workers=4)',
    role: 'Consume tareas de RabbitMQ, asigna hilos libres del pool, computa matrices/filtros/análisis y sube resultados a S3 y Postgres.',
    concurrencyModel: 'Pool multihilo concurrente (4 hilos de ejecución simultánea por nodo worker).',
    configurationSnippet: `with ThreadPoolExecutor(max_workers=4) as executor:
    while True:
        task = broker.consume_task()
        if task:
            executor.submit(process_task_job, task)`,
    failureHandling: 'Captura local de excepciones por hilo para que una tarea defectuosa no tumbe el proceso del worker ni a otros hilos.',
    scalabilityNotes: 'Escalamiento horizontal elástico (HPA en Kubernetes o réplicas en Docker Compose) según la profundidad de la cola.',
    x: 1360,
    y: 100,
    width: 250,
    height: 125,
  },
  {
    id: 'worker_2',
    name: 'Worker Server #2 (Pool de Hilos)',
    category: 'worker',
    layer: 5,
    icon: 'Sliders',
    protocol: 'AMQP Consumer / Internal ThreadPool',
    techStack: 'Python 3.11 / ThreadPoolExecutor(max_workers=4)',
    role: 'Nodo worker complementario en el clúster. Balanceo dinámico automático provisto por RabbitMQ (pull-based model).',
    concurrencyModel: 'Pool multihilo concurrente con prefetch_count=4 para evitar acaparamiento desbalanceado.',
    configurationSnippet: `channel.basic_qos(prefetch_count=4)
channel.basic_consume(queue='tasks.queue', on_message_callback=callback)`,
    failureHandling: 'Dead Letter Exchange (DLX) para tareas que fallan repetidamente más de 3 veces (evita bucles venenosos).',
    scalabilityNotes: 'Puede ejecutarse en máquinas con aceleración por GPU (CUDA) para tareas especializadas sin modificar el protocolo.',
    x: 1360,
    y: 280,
    width: 250,
    height: 125,
  },

  // LAYER 6: DISTRIBUTED STORAGE
  {
    id: 'storage_postgres',
    name: 'PostgreSQL (Metadatos & ACID)',
    category: 'storage',
    layer: 6,
    icon: 'Database',
    port: '5432 (SQL)',
    protocol: 'PostgreSQL Native Wire Protocol',
    techStack: 'PostgreSQL 16 / psycopg2',
    role: 'Almacena el estado transaccional, auditoría, marcas de tiempo, identidades de clientes y métricas de rendimiento con garantías ACID.',
    concurrencyModel: 'MVCC (Multi-Version Concurrency Control) con Connection Pooling (PgBouncer).',
    configurationSnippet: `CREATE TABLE distributed_tasks (
    task_id VARCHAR(64) PRIMARY KEY,
    client_id VARCHAR(64) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    duration_ms REAL,
    s3_artifact_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
    failureHandling: 'Replicación Streaming Primario-Secundario con failover automático (Patroni / Pgpool-II).',
    scalabilityNotes: 'Particionado de tablas por fecha y almacenamiento indexado en disco NVMe para consultas <2ms.',
    x: 1710,
    y: 90,
    width: 240,
    height: 130,
  },
  {
    id: 'storage_s3',
    name: 'Amazon S3 / MinIO (Artefactos Blobs)',
    category: 'storage',
    layer: 6,
    icon: 'HardDrive',
    port: '9000 (S3 REST)',
    protocol: 'HTTPS / AWS S3 API REST',
    techStack: 'MinIO / AWS S3 Object Storage',
    role: 'Almacena los datos pesados y artefactos generados (matrices gigantes, imágenes filtradas, volcados CSV de agregación).',
    concurrencyModel: 'Almacenamiento distribuido masivo de objetos con soporte para subidas multiparte concurrentes.',
    configurationSnippet: `s3_client.put_object(
    Bucket="distributed-tasks",
    Key="artifacts/task-1234.json",
    Body=json_bytes,
    ContentType="application/json"
)`,
    failureHandling: 'Erasure Coding distribuido: tolera la pérdida de hasta la mitad de los discos de datos sin pérdida de bytes.',
    scalabilityNotes: 'Escalamiento petabyte virtualmente ilimitado; URLs prefirmadas directas para que los clientes descarguen sin saturar servidores.',
    x: 1710,
    y: 280,
    width: 240,
    height: 130,
  },
];

export const ARCHITECTURE_LINKS: ArchitectureLink[] = [
  // Clientes a HAProxy
  { id: 'l1', source: 'client_web', target: 'lb_haproxy', protocol: 'TCP :9000', label: 'WebSocket / TCP', description: 'Cliente web establece conexión al puerto público del balanceador.' },
  { id: 'l2', source: 'client_mobile', target: 'lb_haproxy', protocol: 'TCP :9000', label: 'TCP Socket Puro', description: 'Cliente móvil transmite tramas con prefijo de longitud de 4 bytes.' },
  { id: 'l3', source: 'client_cli', target: 'lb_haproxy', protocol: 'TCP :9000', label: 'TCP Socket Puro', description: 'CLI automatizado o scripts de prueba envían lotes de tareas.' },

  // HAProxy a Gateways
  { id: 'l4', source: 'lb_haproxy', target: 'gw_server_1', protocol: 'TCP :9001', label: 'Round-Robin Stream', description: 'HAProxy reenvía flujo L4 al Gateway #1 con health check.' },
  { id: 'l5', source: 'lb_haproxy', target: 'gw_server_2', protocol: 'TCP :9002', label: 'Round-Robin Stream', description: 'HAProxy balancea la siguiente conexión TCP hacia Gateway #2.' },

  // Gateways a RabbitMQ
  { id: 'l6', source: 'gw_server_1', target: 'rabbitmq_broker', protocol: 'AMQP :5672', label: 'publish(tasks.queue)', description: 'Gateway #1 publica sobre "tasks.queue" con delivery_mode=2.' },
  { id: 'l7', source: 'gw_server_2', target: 'rabbitmq_broker', protocol: 'AMQP :5672', label: 'publish(tasks.queue)', description: 'Gateway #2 publica sobre "tasks.queue" con delivery_mode=2.' },

  // Gateways a Postgres (registro de creación)
  { id: 'l8', source: 'gw_server_1', target: 'storage_postgres', protocol: 'SQL :5432', label: 'INSERT PENDING', description: 'Registra la metadata de la tarea inmediatamente al recibir el socket.' },
  { id: 'l9', source: 'gw_server_2', target: 'storage_postgres', protocol: 'SQL :5432', label: 'INSERT PENDING', description: 'Registra la metadata de la tarea inmediatamente al recibir el socket.' },

  // RabbitMQ a Workers
  { id: 'l10', source: 'rabbitmq_broker', target: 'worker_1', protocol: 'AMQP :5672', label: 'consume(prefetch=4)', description: 'Worker #1 extrae tareas de la cola hacia su ThreadPool.' },
  { id: 'l11', source: 'rabbitmq_broker', target: 'worker_2', protocol: 'AMQP :5672', label: 'consume(prefetch=4)', description: 'Worker #2 extrae tareas de la cola hacia su ThreadPool.' },

  // Workers a Storage
  { id: 'l12', source: 'worker_1', target: 'storage_postgres', protocol: 'SQL :5432', label: 'UPDATE COMPLETED', description: 'Guarda métricas de tiempo de ejecución y estado final.' },
  { id: 'l13', source: 'worker_2', target: 'storage_postgres', protocol: 'SQL :5432', label: 'UPDATE COMPLETED', description: 'Guarda métricas de tiempo de ejecución y estado final.' },
  { id: 'l14', source: 'worker_1', target: 'storage_s3', protocol: 'S3 REST :9000', label: 'PUT Object (Blob)', description: 'Sube matrices serializadas o artefactos pesados a MinIO/S3.' },
  { id: 'l15', source: 'worker_2', target: 'storage_s3', protocol: 'S3 REST :9000', label: 'PUT Object (Blob)', description: 'Sube matrices serializadas o artefactos pesados a MinIO/S3.' },

  // Workers a RabbitMQ (results)
  { id: 'l16', source: 'worker_1', target: 'rabbitmq_broker', protocol: 'AMQP :5672', label: 'publish(results.queue)', description: 'Worker #1 emite evento de finalización a cola de resultados.' },
  { id: 'l17', source: 'worker_2', target: 'rabbitmq_broker', protocol: 'AMQP :5672', label: 'publish(results.queue)', description: 'Worker #2 emite evento de finalización a cola de resultados.' },
];

export const FLOW_STAGES = [
  {
    step: 1,
    title: '1. Emisión del Socket desde el Cliente',
    activeNodes: ['client_cli', 'client_mobile', 'client_web'],
    activeLinks: ['l1', 'l2', 'l3'],
    summary: 'El cliente empaqueta el payload JSON con un prefijo binario de 4 bytes (Big-Endian uint32) y abre conexión TCP al puerto 9000.',
    detail: 'Evita la fragmentación de TCP gracias a la lectura exacta de bytes en destino (read_exact).'
  },
  {
    step: 2,
    title: '2. Balanceo de Carga L4 (HAProxy)',
    activeNodes: ['lb_haproxy'],
    activeLinks: ['l4', 'l5'],
    summary: 'HAProxy recibe el socket en Capa 4, consulta el algoritmo Round-Robin y reenvía el stream TCP al Socket Gateway 1 o 2.',
    detail: 'El balanceo a nivel TCP es transparente, con latencia mínima (<0.5ms) y sin overhead de parseo HTTP.'
  },
  {
    step: 3,
    title: '3. Ingesta, Framing y Registro en Gateway',
    activeNodes: ['gw_server_1', 'gw_server_2', 'storage_postgres'],
    activeLinks: ['l6', 'l7', 'l8', 'l9'],
    summary: 'El Socket Gateway lee los 4 bytes de encabezado, decodifica el JSON UTF-8, escribe registro PENDING en Postgres y publica en RabbitMQ.',
    detail: 'La tarea queda persistida inmediatamente en base de datos para auditoría y trazabilidad ante caídas.'
  },
  {
    step: 4,
    title: '4. Amortiguación y Encolado en RabbitMQ',
    activeNodes: ['rabbitmq_broker'],
    activeLinks: ['l10', 'l11'],
    summary: 'RabbitMQ almacena el mensaje en la cola "tasks.queue" con bandera de durabilidad en disco y prefetch controlado.',
    detail: 'Desacopla la velocidad de llegada de clientes de la velocidad de cálculo de los workers (backpressure control).'
  },
  {
    step: 5,
    title: '5. Despacho y Computación en Pool de Hilos',
    activeNodes: ['worker_1', 'worker_2'],
    activeLinks: ['l12', 'l13', 'l14', 'l15'],
    summary: 'Un hilo desocupado del ThreadPoolExecutor toma la tarea y ejecuta el cómputo intensivo (matriz, filtro de imagen, hash, etc.).',
    detail: 'Permite saturar todos los núcleos disponibles de CPU sin bloquear el canal de escucha AMQP.'
  },
  {
    step: 6,
    title: '6. Persistencia de Artefactos (S3) y Estado (PostgreSQL)',
    activeNodes: ['storage_postgres', 'storage_s3'],
    activeLinks: ['l16', 'l17'],
    summary: 'El worker sube los archivos de salida a MinIO/S3 y actualiza el registro en PostgreSQL a COMPLETED con la duración en ms.',
    detail: 'Separación estricta de responsabilidades: PostgreSQL maneja datos relacionales y S3 maneja archivos voluminosos.'
  },
  {
    step: 7,
    title: '7. Notificación de Resultado al Cliente Socket',
    activeNodes: ['rabbitmq_broker', 'gw_server_1', 'client_cli'],
    activeLinks: ['l4', 'l3'],
    summary: 'El resultado es reenviado por el Gateway a través del socket TCP abierto original hacia el cliente.',
    detail: 'El cliente recibe el resultado desempaquetado en formato JSON estructurado con el URL del artefacto y métricas.'
  }
];
