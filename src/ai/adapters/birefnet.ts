import type { ModelAdapter, ModelInferenceOutput } from './types';
import type { ModelProgressInfo, ExecutionRuntime } from '../../types';
import { loadBiRefNetModel, disposeBiRefNetModel, type LoadedModelBundle } from '../model';
import { runBiRefNetInference } from '../inference';
import { preprocessToNCHW, MODEL_INPUT_SIZE } from '../../image/preprocess';
import { logitsToAlphaMatte } from '../../image/postprocess';

export class BiRefNetAdapter implements ModelAdapter {
  readonly id = 'birefnet-lite-512';
  private bundle: LoadedModelBundle | null = null;

  async load(
    onProgress?: (info: ModelProgressInfo) => void,
    forcedRuntime?: 'webgpu' | 'wasm'
  ): Promise<void> {
    if (this.bundle && !forcedRuntime) return;
    this.bundle = await loadBiRefNetModel(onProgress, forcedRuntime);
  }

  isLoaded(): boolean {
    return this.bundle !== null;
  }

  getRuntime(): ExecutionRuntime {
    return this.bundle?.runtime || 'WebGPU';
  }

  async removeBackground(source: ImageBitmap | ImageData): Promise<ModelInferenceOutput> {
    if (!this.bundle) {
      await this.load();
    }

    // 1. Preprocess using existing function
    const preprocessed = preprocessToNCHW(source, MODEL_INPUT_SIZE);

    // 2. Inference using existing engine
    const { logits, inferenceTimeMs, runtime } = await runBiRefNetInference(
      preprocessed,
      this.bundle!
    );

    // 3. Sigmoid to continuous alpha matte using existing function
    const alphaMatte = logitsToAlphaMatte(logits, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

    return {
      alphaMatte,
      maskWidth: MODEL_INPUT_SIZE,
      maskHeight: MODEL_INPUT_SIZE,
      inferenceTimeMs,
      runtime,
    };
  }

  async dispose(): Promise<void> {
    this.bundle = null;
    disposeBiRefNetModel();
  }
}
