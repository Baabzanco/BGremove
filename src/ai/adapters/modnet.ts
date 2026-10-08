import { AutoModel, Tensor } from '@huggingface/transformers';
import type { ModelAdapter, ModelInferenceOutput } from './types';
import type { ModelProgressInfo, ExecutionRuntime } from '../../types';
import { isWebGPUSupported } from '../runtime';

const MODNET_MODEL_ID = 'Xenova/modnet';
const MODNET_SIZE = 512;

export class MODNetAdapter implements ModelAdapter {
  readonly id = 'modnet';
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
        console.log('[MODNet Adapter] Attempting to load MODNet with WebGPU...');
        this.model = await AutoModel.from_pretrained(MODNET_MODEL_ID, {
          device: 'webgpu',
          dtype: 'fp32',
          progress_callback: (data: any) => {
            if (onProgress && data) {
              onProgress({
                status: data.status,
                file: data.file,
                progress: typeof data.progress === 'number' ? Math.round(data.progress) : undefined,
                loaded: data.loaded,
                total: data.total,
                modelId: 'modnet',
              });
            }
          },
        });
        this.runtime = 'WebGPU';
        console.log('[MODNet Adapter] Loaded MODNet on WebGPU successfully');
        return;
      } catch (err) {
        console.warn('[MODNet Adapter] WebGPU load failed for MODNet; falling back to WASM.', err);
      }
    }

    // WASM Fallback
    console.log('[MODNet Adapter] Loading MODNet on WASM...');
    const fallbackDevice =
      typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined'
        ? 'cpu'
        : 'wasm';

    this.model = await AutoModel.from_pretrained(MODNET_MODEL_ID, {
      device: fallbackDevice,
      dtype: 'fp32',
      progress_callback: (data: any) => {
        if (onProgress && data) {
          onProgress({
            status: data.status,
            file: data.file,
            progress: typeof data.progress === 'number' ? Math.round(data.progress) : undefined,
            loaded: data.loaded,
            total: data.total,
            modelId: 'modnet',
          });
        }
      },
    });
    this.runtime = 'WASM';
    console.log('[MODNet Adapter] Loaded MODNet on WASM successfully');
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

    // 1. Preprocess to 512x512 NCHW with MODNet normalization: ((val / 255) - 0.5) / 0.5
    const imgData = sampleTo512ImageData(source);
    const pixelCount = MODNET_SIZE * MODNET_SIZE;
    const tensorData = new Float32Array(3 * pixelCount);
    const { data } = imgData;

    const rOffset = 0;
    const gOffset = pixelCount;
    const bOffset = 2 * pixelCount;

    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * 4;
      // Rescale [0, 255] -> [-1, 1]
      tensorData[rOffset + i] = (data[srcIdx] / 255.0 - 0.5) / 0.5;
      tensorData[gOffset + i] = (data[srcIdx + 1] / 255.0 - 0.5) / 0.5;
      tensorData[bOffset + i] = (data[srcIdx + 2] / 255.0 - 0.5) / 0.5;
    }

    const inputTensor = new Tensor('float32', tensorData, [1, 3, MODNET_SIZE, MODNET_SIZE]);
    const feeds: Record<string, any> = {};
    feeds[inputName] = inputTensor;

    // 2. Inference
    const t0 = performance.now();
    const outputs = await session.run(feeds);
    const inferenceTimeMs = Math.round(performance.now() - t0);

    const outTensor = outputs[outputName];
    if (!outTensor || !outTensor.data) {
      throw new Error('MODNet model did not return output tensor');
    }

    const outData = outTensor.data as Float32Array;
    const alphaMatte = new Uint8ClampedArray(pixelCount);

    // 3. MODNet directly outputs matte probabilities [0, 1]
    for (let i = 0; i < pixelCount; i++) {
      const val = outData[i];
      const prob = Math.max(0, Math.min(1.0, val));
      alphaMatte[i] = Math.round(prob * 255);
    }

    return {
      alphaMatte,
      maskWidth: MODNET_SIZE,
      maskHeight: MODNET_SIZE,
      inferenceTimeMs,
      runtime: this.runtime,
    };
  }

  async dispose(): Promise<void> {
    this.model = null;
  }
}

function sampleTo512ImageData(source: ImageBitmap | ImageData): ImageData {
  const isImageData =
    (typeof ImageData !== 'undefined' && source instanceof ImageData) ||
    ('data' in source && 'width' in source && 'height' in source);

  if (isImageData && (source as any).width === MODNET_SIZE && (source as any).height === MODNET_SIZE) {
    return source as ImageData;
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(MODNET_SIZE, MODNET_SIZE);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D context for OffscreenCanvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (source instanceof ImageData) {
      const srcCanvas = new OffscreenCanvas(source.width, source.height);
      const srcCtx = srcCanvas.getContext('2d');
      if (srcCtx) srcCtx.putImageData(source, 0, 0);
      ctx.drawImage(srcCanvas, 0, 0, MODNET_SIZE, MODNET_SIZE);
    } else {
      ctx.drawImage(source, 0, 0, MODNET_SIZE, MODNET_SIZE);
    }
    return ctx.getImageData(0, 0, MODNET_SIZE, MODNET_SIZE);
  }

  throw new Error('OffscreenCanvas required for MODNet image sampling');
}
