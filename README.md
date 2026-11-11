<img src="https://i.ibb.co/VYkx7wHV/ifts29-Logo.png" width="80" height="80" alt="ifts-29"/>

# Programación sobre Redes

## Práctica Formativa Obligatoria 3

## Rediseño como Sistema Distribuido (Cliente-Servidor). Transformar el sistema en una arquitectura distribuida usando sockets.

### ¿Cómo funciona la arquitectura?

**Clientes:** Envían tareas a través de la red usando sockets TCP al puerto 8080.

**Balanceador de Carga:** Actúa como la "puerta de entrada" (similar a Nginx o HAProxy). Utiliza un algoritmo Round Robin (turnos) para repartir equitativamente las peticiones entrantes entre los workers disponibles.

Esto evita que un solo servidor colapse si recibe demasiadas peticiones.

**Servidores Workers:** Cada worker escucha en un puerto distinto (Ej. 5001, 5002). Cuando reciben una tarea, no la procesan en el hilo principal. En su lugar, la delegan a un Pool de Hilos (ThreadPoolExecutor). Esto permite que un worker atienda múltiples tareas en paralelo.

**Cola de Mensajes (Concepto Teórico - RabbitMQ):** En un entorno real, si una tarea es muy pesada, el worker la publica en RabbitMQ. Otro worker "libre" consume el mensaje y lo procesa. Esto se llama comunicación asíncrona. En nuestra implementación local, esto se simula mediante hilos concurrentes para no requerir la instalación de RabbitMQ.

**Almacenamiento (Concepto Teórico - PostgreSQL / S3):** En lugar de usar un único archivo SQLite, los workers consultarían una base de datos centralizada (PostgreSQL) y guardarían archivos pesados (PDFs, imágenes) en un bucket S3.




