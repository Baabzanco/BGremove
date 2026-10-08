import type { ExecutionRuntime } from '../types';

let cachedRuntime: ExecutionRuntime | null = null;

/**
 * Centralized detection of WebGPU availability.
 * Priority: WebGPU -> WASM fallback.
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
 * Returns the best available execution runtime for machine learning.
 */
export async function detectBestRuntime(): Promise<ExecutionRuntime> {
  if (cachedRuntime) {
    return cachedRuntime;
  }

  const webgpuAvailable = await isWebGPUSupported();
  cachedRuntime = webgpuAvailable ? 'WebGPU' : 'WASM';
  return cachedRuntime;
}
