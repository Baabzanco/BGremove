import type { ModelId, ExecutionRuntime, ModelProgressInfo } from '../../types';

export interface ModelInferenceOutput {
  /** Continuous alpha matte [0, 255] at the model's native resolution */
  alphaMatte: Uint8ClampedArray;
  maskWidth: number;
  maskHeight: number;
  inferenceTimeMs: number;
  runtime: ExecutionRuntime;
}

export interface ModelAdapter {
  id: ModelId;
  load(
    onProgress?: (info: ModelProgressInfo) => void,
    forcedRuntime?: 'webgpu' | 'wasm'
  ): Promise<void>;
  isLoaded(): boolean;
  getRuntime(): ExecutionRuntime;
  removeBackground(source: ImageBitmap | ImageData): Promise<ModelInferenceOutput>;
  dispose(): Promise<void>;
}
