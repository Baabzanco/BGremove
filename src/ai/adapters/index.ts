import type { ModelId } from '../../types';
import type { ModelAdapter } from './types';
import { BiRefNetAdapter } from './birefnet';
import { ISNetAdapter } from './isnet';
import { MODNetAdapter } from './modnet';

export type { ModelAdapter, ModelInferenceOutput } from './types';

const adapterInstances: Partial<Record<ModelId, ModelAdapter>> = {};

/**
 * Returns the adapter instance for the specified model ID.
 */
export function getModelAdapter(modelId: ModelId): ModelAdapter {
  if (!adapterInstances[modelId]) {
    switch (modelId) {
      case 'birefnet-lite-512':
        adapterInstances[modelId] = new BiRefNetAdapter();
        break;
      case 'isnet-int8':
        adapterInstances[modelId] = new ISNetAdapter();
        break;
      case 'modnet':
        adapterInstances[modelId] = new MODNetAdapter();
        break;
      default:
        adapterInstances['birefnet-lite-512'] = new BiRefNetAdapter();
        return adapterInstances['birefnet-lite-512']!;
    }
  }
  return adapterInstances[modelId]!;
}

/**
 * Disposes all currently loaded adapters to free browser memory.
 */
export async function disposeAllAdapters(): Promise<void> {
  for (const key of Object.keys(adapterInstances) as ModelId[]) {
    const adapter = adapterInstances[key];
    if (adapter) {
      await adapter.dispose();
      delete adapterInstances[key];
    }
  }
}
