export type ExecutionRuntime = 'WebGPU' | 'WASM';

export type ProcessingStatus =
  | 'idle'
  | 'loading-model'
  | 'removing-background'
  | 'success'
  | 'error';

export interface ModelProgressInfo {
  status: 'progress' | 'initiate' | 'download' | 'done';
  file?: string;
  progress?: number; // 0 to 100
  loaded?: number;   // bytes
  total?: number;    // bytes
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
}

export interface ProcessImageResult {
  pngBlob: Blob;
  previewUrl: string;
  metrics: ProcessingMetrics;
}

export interface WorkerIncomingMessage {
  type: 'process' | 'preload';
  payload?: {
    imageBitmap?: ImageBitmap;
    imageData?: ImageData;
    width: number;
    height: number;
    channels?: number;
    preferredRuntime?: 'webgpu' | 'wasm';
  };
}

export interface WorkerOutgoingMessage {
  type: 'status' | 'progress' | 'result' | 'error';
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
