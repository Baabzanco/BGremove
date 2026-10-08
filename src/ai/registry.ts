import type { ModelId, ModelMetadata } from '../types';

export const MODEL_REGISTRY: Record<ModelId, ModelMetadata> = {
  'birefnet-lite-512': {
    id: 'birefnet-lite-512',
    name: 'BiRefNet-lite 512',
    badge: 'Best Quality',
    badgeColor: 'indigo',
    shortDescription: 'High quality • General purpose',
    description: 'Best general-purpose option for people, products, animals and complex subjects.',
    size: '~98 MB',
    quality: 'High',
    speed: 'Balanced',
    bestFor: ['people', 'products', 'animals', 'general'],
    runtimeSupport: ['WebGPU', 'WASM'],
    modelSource: 'studioludens/birefnet-lite-512',
    version: '1.0.0',
    inputResolution: { width: 512, height: 512 },
  },
  'isnet-int8': {
    id: 'isnet-int8',
    name: 'ISNet INT8',
    badge: 'Fast',
    badgeColor: 'amber',
    shortDescription: 'Very fast • General images',
    description: 'Optimized for speed and lower download size.',
    size: '~44 MB',
    quality: 'Good',
    speed: 'Fast',
    bestFor: ['general', 'objects', 'fast-inference'],
    runtimeSupport: ['WebGPU', 'WASM'],
    modelSource: 'onnx-community/ISNet-ONNX',
    version: '1.0.0',
    inputResolution: { width: 1024, height: 1024 },
  },
  'modnet': {
    id: 'modnet',
    name: 'MODNet',
    badge: 'Portrait',
    badgeColor: 'emerald',
    shortDescription: 'Best for people and portraits',
    description: 'Optimized for people and portrait images with fine hair details.',
    size: '~26 MB',
    quality: 'High (Portraits)',
    speed: 'Very Fast',
    bestFor: ['portraits', 'people', 'hair-detail'],
    runtimeSupport: ['WebGPU', 'WASM'],
    modelSource: 'Xenova/modnet',
    version: '1.0.0',
    inputResolution: { width: 512, height: 512 },
  },
};

export const DEFAULT_MODEL_ID: ModelId = 'birefnet-lite-512';

export const AVAILABLE_MODELS = Object.values(MODEL_REGISTRY);

export function getModelMetadata(id: ModelId): ModelMetadata {
  return MODEL_REGISTRY[id] || MODEL_REGISTRY[DEFAULT_MODEL_ID];
}
