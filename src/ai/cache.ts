import type { ModelId } from '../types';
import { getModelMetadata } from './registry';

const CACHE_STORAGE_NAMES = ['transformers-cache', 'transformers-v3', 'default'];

/**
 * Checks whether the ONNX weights for a given model are already present in browser cache.
 */
export async function isModelCached(modelId: ModelId): Promise<boolean> {
  const metadata = getModelMetadata(modelId);
  if (!metadata) return false;

  // 1. Check CacheStorage API if available
  if (typeof caches !== 'undefined') {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (CACHE_STORAGE_NAMES.some((expected) => name.includes(expected))) {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          const hasModelFile = requests.some((req) =>
            req.url.includes(metadata.modelSource) && (req.url.endsWith('.onnx') || req.url.includes('onnx'))
          );
          if (hasModelFile) {
            return true;
          }
        }
      }
    } catch {
      // Ignore cache API exceptions (e.g. storage disabled by browser)
    }
  }

  // 2. Check local persistence flag as backup
  try {
    const cachedList = JSON.parse(
      localStorage.getItem('background-removal-cached-models') || '[]'
    );
    if (Array.isArray(cachedList) && cachedList.includes(modelId)) {
      return true;
    }
  } catch {
    // Ignore localStorage errors
  }

  return false;
}

/**
 * Marks a model as cached locally once download completes.
 */
export function markModelAsCached(modelId: ModelId): void {
  try {
    const cachedList = new Set<string>(
      JSON.parse(localStorage.getItem('background-removal-cached-models') || '[]')
    );
    cachedList.add(modelId);
    localStorage.setItem(
      'background-removal-cached-models',
      JSON.stringify(Array.from(cachedList))
    );
  } catch {
    // Ignore
  }
}
