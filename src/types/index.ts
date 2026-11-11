/**
 * System Architecture & Simulator Types
 */

export type ClientType = 'web' | 'mobile' | 'cli';

export type TaskType = 'matrix_mult' | 'image_filter' | 'data_aggregate' | 'hash_mining';

export type TaskStatus = 'QUEUED_LB' | 'INGESTED_GATEWAY' | 'ENQUEUED_RABBITMQ' | 'DISPATCHED_WORKER' | 'COMPUTING_THREAD' | 'SAVING_STORAGE' | 'RETURNING_RESULT' | 'COMPLETED' | 'FAILED';

export interface ArchitectureNode {
  id: string;
  name: string;
  category: 'client' | 'lb' | 'gateway' | 'queue' | 'worker' | 'storage';
  layer: number;
  icon: string;
  port?: string;
  protocol: string;
  techStack: string;
  role: string;
  concurrencyModel: string;
  configurationSnippet: string;
  failureHandling: string;
  scalabilityNotes: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArchitectureLink {
  id: string;
  source: string;
  target: string;
  protocol: string;
  label: string;
  description: string;
}

export interface SimulatedTask {
  id: string;
  clientType: ClientType;
  taskType: TaskType;
  priority: 'low' | 'normal' | 'high';
  createdAt: number;
  status: TaskStatus;
  currentStage: string;
  assignedGateway?: string;
  assignedWorker?: string;
  assignedThreadId?: number;
  progress: number;
  computeDurationMs: number;
  s3ArtifactUrl?: string;
  postgresRecordId?: number;
  latencyMs?: number;
  rawPayloadSnippet: string;
  resultSummary?: string;
}

export interface WorkerState {
  id: string;
  name: string;
  maxThreads: number;
  activeThreads: {
    threadId: number;
    taskId?: string;
    taskType?: TaskType;
    progress: number;
  }[];
  tasksProcessed: number;
  cpuLoad: number;
}

export interface RepoFile {
  name: string;
  path: string;
  language: 'python' | 'markdown' | 'yaml' | 'ini' | 'dockerfile' | 'sql';
  category: 'code' | 'config' | 'doc';
  description: string;
  content: string;
}

export interface SocketPacketLog {
  id: string;
  timestamp: string;
  direction: 'INCOMING' | 'OUTGOING' | 'INTERNAL';
  from: string;
  to: string;
  protocol: string;
  rawHex: string;
  payloadSummary: string;
  sizeBytes: number;
}
