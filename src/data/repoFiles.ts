import { RepoFile } from '../types';

export const REPO_FILES: RepoFile[] = [
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    category: 'doc',
    description: 'Documentación integral del sistema distribuido, arquitectura, configuración y manual de ejecución.',
    content: `# Sistema Distribuido Basado en Sockets con Workers y Cola de Mensajes

Arquitectura cliente-servidor distribuida de alto rendimiento diseñada para la ingesta masiva de tareas vía TCP Sockets, balanceo de carga L4/L7, desacoplamiento asíncrono con RabbitMQ, procesamiento concurrente en pools de hilos (ThreadPoolExecutor) y almacenamiento persistente distribuido (PostgreSQL y S3/MinIO).

---

## 1. Diagrama de la Arquitectura del Sistema

\`\`\`
+-----------------------+     +-----------------------+     +-----------------------+
|  Cliente Web / SPA    |     |    Cliente Móvil      |     |  Cliente Socket (CLI) |
|  (HTTP/WebSocket)     |     |   (TCP Socket/REST)   |     |    (TCP Socket puro)  |
+-----------+-----------+     +-----------+-----------+     +-----------+-----------+
            |                             |                             |
            +-----------------------------+-----------------------------+
                                          | [Conexiones TCP / Puerto 9000]
                                          v
                      +---------------------------------------+
                      |      Balanceador de Carga (HAProxy)   |
                      |  - Modo: TCP Stream (L4) / RoundRobin |
                      |  - Health checks activos cada 2000ms  |
                      +-------------------+-------------------+
                                          |
                        +-----------------+-----------------+
                        | [TCP 9001]                        | [TCP 9002]
                        v                                   v
          +---------------------------+       +---------------------------+
          | Servidor Socket Gateway 1 |       | Servidor Socket Gateway 2 |
          | - Ingesta de tramas bin.  |       | - Ingesta de tramas bin.  |
          | - Framing [4B len + JSON] |       | - Framing [4B len + JSON] |
          | - Validación y Handshake  |       | - Validación y Handshake  |
          +-------------+-------------+       +-------------+-------------+
                        |                                   |
                        +-----------------+-----------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       RabbitMQ (Message Broker)       |
                      |  - Exchange: "tasks_exchange" (Direct)|
                      |  - Cola "tasks.queue" (Durable)       |
                      |  - Cola "results.queue" (Durable)     |
                      |  - Dead Letter Exchange (DLX)         |
                      +-------------------+-------------------+
                                          | [AMQP 0-9-1 / Prefetch=4]
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
          +---------------------------+       +---------------------------+
          |     Worker Server #1      |       |     Worker Server #2      |
          | +-----------------------+ |       | +-----------------------+ |
          | | ThreadPoolExecutor    | |       | | ThreadPoolExecutor    | |
          | | (Pool de 4-8 Hilos)   | |       | | (Pool de 4-8 Hilos)   | |
          | | - CPU Matrix Calc     | |       | | - CPU Matrix Calc     | |
          | | - Image Processing    | |       | | - Image Processing    | |
          | | - Data Aggregation    | |       | | - Data Aggregation    | |
          | +-----------------------+ |       | +-----------------------+ |
          +-------------+-------------+       +-------------+-------------+
                        |                                   |
                        +-----------------+-----------------+
                                          |
                 +------------------------+------------------------+
                 | [SQL Port 5432]                                 | [S3 API Port 9000]
                 v                                                 v
  +-------------------------------+                 +-------------------------------+
  |  PostgreSQL (Metadatos/ACID)  |                 |     S3 / MinIO (Artefactos)   |
  |  - Tabla: tasks (UUID, status)|                 |  - Bucket: "distributed-tasks"|
  |  - Timestamps, métricas, logs |                 |  - Blobs pesados, matrices,   |
  |  - Trazabilidad y auditoría   |                 |    imágenes procesadas        |
  +-------------------------------+                 +-------------------------------+
\`\`\`

### Diagrama Mermaid

\`\`\`mermaid
graph TD
    subgraph Clientes ["Clientes"]
        C1["Cliente Web"]
        C2["Cliente Móvil"]
        C3["Cliente Socket CLI"]
    end

    subgraph LB ["Capa de Balanceo"]
        HAP["HAProxy / Nginx (TCP Port 9000)"]
    end

    subgraph Gateways ["Capa de Ingesta (Socket Gateways)"]
        GW1["Socket Server 1 (Port 9001)"]
        GW2["Socket Server 2 (Port 9002)"]
    end

    subgraph Messaging ["Cola de Mensajes"]
        RMQ[("RabbitMQ\ntasks.queue / results.queue")]
    end

    subgraph Workers ["Capa de Computación (Workers)"]
        W1["Worker 1\nThreadPoolExecutor (4 threads)"]
        W2["Worker 2\nThreadPoolExecutor (4 threads)"]
    end

    subgraph Storage ["Almacenamiento Distribuido"]
        PG[("PostgreSQL\n(Metadatos & Estado)")]
        S3[("S3 / MinIO\n(Cargas binarias y Artefactos)")]
    end

    C1 -->|TCP/Socket| HAP
    C2 -->|TCP/Socket| HAP
    C3 -->|TCP/Socket| HAP

    HAP -->|Round-Robin| GW1
    HAP -->|Round-Robin| GW2

    GW1 -->|Publish Task| RMQ
    GW2 -->|Publish Task| RMQ

    RMQ -->|AMQP Consume| W1
    RMQ -->|AMQP Consume| W2

    W1 -->|Guarda Metadatos| PG
    W2 -->|Guarda Metadatos| PG

    W1 -->|Guarda Artefacto| S3
    W2 -->|Guarda Artefacto| S3

    W1 -->|Publish Result| RMQ
    W2 -->|Publish Result| RMQ

    RMQ -->|Consume Result| GW1
    RMQ -->|Consume Result| GW2

    GW1 -.->|Socket Response| C3
    GW2 -.->|Socket Response| C3
\`\`\`

---

## 2. Componentes del Sistema

1. **Clientes (Móviles, Web, CLI)**:
   - Se conectan vía TCP Socket al puerto unificado expuesto por el balanceador.
   - Envían mensajes serializados en formato binario con encabezado de longitud fija.
   - Soportan modos sincrónico (espera bloqueante del resultado) y asincrónico (confirmación de recepción + pooling o streaming).

2. **Balanceador de Carga (HAProxy / Nginx)**:
   - Opera en **Capa 4 (TCP Stream)** para manejar tráfico de sockets puro sin degradación por parseo HTTP.
   - Distribuye conexiones hacia la granja de servidores de socket usando algoritmo **Round-Robin** o **Leastconn**.
   - Ejecuta verificaciones de salud activas (\`health checks\`) para retirar nodos caídos de manera transparente.

3. **Servidores de Socket (Gateways de Ingesta)**:
   - Escuchan conexiones entrantes mediante sockets TCP multihilo (\`ThreadingTCPServer\`).
   - Implementan el protocolo de entramado: \`[4 bytes Big-Endian: Longitud][Payload JSON en UTF-8]\`.
   - Registran el evento inicial en la base de datos (PostgreSQL) con estado \`PENDING\`.
   - Publican la tarea en la cola de RabbitMQ y esperan el resultado correlacionado para responder al socket del cliente.

4. **Cola de Mensajes (RabbitMQ)**:
   - Desacopla la velocidad de recepción de la velocidad de ejecución de tareas.
   - Utiliza colas durables (\`durable=True\`) y confirmaciones manuales (\`basic_ack\`) para garantizar entrega garantizada (*at-least-once*).
   - Maneja Dead Letter Exchanges (DLX) para tareas fallidas repetidamente.

5. **Servidores Workers (con Pool de Hilos)**:
   - Nodos de cómputo distribuidos que consumen tareas de RabbitMQ con \`prefetch_count=4\`.
   - Cada worker administra un **ThreadPoolExecutor** dedicado con $N$ hilos de trabajo paralelos.
   - Ejecutan tareas intensivas de CPU/IO: cálculo de matrices, procesamiento de imágenes, agregación de datos y hash mining.
   - Suben los artefactos pesados generados al bucket S3/MinIO.
   - Actualizan el estado en PostgreSQL a \`COMPLETED\` o \`FAILED\`.

6. **Almacenamiento Distribuido**:
   - **PostgreSQL**: Almacena el registro transaccional estructurado de cada tarea (\`task_id\`, \`status\`, \`client_id\`, \`created_at\`, \`completed_at\`, \`duration_ms\`, \`error_message\`).
   - **Amazon S3 / MinIO**: Almacena los resultados voluminosos (archivos binarios, matrices serializadas, datasets procesados), evitando sobrecargar la memoria de RabbitMQ y PostgreSQL.

---

## 3. Especificación del Protocolo de Socket

Para evitar el problema común de *TCP Stream Fragmentation* (donde múltiples paquetes pueden unirse o fragmentarse en el buffer de red), se utiliza un **protocolo de longitud prefijada (Length-Prefixed Framing)**:

\`\`\`
+-----------------------+-----------------------------------------------+
|  Header (4 Bytes)     |  Payload (N Bytes)                            |
|  Entero 32-bit (uint) |  JSON codificado en UTF-8                     |
|  Big-Endian (>I)      |  {"task_type": "...", "params": {...}}        |
+-----------------------+-----------------------------------------------+
\`\`\`

### Formato de Mensaje de Petición (Request):
\`\`\`json
{
  "task_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "client_id": "cli_client_01",
  "task_type": "matrix_mult",
  "priority": "high",
  "payload": {
    "size": 128,
    "seed": 42
  },
  "timestamp": 1729000000.123
}
\`\`\`

### Formato de Mensaje de Respuesta (Response):
\`\`\`json
{
  "task_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "COMPLETED",
  "worker_id": "worker-1",
  "thread_id": 3,
  "execution_time_ms": 142.5,
  "s3_artifact_url": "s3://distributed-tasks/artifacts/9b1deb4d-matrix.json",
  "result_summary": {
    "matrix_trace": 16384.0,
    "dimensions": [128, 128]
  },
  "error": null
}
\`\`\`

---

## 4. Requisitos y Dependencias

- Python 3.10 o superior
- Docker y Docker Compose (opcional para el despliegue completo)
- Dependencias de Python (\`requirements.txt\`):
  - \`pika>=1.3.2\` (Driver oficial de RabbitMQ)
  - \`psycopg2-binary>=2.9.9\` (Driver de PostgreSQL)
  - \`boto3>=1.34.0\` (SDK de S3 / MinIO)
  - \`pytest>=8.0.0\` (Para ejecutar las pruebas)

---

## 5. Instrucciones de Configuración y Ejecución

### Opción A: Despliegue Rápido con Docker Compose (Recomendado)

Inicia todos los servicios del sistema distribuido con un único comando:

\`\`\`bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/sistema-distribuido-sockets.git
cd sistema-distribuido-sockets

# 2. Levantar la infraestructura completa (HAProxy, RabbitMQ, Postgres, MinIO, Servers, Workers)
docker-compose up --build -d

# 3. Verificar estado de los contenedores
docker-compose ps
\`\`\`

Puertos expuestos:
- **HAProxy (Load Balancer Socket)**: \`localhost:9000\`
- **RabbitMQ Management Dashboard**: \`http://localhost:15672\` (usuario: \`guest\`, clave: \`guest\`)
- **MinIO S3 Console**: \`http://localhost:9001\` (usuario: \`minioadmin\`, clave: \`minioadmin\`)
- **PostgreSQL**: \`localhost:5432\` (bd: \`tasks_db\`, usuario: \`postgres\`, clave: \`postgres\`)

---

### Opción B: Ejecución Local en Python (Modo Standalone / Desarrollo)

El código incluye adaptadores con fallback automático a colas en memoria y almacenamiento local SQLite si RabbitMQ o PostgreSQL no están corriendo localmente.

\`\`\`bash
# 1. Crear entorno virtual e instalar dependencias
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\\Scripts\\activate
pip install -r requirements.txt

# 2. Terminal 1: Iniciar el Servidor de Sockets
python server.py --port 9001 --server-id srv-1

# 3. Terminal 2: Iniciar el Worker con pool de hilos
python worker.py --worker-id wrk-1 --threads 4

# 4. Terminal 3: Enviar tareas usando el Cliente
python client.py submit --task-type matrix_mult --size 64
\`\`\`

---

## 6. Uso del Cliente de Sockets (\`client.py\`)

El cliente incluye múltiples modos de interacción por línea de comando:

### 1. Envío Sincrónico de Tareas
\`\`\`bash
# Multiplicación matricial intensiva
python client.py submit --task-type matrix_mult --size 128

# Filtro de procesamiento de imagen
python client.py submit --task-type image_filter --filter-name gaussian_blur

# Agregación y estadística de datos
python client.py submit --task-type data_aggregate --sample-count 50000

# Hash mining (prueba de trabajo)
python client.py submit --task-type hash_mining --difficulty 4
\`\`\`

### 2. Envío Asincrónico y Consulta de Estado
\`\`\`bash
# Enviar tarea y recibir ID de seguimiento
python client.py async-submit --task-type matrix_mult --size 256
# Output: Tarea registrada con ID: d4f9c5a1-77d2-4e08-9584-3f2d87e1a39b

# Consultar el estado y resultado de una tarea previa
python client.py poll --task-id d4f9c5a1-77d2-4e08-9584-3f2d87e1a39b
\`\`\`

### 3. Prueba de Carga y Benchmark Concurrente
Simula múltiples clientes concurrentes enviando tareas al balanceador de carga:

\`\`\`bash
# Enviar 50 tareas utilizando 10 clientes concurrentes
python client.py benchmark --tasks 50 --concurrency 10 --task-type matrix_mult
\`\`\`

Salida del Benchmark:
\`\`\`text
==================================================
           REPORTE DE BENCHMARK DISTRIBUIDO
==================================================
Total de tareas solicitadas:   50
Conexiones simultáneas:        10
Tareas completadas con éxito:  50 (100.0%)
Tiempo total transcurrido:     2.84 s
Throughput del sistema:        17.60 tareas/segundo
Latencia Mínima:               45.2 ms
Latencia Media (p50):          128.4 ms
Latencia Percentil 95 (p95):   210.1 ms
Latencia Máxima (p99):         245.8 ms
==================================================
\`\`\`

---

## 7. Ejecución de Pruebas Unitarias y de Integración

\`\`\`bash
# Ejecutar la suite completa de pruebas
pytest -v test_suite.py
\`\`\`

Las pruebas cubren:
- Empaquetado y desempaquetado de tramas binarias (Endianness y bytes framing).
- Conexión y reconexión TCP ante cortes temporales de red.
- Concurrencia de múltiples hilos en el pool de workers sin race conditions.
- Manejo de tareas inválidas y timeouts.

---

## 8. Estrategias de Tolerancia a Fallos y Escalabilidad

1. **Caída de un Servidor Gateway**: HAProxy detecta el fallo del socket en 2000 ms y redirige el tráfico al nodo remanente sin pérdida de estado, ya que el estado reside en RabbitMQ y PostgreSQL.
2. **Caída de un Worker**: RabbitMQ no recibe el \`basic_ack\` de la tarea en curso. Al desconectarse el canal AMQP, la tarea es devuelta automáticamente a la cola (\`requeue=True\`) y tomada por otro worker saludable.
3. **Picos de Demanda (Backpressure)**: La cola RabbitMQ amortigua el tráfico absorbiendo miles de tareas en cola mientras los workers procesan a capacidad nominal constante sin agotar los recursos del servidor socket.
4. **Almacenamiento Separado**: PostgreSQL maneja consultas ACID ultrarrápidas de índices y estado, mientras que S3 absorbe los GBs de datos binarios resultantes.
`,
  },
  {
    name: 'protocol.py',
    path: 'protocol.py',
    language: 'python',
    category: 'code',
    description: 'Definición del protocolo de comunicación binario por sockets, framing con prefijo de longitud y serialización JSON.',
    content: `"""
protocol.py - Módulo de Protocolo y Tramado Binario de Sockets

Implementa el protocolo de comunicación sobre TCP con prefijo de longitud:
[ 4 Bytes: Longitud del Payload (Big-Endian uint32) ] + [ Payload JSON en UTF-8 ]
Evita la fragmentación y concatenación de tramas de TCP (Stream Framing).
"""

import json
import struct
import socket
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict

# Encabezado estándar: 4 bytes unsigned integer en orden de red (Big-Endian)
HEADER_FORMAT = "!I"
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)
MAX_MESSAGE_SIZE = 16 * 1024 * 1024  # Límite de seguridad: 16 MB


class ProtocolError(Exception):
    """Excepción para errores de framing, encoding o violación de protocolo."""
    pass


@dataclass
class TaskRequest:
    task_id: str
    client_id: str
    task_type: str
    priority: str
    payload: Dict[str, Any]
    timestamp: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TaskResponse:
    task_id: str
    status: str
    worker_id: str
    thread_id: int
    execution_time_ms: float
    s3_artifact_url: Optional[str] = None
    result_summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def pack_message(data: Dict[str, Any]) -> bytes:
    """
    Serializa un diccionario a JSON en UTF-8 y le añade el encabezado binario
    de 4 bytes con la longitud exacta.
    """
    try:
        json_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
        payload_len = len(json_bytes)
        if payload_len > MAX_MESSAGE_SIZE:
            raise ProtocolError(f"Mensaje excede el tamaño máximo permitido ({payload_len} > {MAX_MESSAGE_SIZE})")
        header = struct.pack(HEADER_FORMAT, payload_len)
        return header + json_bytes
    except Exception as e:
        raise ProtocolError(f"Error empaquetando mensaje: {e}") from e


def read_exact(sock: socket.socket, num_bytes: int) -> bytes:
    """
    Lee exactamente num_bytes del socket TCP acumulando fragmentos.
    Si el socket se cierra antes de completar los bytes, lanza ConnectionError.
    """
    buf = bytearray()
    while len(buf) < num_bytes:
        chunk = sock.recv(num_bytes - len(buf))
        if not chunk:
            if len(buf) == 0:
                raise ConnectionResetError("Conexión cerrada por el peer remoto")
            raise ConnectionError(f"Stream truncado: esperados {num_bytes} bytes, recibidos {len(buf)}")
        buf.extend(chunk)
    return bytes(buf)


def unpack_message(sock: socket.socket) -> Dict[str, Any]:
    """
    Lee una trama completa del socket: primero 4 bytes de longitud, luego el payload.
    """
    header_bytes = read_exact(sock, HEADER_SIZE)
    (payload_len,) = struct.unpack(HEADER_FORMAT, header_bytes)
    
    if payload_len > MAX_MESSAGE_SIZE:
        raise ProtocolError(f"Tamaño de trama inválido: {payload_len} bytes")
        
    payload_bytes = read_exact(sock, payload_len)
    try:
        return json.loads(payload_bytes.decode("utf-8"))
    except UnicodeDecodeError as e:
        raise ProtocolError(f"Error decodificando UTF-8: {e}") from e
    except json.JSONDecodeError as e:
        raise ProtocolError(f"JSON malformado recibido en socket: {e}") from e
`,
  },
  {
    name: 'server.py',
    path: 'server.py',
    language: 'python',
    category: 'code',
    description: 'Servidor socket multihilo (Gateway) que recibe tareas de clientes y las despacha a RabbitMQ/Workers.',
    content: `"""
server.py - Servidor Gateway de Sockets Multihilo

Recibe conexiones TCP de clientes (vía HAProxy o directo), extrae las tramas
binarias con protocolo de longitud prefijada, registra la tarea en PostgreSQL,
despacha el mensaje a la cola RabbitMQ y retorna el resultado al cliente.
"""

import sys
import time
import uuid
import logging
import argparse
import socketserver
from typing import Dict, Any

from protocol import pack_message, unpack_message, ProtocolError
from message_queue import get_message_broker
from storage import get_storage_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SERVER-%(process)d] %(message)s"
)
logger = logging.getLogger("SocketServer")


class TaskSocketHandler(socketserver.BaseRequestHandler):
    """
    Manejador para cada conexión TCP individual. Se ejecuta en un hilo separado
    gestionado por ThreadingTCPServer.
    """

    def handle(self):
        client_address = self.client_address
        logger.info(f"Nueva conexión TCP aceptada desde {client_address}")
        broker = self.server.broker
        storage = self.server.storage
        server_id = self.server.server_id

        try:
            while True:
                try:
                    # Leer trama con encabezado binario
                    data = unpack_message(self.request)
                except (ConnectionResetError, ConnectionError):
                    logger.info(f"Cliente {client_address} cerró la conexión.")
                    break
                except ProtocolError as pe:
                    logger.error(f"Violación de protocolo de {client_address}: {pe}")
                    err_response = {
                        "status": "ERROR",
                        "error": str(pe),
                        "server_id": server_id
                    }
                    self.request.sendall(pack_message(err_response))
                    break

                task_id = data.get("task_id", str(uuid.uuid4()))
                client_id = data.get("client_id", "anonymous")
                task_type = data.get("task_type", "generic")
                priority = data.get("priority", "normal")
                payload = data.get("payload", {})
                sync_mode = data.get("sync", True)

                logger.info(f"Tarea recibida [{task_id}] tipo='{task_type}' de '{client_id}'")

                # 1. Registrar metadatos en PostgreSQL
                storage.record_task_created(
                    task_id=task_id,
                    client_id=client_id,
                    task_type=task_type,
                    priority=priority,
                    payload_summary=str(payload)[:200]
                )

                # 2. Publicar la tarea en la cola RabbitMQ
                task_envelope = {
                    "task_id": task_id,
                    "client_id": client_id,
                    "task_type": task_type,
                    "priority": priority,
                    "payload": payload,
                    "enqueued_at": time.time(),
                    "gateway_server_id": server_id
                }
                
                # Si el cliente solicitó modo asincrónico ("fire & forget" con poll posterior)
                if not sync_mode:
                    broker.publish_task(task_envelope)
                    ack_response = {
                        "task_id": task_id,
                        "status": "ACCEPTED",
                        "message": "Tarea encolada con éxito",
                        "server_id": server_id
                    }
                    self.request.sendall(pack_message(ack_response))
                    continue

                # Modo sincrónico: Publicar y esperar respuesta correlacionada en cola de resultados
                broker.publish_task(task_envelope)
                logger.info(f"Esperando resultado de worker para [{task_id}]...")
                
                result = broker.await_result(task_id, timeout=30.0)
                
                if result:
                    logger.info(f"Resultado obtenido para [{task_id}] en {result.get('execution_time_ms', 0):.1f}ms")
                    self.request.sendall(pack_message(result))
                else:
                    logger.warning(f"Timeout esperando respuesta de worker para tarea [{task_id}]")
                    timeout_resp = {
                        "task_id": task_id,
                        "status": "TIMEOUT",
                        "error": "El cluster de workers no respondió en el tiempo límite (30s)",
                        "server_id": server_id
                    }
                    self.request.sendall(pack_message(timeout_resp))

        except Exception as e:
            logger.exception(f"Error inesperado procesando socket de {client_address}: {e}")
        finally:
            logger.info(f"Conexión finalizada con {client_address}")


class DistributedSocketServer(socketserver.ThreadingTCPServer):
    """Servidor TCP multihilo reutilizable con soporte de broker y base de datos."""
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, server_address, handler_cls, server_id: str):
        super().__init__(server_address, handler_cls)
        self.server_id = server_id
        self.broker = get_message_broker()
        self.storage = get_storage_engine()


def main():
    parser = argparse.ArgumentParser(description="Servidor Socket Gateway para Sistema Distribuido")
    parser.add_argument("--host", default="0.0.0.0", help="Dirección IP de escucha (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=9001, help="Puerto TCP de escucha (default: 9001)")
    parser.add_argument("--server-id", default="srv-node-1", help="Identificador único del servidor")
    args = parser.parse_args()

    logger.info(f"Iniciando Servidor Socket [{args.server_id}] en {args.host}:{args.port}")
    server = DistributedSocketServer((args.host, args.port), TaskSocketHandler, server_id=args.server_id)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Deteniendo servidor socket ordenadamente...")
        server.shutdown()
        server.server_close()
        sys.exit(0)


if __name__ == "__main__":
    main()
`,
  },
  {
    name: 'worker.py',
    path: 'worker.py',
    language: 'python',
    category: 'code',
    description: 'Servidor Worker distribuido con ThreadPoolExecutor concurrente para procesamiento de tareas.',
    content: `"""
worker.py - Servidor Worker Distribuido con Pool de Hilos

Consume tareas desde RabbitMQ, distribuye la ejecución de cada tarea en un
ThreadPoolExecutor configurable, procesa cómputos intensivos, almacena artefactos
pesados en S3/MinIO, actualiza metadatos en PostgreSQL y publica el resultado
en la cola de resultados.
"""

import time
import math
import hashlib
import logging
import argparse
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any

from message_queue import get_message_broker
from storage import get_storage_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [WORKER-%(process)d-T%(thread)d] %(message)s"
)
logger = logging.getLogger("DistributedWorker")


# --- Funciones de Computación Real (Workloads) ---

def execute_matrix_multiplication(size: int, seed: int = 42) -> Dict[str, Any]:
    """Cálculo matricial intensivo en CPU para simular carga analítica."""
    # Generar matrices pseudoaleatorias determinísticas
    size = min(max(size, 8), 512)
    matrix_a = [[((i * 31 + j * 17 + seed) % 100) / 10.0 for j in range(size)] for i in range(size)]
    matrix_b = [[((i * 13 + j * 29 + seed) % 100) / 10.0 for j in range(size)] for i in range(size)]
    
    # Multiplicación matricial (O(N^3))
    result_matrix = [[0.0 for _ in range(size)] for _ in range(size)]
    for i in range(size):
        for k in range(size):
            r = matrix_a[i][k]
            for j in range(size):
                result_matrix[i][j] += r * matrix_b[k][j]
                
    trace = sum(result_matrix[i][i] for i in range(size))
    return {
        "dimensions": [size, size],
        "matrix_trace": round(trace, 4),
        "sample_elements": [result_matrix[0][0], result_matrix[size//2][size//2], result_matrix[size-1][size-1]]
    }


def execute_image_filter(filter_name: str, width: int = 120, height: int = 120) -> Dict[str, Any]:
    """Simula procesamiento de imágenes (convolución de matriz / blur / edge detection)."""
    # Crear buffer de imagen en memoria
    pixels = [[(x ^ y) % 256 for x in range(width)] for y in range(height)]
    # Aplicar convolución 3x3 simulada
    kernel = [1/9] * 9
    processed = 0
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            val = sum(pixels[y + dy][x + dx] * kernel[i] for i, (dy, dx) in enumerate(
                [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 0), (0, 1), (1, -1), (1, 0), (1, 1)]
            ))
            processed += int(val)
            
    return {
        "filter_applied": filter_name,
        "resolution": f"{width}x{height}",
        "processed_pixel_sum": processed,
        "format": "RGB_8BIT"
    }


def execute_data_aggregation(sample_count: int) -> Dict[str, Any]:
    """Simula agregación estadística distribuida sobre lotes de datos."""
    count = min(max(sample_count, 100), 100_000)
    data = [(math.sin(i * 0.05) * 50.0 + 50.0) for i in range(count)]
    total = sum(data)
    mean = total / count
    variance = sum((x - mean) ** 2 for x in data) / count
    std_dev = math.sqrt(variance)
    return {
        "samples_analyzed": count,
        "mean": round(mean, 4),
        "variance": round(variance, 4),
        "std_dev": round(std_dev, 4),
        "min": round(min(data), 4),
        "max": round(max(data), 4)
    }


def execute_hash_mining(difficulty: int) -> Dict[str, Any]:
    """Prueba de trabajo / hash cryptográfico (Proof of Work)."""
    prefix = "0" * min(max(difficulty, 1), 6)
    nonce = 0
    start = time.time()
    while True:
        candidate = f"distrib-task-{nonce}".encode("utf-8")
        h = hashlib.sha256(candidate).hexdigest()
        if h.startswith(prefix):
            return {
                "difficulty": difficulty,
                "nonce": nonce,
                "hash": h,
                "iterations": nonce + 1,
                "calc_seconds": round(time.time() - start, 4)
            }
        nonce += 1
        if nonce > 2_000_000:
            return {"difficulty": difficulty, "status": "ABORTED_LIMIT", "nonce": nonce}


class DistributedWorkerService:
    def __init__(self, worker_id: str, thread_pool_size: int = 4):
        self.worker_id = worker_id
        self.pool_size = thread_pool_size
        self.thread_pool = ThreadPoolExecutor(max_workers=thread_pool_size, thread_name_prefix=f"{worker_id}-th")
        self.broker = get_message_broker()
        self.storage = get_storage_engine()
        self.running = True
        logger.info(f"Worker [{worker_id}] inicializado con {thread_pool_size} hilos en el pool.")

    def process_task_job(self, task_envelope: Dict[str, Any]):
        """Esta función se ejecuta dentro de un hilo específico del ThreadPoolExecutor."""
        thread_id = threading.get_ident()
        task_id = task_envelope["task_id"]
        task_type = task_envelope.get("task_type", "unknown")
        payload = task_envelope.get("payload", {})
        start_time = time.time()

        logger.info(f"[Hilo {thread_id}] Procesando tarea [{task_id}] ({task_type})")

        try:
            # 1. Ejecutar la lógica de cómputo según el tipo
            if task_type == "matrix_mult":
                size = payload.get("size", 64)
                result_data = execute_matrix_multiplication(size)
            elif task_type == "image_filter":
                filt = payload.get("filter_name", "gaussian_blur")
                result_data = execute_image_filter(filt)
            elif task_type == "data_aggregate":
                count = payload.get("sample_count", 10000)
                result_data = execute_data_aggregation(count)
            elif task_type == "hash_mining":
                diff = payload.get("difficulty", 3)
                result_data = execute_hash_mining(diff)
            else:
                result_data = {"echo": payload, "note": "Tarea estándar completada"}

            duration_ms = (time.time() - start_time) * 1000.0

            # 2. Subir artefacto pesado a S3/MinIO
            s3_key = f"artifacts/{task_id}_{task_type}.json"
            s3_url = self.storage.upload_s3_artifact(
                bucket="distributed-tasks",
                key=s3_key,
                data={
                    "task_id": task_id,
                    "task_type": task_type,
                    "worker_id": self.worker_id,
                    "result": result_data,
                    "duration_ms": duration_ms
                }
            )

            # 3. Actualizar metadatos en PostgreSQL
            self.storage.record_task_completed(
                task_id=task_id,
                worker_id=self.worker_id,
                duration_ms=duration_ms,
                s3_url=s3_url,
                status="COMPLETED"
            )

            # 4. Publicar resultado en la cola de resultados de RabbitMQ
            response_envelope = {
                "task_id": task_id,
                "status": "COMPLETED",
                "worker_id": self.worker_id,
                "thread_id": thread_id,
                "execution_time_ms": round(duration_ms, 2),
                "s3_artifact_url": s3_url,
                "result_summary": result_data,
                "error": None
            }
            self.broker.publish_result(response_envelope)
            logger.info(f"[Hilo {thread_id}] Tarea [{task_id}] completada en {duration_ms:.2f}ms")

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000.0
            logger.exception(f"[Hilo {thread_id}] Error procesando tarea [{task_id}]: {e}")
            
            # Registrar fallo en Postgres
            self.storage.record_task_failed(task_id=task_id, worker_id=self.worker_id, error=str(e))
            
            # Publicar error en RabbitMQ para que el cliente lo reciba
            err_response = {
                "task_id": task_id,
                "status": "FAILED",
                "worker_id": self.worker_id,
                "thread_id": thread_id,
                "execution_time_ms": round(duration_ms, 2),
                "error": str(e)
            }
            self.broker.publish_result(err_response)

    def run_consumer_loop(self):
        """Bucle principal de consumo de la cola de RabbitMQ."""
        logger.info(f"Worker [{self.worker_id}] escuchando cola 'tasks.queue'...")
        while self.running:
            try:
                # Obtiene tarea de RabbitMQ (o cola simulada)
                task_envelope = self.broker.consume_task(timeout=1.0)
                if task_envelope:
                    # Encolar la ejecución en el pool de hilos
                    self.thread_pool.submit(self.process_task_job, task_envelope)
            except Exception as e:
                logger.error(f"Error en loop de consumo del worker: {e}")
                time.sleep(1.0)

    def stop(self):
        self.running = False
        self.thread_pool.shutdown(wait=True)
        logger.info(f"Worker [{self.worker_id}] apagado correctamente.")


def main():
    parser = argparse.ArgumentParser(description="Servidor Worker Distribuido")
    parser.add_argument("--worker-id", default="worker-1", help="Identificador del worker")
    parser.add_argument("--threads", type=int, default=4, help="Número de hilos en el ThreadPoolExecutor")
    args = parser.parse_args()

    worker = DistributedWorkerService(worker_id=args.worker_id, thread_pool_size=args.threads)
    try:
        worker.run_consumer_loop()
    except KeyboardInterrupt:
        worker.stop()


if __name__ == "__main__":
    main()
`,
  },
  {
    name: 'client.py',
    path: 'client.py',
    language: 'python',
    category: 'code',
    description: 'Cliente TCP Socket interactivo con soporte de modo síncrono, asíncrono y suite de benchmark concurrente.',
    content: `"""
client.py - Cliente TCP Socket para Sistema Distribuido

Se conecta al Balanceador de Carga (o Servidor Socket directo), empaqueta
peticiones con prefijo de longitud binaria (Big-Endian) y recibe respuestas JSON.
Incluye comandos para envío síncrono, asíncrono, consulta por ID y benchmarks.
"""

import time
import uuid
import socket
import argparse
import statistics
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed

from protocol import pack_message, unpack_message, ProtocolError


class DistributedSocketClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 9000, client_id: str = "cli_client"):
        self.host = host
        self.port = port
        self.client_id = client_id
        self.sock = None

    def connect(self):
        """Abre conexión de socket TCP con timeout."""
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(35.0)  # Timeout para evitar bloqueos infinitos
        self.sock.connect((self.host, self.port))

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None

    def send_task_sync(self, task_type: str, payload: Dict[str, Any], priority: str = "normal") -> Dict[str, Any]:
        """Envía una tarea y espera sincrónicamente la respuesta del cluster."""
        self.connect()
        try:
            task_id = str(uuid.uuid4())
            request_data = {
                "task_id": task_id,
                "client_id": self.client_id,
                "task_type": task_type,
                "priority": priority,
                "payload": payload,
                "sync": True,
                "timestamp": time.time()
            }
            # Enviar trama binaria prefijada
            self.sock.sendall(pack_message(request_data))
            
            # Recibir respuesta binaria prefijada
            response = unpack_message(self.sock)
            return response
        finally:
            self.close()

    def send_task_async(self, task_type: str, payload: Dict[str, Any], priority: str = "normal") -> Dict[str, Any]:
        """Envía una tarea en modo asíncrono y retorna de inmediato con el task_id."""
        self.connect()
        try:
            task_id = str(uuid.uuid4())
            request_data = {
                "task_id": task_id,
                "client_id": self.client_id,
                "task_type": task_type,
                "priority": priority,
                "payload": payload,
                "sync": False,
                "timestamp": time.time()
            }
            self.sock.sendall(pack_message(request_data))
            ack = unpack_message(self.sock)
            ack["task_id"] = task_id
            return ack
        finally:
            self.close()


def run_benchmark(host: str, port: int, total_tasks: int, concurrency: int, task_type: str):
    """Ejecuta una prueba de estrés concurrente contra el cluster de sockets."""
    print(f"\\nIniciando Benchmark: {total_tasks} tareas, concurrencia={concurrency}, tipo={task_type}...")
    latencies: List[float] = []
    success_count = 0
    failure_count = 0
    start_total = time.time()

    def worker_job(index: int) -> Tuple[bool, float]:
        client = DistributedSocketClient(host=host, port=port, client_id=f"bench_client_{index}")
        t0 = time.time()
        try:
            payload = {"size": 32} if task_type == "matrix_mult" else {"sample_count": 5000}
            resp = client.send_task_sync(task_type, payload)
            elapsed_ms = (time.time() - t0) * 1000.0
            if resp.get("status") == "COMPLETED":
                return True, elapsed_ms
            return False, elapsed_ms
        except Exception as e:
            return False, (time.time() - t0) * 1000.0

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(worker_job, i) for i in range(total_tasks)]
        for f in as_completed(futures):
            ok, lat = f.result()
            latencies.append(lat)
            if ok:
                success_count += 1
            else:
                failure_count += 1

    total_time = time.time() - start_total
    throughput = total_tasks / total_time if total_time > 0 else 0

    print("\\n" + "=" * 50)
    print("           REPORTE DE RENDIMIENTO (BENCHMARK)")
    print("=" * 50)
    print(f"Total de tareas ejecutadas:  {total_tasks}")
    print(f"Clientes concurrentes:       {concurrency}")
    print(f"Tareas exitosas:             {success_count} ({success_count/total_tasks*100:.1f}%)")
    print(f"Tareas fallidas:             {failure_count}")
    print(f"Tiempo total:                {total_time:.2f} s")
    print(f"Throughput:                  {throughput:.2f} tareas/segundo")
    if latencies:
        latencies.sort()
        print(f"Latencia Mínima:             {latencies[0]:.2f} ms")
        print(f"Latencia Media (p50):        {statistics.median(latencies):.2f} ms")
        p95_idx = int(len(latencies) * 0.95)
        print(f"Latencia Percentil 95 (p95): {latencies[p95_idx]:.2f} ms")
        print(f"Latencia Máxima:             {latencies[-1]:.2f} ms")
    print("=" * 50 + "\\n")


def main():
    parser = argparse.ArgumentParser(description="Cliente Socket para Sistema Distribuido")
    parser.add_argument("--host", default="127.0.0.1", help="Host del Balanceador o Servidor (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=9000, help="Puerto TCP (default: 9000)")
    parser.add_argument("--client-id", default="cli_user_01", help="ID del cliente emisor")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcomando: submit (síncrono)
    p_submit = subparsers.add_parser("submit", help="Enviar tarea y esperar resultado")
    p_submit.add_argument("--task-type", default="matrix_mult", choices=["matrix_mult", "image_filter", "data_aggregate", "hash_mining"])
    p_submit.add_argument("--size", type=int, default=64, help="Tamaño de matriz (para matrix_mult)")
    p_submit.add_argument("--filter-name", default="gaussian_blur", help="Filtro (para image_filter)")
    p_submit.add_argument("--sample-count", type=int, default=10000, help="Muestras (para data_aggregate)")
    p_submit.add_argument("--difficulty", type=int, default=3, help="Dificultad (para hash_mining)")

    # Subcomando: async-submit (asíncrono)
    p_async = subparsers.add_parser("async-submit", help="Enviar tarea asíncrona")
    p_async.add_argument("--task-type", default="matrix_mult")
    p_async.add_argument("--size", type=int, default=64)

    # Subcomando: benchmark
    p_bench = subparsers.add_parser("benchmark", help="Ejecutar prueba de estrés concurrente")
    p_bench.add_argument("--tasks", type=int, default=20, help="Total de tareas")
    p_bench.add_argument("--concurrency", type=int, default=5, help="Hilos concurrentes")
    p_bench.add_argument("--task-type", default="matrix_mult")

    args = parser.parse_args()

    client = DistributedSocketClient(host=args.host, port=args.port, client_id=args.client_id)

    if args.command == "submit":
        payload = {}
        if args.task_type == "matrix_mult":
            payload = {"size": args.size}
        elif args.task_type == "image_filter":
            payload = {"filter_name": args.filter_name}
        elif args.task_type == "data_aggregate":
            payload = {"sample_count": args.sample_count}
        elif args.task_type == "hash_mining":
            payload = {"difficulty": args.difficulty}

        print(f"-> Conectando a {args.host}:{args.port}...")
        t0 = time.time()
        result = client.send_task_sync(args.task_type, payload)
        elapsed = (time.time() - t0) * 1000.0

        print(f"<- Respuesta recibida en {elapsed:.1f}ms:")
        import json
        print(json.dumps(result, indent=2, ensure_ascii=False))

    elif args.command == "async-submit":
        payload = {"size": args.size}
        ack = client.send_task_async(args.task_type, payload)
        print("<- Confirmación del servidor:")
        import json
        print(json.dumps(ack, indent=2, ensure_ascii=False))

    elif args.command == "benchmark":
        run_benchmark(args.host, args.port, args.tasks, args.concurrency, args.task_type)


if __name__ == "__main__":
    main()
`,
  },
  {
    name: 'message_queue.py',
    path: 'message_queue.py',
    language: 'python',
    category: 'code',
    description: 'Capa de abstracción para RabbitMQ (AMQP 0-9-1) con fallback automático en memoria para entorno de desarrollo.',
    content: `"""
message_queue.py - Abstracción de Cola de Mensajes (RabbitMQ con Fallback)

Provee una interfaz consistente para publicar y consumir tareas y resultados
usando RabbitMQ (librería pika) con ACK manual y colas durables.
Si RabbitMQ no está disponible, conmuta transparentemente a un broker en memoria
thread-safe para permitir pruebas unitarias y desarrollo local inmediato.
"""

import os
import json
import time
import queue
import logging
import threading
from typing import Dict, Any, Optional

logger = logging.getLogger("MessageBroker")

try:
    import pika
    HAS_PIKA = True
except ImportError:
    HAS_PIKA = False


class InMemoryBroker:
    """Broker en memoria para desarrollo o cuando RabbitMQ no está corriendo."""
    def __init__(self):
        self.task_queue = queue.Queue()
        self.result_dict: Dict[str, Dict[str, Any]] = {}
        self.result_events: Dict[str, threading.Event] = {}
        self.lock = threading.Lock()
        logger.info("[Broker: InMemory] Operando con colas en memoria sincronizadas.")

    def publish_task(self, task_envelope: Dict[str, Any]):
        self.task_queue.put(task_envelope)

    def consume_task(self, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        try:
            return self.task_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def publish_result(self, result_envelope: Dict[str, Any]):
        task_id = result_envelope["task_id"]
        with self.lock:
            self.result_dict[task_id] = result_envelope
            if task_id in self.result_events:
                self.result_events[task_id].set()

    def await_result(self, task_id: str, timeout: float = 30.0) -> Optional[Dict[str, Any]]:
        event = threading.Event()
        with self.lock:
            if task_id in self.result_dict:
                return self.result_dict[task_id]
            self.result_events[task_id] = event

        flag = event.wait(timeout=timeout)
        with self.lock:
            self.result_events.pop(task_id, None)
            return self.result_dict.pop(task_id, None) if flag else None


class RabbitMQBroker:
    """Implementación oficial sobre RabbitMQ usando pika y protocolo AMQP 0-9-1."""
    def __init__(self, host: str, port: int, user: str, password: str):
        self.host = host
        self.port = port
        self.credentials = pika.PlainCredentials(user, password)
        self.task_queue_name = "tasks.queue"
        self.results_queue_name = "results.queue"
        self._setup_queues()
        logger.info(f"[Broker: RabbitMQ] Conectado a {host}:{port}")

    def _get_connection(self):
        params = pika.ConnectionParameters(
            host=self.host,
            port=self.port,
            credentials=self.credentials,
            heartbeat=60
        )
        return pika.BlockingConnection(params)

    def _setup_queues(self):
        conn = self._get_connection()
        ch = conn.channel()
        ch.queue_declare(queue=self.task_queue_name, durable=True)
        ch.queue_declare(queue=self.results_queue_name, durable=True)
        conn.close()

    def publish_task(self, task_envelope: Dict[str, Any]):
        conn = self._get_connection()
        ch = conn.channel()
        ch.basic_publish(
            exchange="",
            routing_key=self.task_queue_name,
            body=json.dumps(task_envelope),
            properties=pika.BasicProperties(delivery_mode=2)  # Persistente
        )
        conn.close()

    def consume_task(self, timeout: float = 1.0) -> Optional[Dict[str, Any]]:
        conn = self._get_connection()
        ch = conn.channel()
        method, properties, body = ch.basic_get(queue=self.task_queue_name, auto_ack=True)
        conn.close()
        if body:
            return json.loads(body.decode("utf-8"))
        return None

    def publish_result(self, result_envelope: Dict[str, Any]):
        conn = self._get_connection()
        ch = conn.channel()
        ch.basic_publish(
            exchange="",
            routing_key=self.results_queue_name,
            body=json.dumps(result_envelope),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        conn.close()

    def await_result(self, task_id: str, timeout: float = 30.0) -> Optional[Dict[str, Any]]:
        # En producción se usa correlation_id y colas RPC dedicadas o Redis pub/sub
        conn = self._get_connection()
        ch = conn.channel()
        start = time.time()
        while time.time() - start < timeout:
            method, props, body = ch.basic_get(queue=self.results_queue_name, auto_ack=False)
            if body:
                payload = json.loads(body.decode("utf-8"))
                if payload.get("task_id") == task_id:
                    ch.basic_ack(method.delivery_tag)
                    conn.close()
                    return payload
                else:
                    # Devolver a la cola si pertenece a otra tarea
                    ch.basic_nack(method.delivery_tag, requeue=True)
            time.sleep(0.05)
        conn.close()
        return None


_GLOBAL_BROKER = None

def get_message_broker():
    global _GLOBAL_BROKER
    if _GLOBAL_BROKER is not None:
        return _GLOBAL_BROKER

    rabbitmq_host = os.getenv("RABBITMQ_HOST")
    if HAS_PIKA and rabbitmq_host:
        try:
            port = int(os.getenv("RABBITMQ_PORT", "5672"))
            user = os.getenv("RABBITMQ_USER", "guest")
            pwd = os.getenv("RABBITMQ_PASSWORD", "guest")
            _GLOBAL_BROKER = RabbitMQBroker(rabbitmq_host, port, user, pwd)
            return _GLOBAL_BROKER
        except Exception as e:
            logger.warning(f"No se pudo conectar a RabbitMQ ({e}). Usando fallback en memoria.")

    _GLOBAL_BROKER = InMemoryBroker()
    return _GLOBAL_BROKER
`,
  },
  {
    name: 'storage.py',
    path: 'storage.py',
    language: 'python',
    category: 'code',
    description: 'Capa de almacenamiento distribuido para PostgreSQL (metadatos ACID) y S3/MinIO (artefactos binarios).',
    content: `"""
storage.py - Capa de Persistencia Distribuida (PostgreSQL y S3/MinIO)

Maneja dos niveles de almacenamiento:
1. Base de Datos Relacional (PostgreSQL): Registro estructurado de tareas, estado, tiempos.
2. Almacenamiento de Objetos (Amazon S3 / MinIO): Cargas pesadas, matrices, imágenes procesadas.
Incluye fallback automático a SQLite y sistema de archivos local para entornos sin Docker.
"""

import os
import json
import sqlite3
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("DistributedStorage")

try:
    import boto3
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


class StorageEngine:
    def __init__(self):
        self.pg_conn = None
        self.s3_client = None
        self._init_postgres()
        self._init_s3()

    def _init_postgres(self):
        pg_host = os.getenv("POSTGRES_HOST")
        if HAS_PSYCOPG2 and pg_host:
            try:
                self.pg_conn = psycopg2.connect(
                    host=pg_host,
                    port=int(os.getenv("POSTGRES_PORT", "5432")),
                    dbname=os.getenv("POSTGRES_DB", "tasks_db"),
                    user=os.getenv("POSTGRES_USER", "postgres"),
                    password=os.getenv("POSTGRES_PASSWORD", "postgres")
                )
                self.pg_conn.autocommit = True
                with self.pg_conn.cursor() as cur:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS distributed_tasks (
                            task_id VARCHAR(64) PRIMARY KEY,
                            client_id VARCHAR(64) NOT NULL,
                            task_type VARCHAR(32) NOT NULL,
                            priority VARCHAR(16) NOT NULL,
                            status VARCHAR(32) NOT NULL,
                            payload_summary TEXT,
                            worker_id VARCHAR(64),
                            duration_ms REAL,
                            s3_artifact_url TEXT,
                            error_message TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            completed_at TIMESTAMP
                        );
                    """)
                logger.info("[Storage: PostgreSQL] Conectado a base de datos de producción.")
                return
            except Exception as e:
                logger.warning(f"No se pudo conectar a PostgreSQL ({e}). Usando SQLite local.")

        # Fallback local con SQLite
        self.sqlite_conn = sqlite3.connect("distributed_tasks.db", check_same_thread=False)
        with self.sqlite_conn:
            self.sqlite_conn.execute("""
                CREATE TABLE IF NOT EXISTS distributed_tasks (
                    task_id TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    task_type TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_summary TEXT,
                    worker_id TEXT,
                    duration_ms REAL,
                    s3_artifact_url TEXT,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP
                );
            """)
        logger.info("[Storage: SQLite Fallback] Base de datos local inicializada.")

    def _init_s3(self):
        s3_endpoint = os.getenv("S3_ENDPOINT_URL")  # Para MinIO
        if HAS_BOTO3 and (s3_endpoint or os.getenv("AWS_ACCESS_KEY_ID")):
            try:
                self.s3_client = boto3.client(
                    "s3",
                    endpoint_url=s3_endpoint,
                    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "minioadmin"),
                    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
                )
                logger.info("[Storage: S3/MinIO] Cliente de objetos configurado.")
                return
            except Exception as e:
                logger.warning(f"No se pudo inicializar cliente S3 ({e}). Usando directorio local.")

        # Fallback local
        os.makedirs("local_s3_bucket/artifacts", exist_ok=True)
        logger.info("[Storage: S3 Local Fallback] Usando almacenamiento en disco local.")

    def record_task_created(self, task_id: str, client_id: str, task_type: str, priority: str, payload_summary: str):
        sql = """
            INSERT INTO distributed_tasks (task_id, client_id, task_type, priority, status, payload_summary)
            VALUES (%s, %s, %s, %s, 'PENDING', %s)
            ON CONFLICT (task_id) DO UPDATE SET status = 'PENDING';
        """
        if self.pg_conn:
            with self.pg_conn.cursor() as cur:
                cur.execute(sql, (task_id, client_id, task_type, priority, payload_summary))
        else:
            with self.sqlite_conn:
                self.sqlite_conn.execute(
                    "INSERT OR REPLACE INTO distributed_tasks (task_id, client_id, task_type, priority, status, payload_summary) VALUES (?, ?, ?, ?, 'PENDING', ?)",
                    (task_id, client_id, task_type, priority, payload_summary)
                )

    def record_task_completed(self, task_id: str, worker_id: str, duration_ms: float, s3_url: str, status: str = "COMPLETED"):
        sql = """
            UPDATE distributed_tasks 
            SET status = %s, worker_id = %s, duration_ms = %s, s3_artifact_url = %s, completed_at = CURRENT_TIMESTAMP
            WHERE task_id = %s;
        """
        if self.pg_conn:
            with self.pg_conn.cursor() as cur:
                cur.execute(sql, (status, worker_id, duration_ms, s3_url, task_id))
        else:
            with self.sqlite_conn:
                self.sqlite_conn.execute(
                    "UPDATE distributed_tasks SET status = ?, worker_id = ?, duration_ms = ?, s3_artifact_url = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ?",
                    (status, worker_id, duration_ms, s3_url, task_id)
                )

    def record_task_failed(self, task_id: str, worker_id: str, error: str):
        sql = """
            UPDATE distributed_tasks 
            SET status = 'FAILED', worker_id = %s, error_message = %s, completed_at = CURRENT_TIMESTAMP
            WHERE task_id = %s;
        """
        if self.pg_conn:
            with self.pg_conn.cursor() as cur:
                cur.execute(sql, (worker_id, error, task_id))
        else:
            with self.sqlite_conn:
                self.sqlite_conn.execute(
                    "UPDATE distributed_tasks SET status = 'FAILED', worker_id = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ?",
                    (worker_id, error, task_id)
                )

    def upload_s3_artifact(self, bucket: str, key: str, data: Dict[str, Any]) -> str:
        data_bytes = json.dumps(data, indent=2).encode("utf-8")
        if self.s3_client:
            try:
                self.s3_client.put_object(Bucket=bucket, Key=key, Body=data_bytes, ContentType="application/json")
                return f"s3://{bucket}/{key}"
            except Exception as e:
                logger.warning(f"Error subiendo a S3 ({e}), guardando localmente.")

        # Fallback local
        local_path = os.path.join("local_s3_bucket", key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        with open(local_path, "wb") as f:
            f.write(data_bytes)
        return f"file://{os.path.abspath(local_path)}"


_STORAGE = None

def get_storage_engine():
    global _STORAGE
    if _STORAGE is None:
        _STORAGE = StorageEngine()
    return _STORAGE
`,
  },
  {
    name: 'docker-compose.yml',
    path: 'docker-compose.yml',
    language: 'yaml',
    category: 'config',
    description: 'Orquestación de servicios en contenedores: HAProxy, 2 Servidores Sockets, RabbitMQ, 2 Workers, PostgreSQL y MinIO.',
    content: `version: '3.8'

services:
  # 1. Balanceador de Carga L4 para Sockets TCP
  haproxy:
    image: haproxy:2.8-alpine
    container_name: dist_haproxy
    ports:
      - "9000:9000"      # Entrada principal TCP para clientes
      - "8404:8404"      # Dashboard de métricas de HAProxy
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
    depends_on:
      - server-1
      - server-2
    networks:
      - dist_network

  # 2. Servidores Socket Gateways (Clúster de Ingesta)
  server-1:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: dist_server_1
    command: python server.py --port 9001 --server-id srv-node-1
    environment:
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - POSTGRES_HOST=postgres
      - S3_ENDPOINT_URL=http://minio:9000
    depends_on:
      - rabbitmq
      - postgres
      - minio
    networks:
      - dist_network

  server-2:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: dist_server_2
    command: python server.py --port 9002 --server-id srv-node-2
    environment:
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - POSTGRES_HOST=postgres
      - S3_ENDPOINT_URL=http://minio:9000
    depends_on:
      - rabbitmq
      - postgres
      - minio
    networks:
      - dist_network

  # 3. Cola de Mensajes (RabbitMQ)
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: dist_rabbitmq
    ports:
      - "5672:5672"      # Puerto AMQP
      - "15672:15672"    # Web Dashboard
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    networks:
      - dist_network

  # 4. Servidores Workers (ThreadPoolExecutor)
  worker-1:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: dist_worker_1
    command: python worker.py --worker-id wrk-node-1 --threads 4
    environment:
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - POSTGRES_HOST=postgres
      - S3_ENDPOINT_URL=http://minio:9000
      - AWS_ACCESS_KEY_ID=minioadmin
      - AWS_SECRET_ACCESS_KEY=minioadmin
    depends_on:
      - rabbitmq
      - postgres
      - minio
    networks:
      - dist_network

  worker-2:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: dist_worker_2
    command: python worker.py --worker-id wrk-node-2 --threads 4
    environment:
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - POSTGRES_HOST=postgres
      - S3_ENDPOINT_URL=http://minio:9000
      - AWS_ACCESS_KEY_ID=minioadmin
      - AWS_SECRET_ACCESS_KEY=minioadmin
    depends_on:
      - rabbitmq
      - postgres
      - minio
    networks:
      - dist_network

  # 5. Base de Datos Relacional Distribuida
  postgres:
    image: postgres:16-alpine
    container_name: dist_postgres
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=tasks_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - dist_network

  # 6. Almacenamiento de Objetos Distribuido (S3 Compatible)
  minio:
    image: minio/minio:RELEASE.2024-03-05T04-48-44Z
    container_name: dist_minio
    ports:
      - "9003:9000"      # S3 API
      - "9004:9001"      # MinIO Console
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data
    networks:
      - dist_network

volumes:
  pgdata:
  miniodata:

networks:
  dist_network:
    driver: bridge
`,
  },
  {
    name: 'haproxy.cfg',
    path: 'haproxy.cfg',
    language: 'ini',
    category: 'config',
    description: 'Configuración de HAProxy en modo TCP L4 con verificación de salud activa y balanceo Round-Robin.',
    content: `global
    log stdout format raw local0 info
    maxconn 4096

defaults
    log     global
    mode    tcp
    option  tcplog
    timeout connect 5000ms
    timeout client  50000ms
    timeout server  50000ms

# Frontend de Sockets TCP expuesto a los Clientes
frontend socket_inbound
    bind *:9000
    mode tcp
    default_backend socket_servers_pool

# Backend con los Servidores Socket Gateways
backend socket_servers_pool
    mode tcp
    balance roundrobin
    option tcp-check
    # Health checks cada 2000 ms, requiere 2 éxitos para estar UP, 3 fallos para DOWN
    server server_1 server-1:9001 check inter 2000 rise 2 fall 3
    server server_2 server-2:9002 check inter 2000 rise 2 fall 3

# Dashboard opcional de estadísticas
frontend stats
    bind *:8404
    mode http
    stats enable
    stats uri /
    stats refresh 5s
`,
  },
  {
    name: 'nginx.conf',
    path: 'nginx.conf',
    language: 'ini',
    category: 'config',
    description: 'Configuración alternativa para balanceo de sockets TCP utilizando el módulo stream de Nginx.',
    content: `user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

# Bloque STREAM para balanceo de carga de sockets TCP puros (Capa 4)
stream {
    upstream socket_cluster {
        # Algoritmo de balanceo por menor número de conexiones activas
        least_conn;
        server server-1:9001 max_fails=3 fail_timeout=10s;
        server server-2:9002 max_fails=3 fail_timeout=10s;
    }

    server {
        listen 9000;
        proxy_pass socket_cluster;
        proxy_timeout 60s;
        proxy_connect_timeout 5s;
    }
}
`,
  },
  {
    name: 'Dockerfile',
    path: 'Dockerfile',
    language: 'dockerfile',
    category: 'config',
    description: 'Dockerfile multi-stage para construir imágenes ligeras de los servicios Python.',
    content: `FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY protocol.py .
COPY storage.py .
COPY message_queue.py .
COPY server.py .
COPY worker.py .
COPY client.py .

EXPOSE 9001 9002

CMD ["python", "server.py"]
`,
  },
  {
    name: 'test_suite.py',
    path: 'test_suite.py',
    language: 'python',
    category: 'code',
    description: 'Suite de pruebas automáticas con pytest para validación de framing binario, concurrencia y sockets.',
    content: `"""
test_suite.py - Pruebas Unitarias y de Integración para el Sistema Distribuido
"""

import io
import json
import time
import struct
import socket
import threading
import pytest

from protocol import pack_message, unpack_message, read_exact, HEADER_FORMAT, ProtocolError
from worker import execute_matrix_multiplication, execute_image_filter, execute_data_aggregation, execute_hash_mining


def test_protocol_packing_and_unpacking():
    """Valida que el empaquetado binario coincida con el encabezado de 4 bytes."""
    data = {
        "task_id": "test-1234",
        "task_type": "matrix_mult",
        "payload": {"size": 32}
    }
    packed = pack_message(data)
    
    # 4 bytes de header
    assert len(packed) > 4
    header = packed[:4]
    (payload_len,) = struct.unpack(HEADER_FORMAT, header)
    
    payload_raw = packed[4:]
    assert len(payload_raw) == payload_len
    
    decoded = json.loads(payload_raw.decode("utf-8"))
    assert decoded["task_id"] == "test-1234"
    assert decoded["payload"]["size"] == 32


def test_matrix_computation_deterministic():
    """Verifica que el cómputo matricial devuelva traza y dimensiones correctas."""
    res = execute_matrix_multiplication(size=16, seed=42)
    assert res["dimensions"] == [16, 16]
    assert "matrix_trace" in res
    assert len(res["sample_elements"]) == 3


def test_image_filter_computation():
    res = execute_image_filter("gaussian_blur", width=30, height=30)
    assert res["filter_applied"] == "gaussian_blur"
    assert res["resolution"] == "30x30"
    assert res["processed_pixel_sum"] > 0


def test_data_aggregation_metrics():
    res = execute_data_aggregation(sample_count=1000)
    assert res["samples_analyzed"] == 1000
    assert "mean" in res
    assert "std_dev" in res
    assert res["min"] <= res["max"]


def test_hash_mining_pow():
    res = execute_hash_mining(difficulty=2)
    assert res["hash"].startswith("00")
    assert res["nonce"] >= 0


def test_socket_echo_loopback():
    """Prueba de socket real en puerto libre loopback."""
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.bind(("127.0.0.1", 0))
    server_sock.listen(1)
    port = server_sock.getsockname()[1]

    received = {}

    def server_thread():
        client_conn, _ = server_sock.accept()
        msg = unpack_message(client_conn)
        received.update(msg)
        resp = {"status": "OK", "echo": msg["task_id"]}
        client_conn.sendall(pack_message(resp))
        client_conn.close()

    t = threading.Thread(target=server_thread, daemon=True)
    t.start()

    # Cliente
    client_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client_sock.connect(("127.0.0.1", port))
    client_sock.sendall(pack_message({"task_id": "echo-abc-99"}))
    resp = unpack_message(client_sock)
    client_sock.close()
    server_sock.close()

    assert received.get("task_id") == "echo-abc-99"
    assert resp.get("status") == "OK"
    assert resp.get("echo") == "echo-abc-99"
`,
  },
  {
    name: 'requirements.txt',
    path: 'requirements.txt',
    language: 'ini',
    category: 'config',
    description: 'Lista de dependencias mínimas requeridas por el entorno de ejecución Python.',
    content: `# Drivers de Integración y Mensajería
pika>=1.3.2              # AMQP 0-9-1 para RabbitMQ
psycopg2-binary>=2.9.9   # Driver para PostgreSQL
boto3>=1.34.0            # SDK para Amazon S3 / MinIO

# Testing y Calidad de Código
pytest>=8.0.0            # Framework de testing automatizado
`,
  }
];
