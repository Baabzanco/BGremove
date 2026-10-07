import { AutoModel, env } from '@huggingface/transformers';
import type { ExecutionRuntime, ModelProgressInfo } from '../types';

export const MODEL_ID = 'studioludens/birefnet-lite-512';

// Configure transformers.js environment
env.allowLocalModels = false;
// Allow local wasm binaries from /ort/ if available
if (typeof location !== 'undefined' && env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = `${location.origin}/ort/`;
}

export interface LoadedModelBundle {
  model: any;
  runtime: ExecutionRuntime;
}

let cachedBundle: LoadedModelBundle | null = null;
let loadingPromise: Promise<LoadedModelBundle> | null = null;

/**
 * Checks if WebGPU is available in current environment
 */
export async function isWebGPUSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

/**
 * Loads the BiRefNet-lite 512 model with WebGPU priority and WASM fallback.
 */
export async function loadBiRefNetModel(
  onProgress?: (info: ModelProgressInfo) => void,
  forcedRuntime?: 'webgpu' | 'wasm'
): Promise<LoadedModelBundle> {
  if (cachedBundle && !forcedRuntime) {
    return cachedBundle;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const canUseWebGPU = forcedRuntime === 'webgpu' ? true : forcedRuntime === 'wasm' ? false : await isWebGPUSupported();

    if (canUseWebGPU) {
      try {
        console.log('[AI Worker] Attempting to initialize BiRefNet-lite 512 on WebGPU...');
        const model = await AutoModel.from_pretrained(MODEL_ID, {
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
              });
            }
          },
        });

        cachedBundle = { model, runtime: 'WebGPU' };
        console.log('[AI Worker] Successfully loaded BiRefNet-lite 512 on WebGPU');
        return cachedBundle;
      } catch (err) {
        console.warn('[AI Worker] WebGPU initialization failed or not supported by hardware; falling back to WASM.', err);
      }
    }

    // WASM Fallback
    console.log('[AI Worker] Initializing BiRefNet-lite 512 on WASM...');
    try {
      const model = await AutoModel.from_pretrained(MODEL_ID, {
        device: 'wasm',
        dtype: 'fp32',
        progress_callback: (data: any) => {
          if (onProgress && data) {
            onProgress({
              status: data.status,
              file: data.file,
              progress: typeof data.progress === 'number' ? Math.round(data.progress) : undefined,
              loaded: data.loaded,
              total: data.total,
            });
          }
        },
      });

      cachedBundle = { model, runtime: 'WASM' };
      console.log('[AI Worker] Successfully loaded BiRefNet-lite 512 on WASM');
      return cachedBundle;
    } catch (err: any) {
      console.error('[AI Worker] Failed to load BiRefNet-lite 512 model on both WebGPU and WASM:', err);
      throw new Error(`Failed to load AI model (${err?.message || 'Network or WASM execution error'}). Please check internet connection.`);
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}
