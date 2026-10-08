export type ExecutionRuntime = 'WebGPU' | 'WASM';

export type ModelId = 'birefnet-lite-512' | 'isnet-int8' | 'modnet';

export type ProcessingStatus =
  | 'idle'
  | 'loading-model'
  | 'removing-background'
  | 'success'
  | 'error';

export type ModelCacheStatus =
  | 'not-downloaded'
  | 'downloading'
  | 'cached'
  | 'loading'
  | 'ready'
  | 'error';

export interface ModelMetadata {
  id: ModelId;
  name: string;
  badge: string;
  badgeColor?: string;
  shortDescription: string;
  description: string;
  size: string;
  quality: 'High' | 'Good' | 'High (Portraits)';
  speed: 'Balanced' | 'Fast' | 'Very Fast';
  bestFor: string[];
  runtimeSupport: ExecutionRuntime[];
  modelSource: string;
  version: string;
  inputResolution: { width: number; height: number };
}

export interface ModelProgressInfo {
  status: 'progress' | 'initiate' | 'download' | 'done';
  file?: string;
  progress?: number; // 0 to 100
  loaded?: number;   // bytes
  total?: number;    // bytes
  modelId?: ModelId;
}

export interface ProcessingMetrics {
  inferenceTimeMs: number;
  totalTimeMs: number;
  runtime: ExecutionRuntime;
  inputWidth: number;
  inputHeight: number;
  modelInputWidth: number;
  modelInputHeight: number;
  modelName: string;
  modelId: ModelId;
}

export interface ProcessImageResult {
  pngBlob: Blob;
  webpBlob?: Blob;
  previewUrl: string;
  metrics: ProcessingMetrics;
}

export interface WorkerIncomingMessage {
  type: 'process' | 'preload' | 'load-model';
  payload?: {
    modelId?: ModelId;
    imageBitmap?: ImageBitmap;
    imageData?: ImageData;
    width?: number;
    height?: number;
    preferredRuntime?: 'webgpu' | 'wasm';
  };
}

export interface WorkerOutgoingMessage {
  type: 'status' | 'progress' | 'result' | 'error' | 'model-ready';
  modelId?: ModelId;
  status?: ProcessingStatus;
  progressInfo?: ModelProgressInfo;
  result?: {
    resultBitmap?: ImageBitmap;
    resultImageData?: ImageData;
    metrics: ProcessingMetrics;
  };
  error?: string;
  runtime?: ExecutionRuntime;
}
