import { AutoModel, Tensor, env } from '@huggingface/transformers';
import type { ModelAdapter, ModelInferenceOutput } from './types';
import type { ModelProgressInfo, ExecutionRuntime } from '../../types';
import { isWebGPUSupported } from '../runtime';

const ISNET_MODEL_ID = 'onnx-community/ISNet-ONNX';
const ISNET_SIZE = 1024;

export class ISNetAdapter implements ModelAdapter {
  readonly id = 'isnet-int8';
  private model: any = null;
  private runtime: ExecutionRuntime = 'WASM';

  async load(
    onProgress?: (info: ModelProgressInfo) => void,
    forcedRuntime?: 'webgpu' | 'wasm'
  ): Promise<void> {
    if (this.model && !forcedRuntime) return;

    const canUseWebGPU =
      forcedRuntime === 'webgpu'
        ? true
        : forcedRuntime === 'wasm'
        ? false
        : await isWebGPUSupported();

    if (canUseWebGPU) {
      try {
        console.log('[ISNet Adapter] Attempting to load ISNet INT8 with WebGPU...');
        this.model = await AutoModel.from_pretrained(ISNET_MODEL_ID, {
          device: 'webgpu',
          dtype: 'int8',
          progress_callback: (data: any) => {
            if (onProgress && data) {
              onProgress({
                status: data.status,
                file: data.file,
                progress: typeof data.progress === 'number' ? Math.round(data.progress) : undefined,
                loaded: data.loaded,
                total: data.total,
                modelId: 'isnet-int8',
              });
            }
          },
        });
        this.runtime = 'WebGPU';
        console.log('[ISNet Adapter] Loaded ISNet INT8 on WebGPU successfully');
        return;
      } catch (err) {
        console.warn('[ISNet Adapter] WebGPU load failed for INT8; falling back to WASM.', err);
      }
    }

    // WASM Fallback
    console.log('[ISNet Adapter] Loading ISNet INT8 on WASM...');
    const fallbackDevice =
      typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined'
        ? 'cpu'
        : 'wasm';

    this.model = await AutoModel.from_pretrained(ISNET_MODEL_ID, {
      device: fallbackDevice,
      dtype: 'int8',
      progress_callback: (data: any) => {
        if (onProgress && data) {
          onProgress({
            status: data.status,
            file: data.file,
            progress: typeof data.progress === 'number' ? Math.round(data.progress) : undefined,
            loaded: data.loaded,
            total: data.total,
            modelId: 'isnet-int8',
          });
        }
      },
    });
    this.runtime = 'WASM';
    console.log('[ISNet Adapter] Loaded ISNet INT8 on WASM successfully');
  }

  isLoaded(): boolean {
    return this.model !== null;
  }

  getRuntime(): ExecutionRuntime {
    return this.runtime;
  }

  async removeBackground(source: ImageBitmap | ImageData): Promise<ModelInferenceOutput> {
    if (!this.model) {
      await this.load();
    }

    const session = this.model.sessions.model;
    const inputName = session.inputNames[0] || 'input';
    const outputName = session.outputNames[0] || 'output';

    // 1. Preprocess to 1024x1024 NCHW
    const imgData = sampleTo1024ImageData(source);
    const pixelCount = ISNET_SIZE * ISNET_SIZE;
    const tensorData = new Float32Array(3 * pixelCount);
    const { data } = imgData;

    const rOffset = 0;
    const gOffset = pixelCount;
    const bOffset = 2 * pixelCount;

    // ISNet normalization: (x - 128) / 256
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * 4;
      tensorData[rOffset + i] = (data[srcIdx] - 128.0) / 256.0;
      tensorData[gOffset + i] = (data[srcIdx + 1] - 128.0) / 256.0;
      tensorData[bOffset + i] = (data[srcIdx + 2] - 128.0) / 256.0;
    }

    const inputTensor = new Tensor('float32', tensorData, [1, 3, ISNET_SIZE, ISNET_SIZE]);
    const feeds: Record<string, any> = {};
    feeds[inputName] = inputTensor;

    // 2. Inference
    const t0 = performance.now();
    const outputs = await session.run(feeds);
    const inferenceTimeMs = Math.round(performance.now() - t0);

    const outTensor = outputs[outputName];
    if (!outTensor || !outTensor.data) {
      throw new Error('ISNet model did not return output tensor');
    }

    const outData = outTensor.data as Float32Array;
    const alphaMatte = new Uint8ClampedArray(pixelCount);

    // 3. Convert output to alpha matte
    // ISNet returns probabilities [0, 1] (or logits depending on export)
    const isLogits = outData[0] < 0 || outData[10] > 1.0;

    for (let i = 0; i < pixelCount; i++) {
      const val = outData[i];
      const prob = isLogits ? 1.0 / (1.0 + Math.exp(-val)) : Math.max(0, Math.min(1, val));
      alphaMatte[i] = Math.round(prob * 255);
    }

    return {
      alphaMatte,
      maskWidth: ISNET_SIZE,
      maskHeight: ISNET_SIZE,
      inferenceTimeMs,
      runtime: this.runtime,
    };
  }

  async dispose(): Promise<void> {
    this.model = null;
  }
}

function sampleTo1024ImageData(source: ImageBitmap | ImageData): ImageData {
  const isImageData =
    (typeof ImageData !== 'undefined' && source instanceof ImageData) ||
    ('data' in source && 'width' in source && 'height' in source);

  if (isImageData && (source as any).width === ISNET_SIZE && (source as any).height === ISNET_SIZE) {
    return source as ImageData;
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(ISNET_SIZE, ISNET_SIZE);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D context for OffscreenCanvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (source instanceof ImageData) {
      const srcCanvas = new OffscreenCanvas(source.width, source.height);
      const srcCtx = srcCanvas.getContext('2d');
      if (srcCtx) srcCtx.putImageData(source, 0, 0);
      ctx.drawImage(srcCanvas, 0, 0, ISNET_SIZE, ISNET_SIZE);
    } else {
      ctx.drawImage(source, 0, 0, ISNET_SIZE, ISNET_SIZE);
    }
    return ctx.getImageData(0, 0, ISNET_SIZE, ISNET_SIZE);
  }

  throw new Error('OffscreenCanvas required for ISNet image sampling');
}
