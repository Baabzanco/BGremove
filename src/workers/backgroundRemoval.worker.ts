/// <reference lib="webworker" />

import { getModelAdapter, type ModelAdapter } from '../ai/adapters';
import { getModelMetadata, DEFAULT_MODEL_ID } from '../ai/registry';
import {
  upscaleMaskToOriginal,
  applyAlphaToOriginal,
  imageDataToBitmap,
} from '../image/postprocess';
import type {
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  ModelProgressInfo,
  ModelId,
} from '../types';

let currentAdapter: ModelAdapter | null = null;
let currentModelId: ModelId | null = null;

// Worker message listener
self.addEventListener('message', async (event: MessageEvent<WorkerIncomingMessage>) => {
  const { type, payload } = event.data;
  const targetModelId = payload?.modelId || currentModelId || DEFAULT_MODEL_ID;

  // Handle explicit model load / warm-up request
  if (type === 'load-model' || type === 'preload') {
    try {
      // Memory management: if switching model, dispose previous one
      if (currentAdapter && currentModelId && currentModelId !== targetModelId) {
        console.log(`[AI Worker] Disposing previous model (${currentModelId}) to free memory`);
        await currentAdapter.dispose();
        currentAdapter = null;
      }

      currentModelId = targetModelId;
      currentAdapter = getModelAdapter(targetModelId);

      self.postMessage({
        type: 'status',
        status: 'loading-model',
        modelId: targetModelId,
      } satisfies WorkerOutgoingMessage);

      await currentAdapter.load((progress: ModelProgressInfo) => {
        self.postMessage({
          type: 'progress',
          progressInfo: { ...progress, modelId: targetModelId },
          modelId: targetModelId,
        } satisfies WorkerOutgoingMessage);
      }, payload?.preferredRuntime);

      self.postMessage({
        type: 'model-ready',
        status: 'idle',
        modelId: targetModelId,
        runtime: currentAdapter.getRuntime(),
      } satisfies WorkerOutgoingMessage);
    } catch (err: any) {
      self.postMessage({
        type: 'error',
        modelId: targetModelId,
        error: err?.message || `Failed to load model ${targetModelId}`,
      } satisfies WorkerOutgoingMessage);
    }
    return;
  }

  // Handle image processing request
  if (type === 'process' && payload) {
    const totalStart = performance.now();
    const { imageBitmap, imageData, width, height, preferredRuntime } = payload;
    const source = imageBitmap || imageData;

    if (!source || !width || !height) {
      self.postMessage({
        type: 'error',
        modelId: targetModelId,
        error: 'No image source provided to worker',
      } satisfies WorkerOutgoingMessage);
      return;
    }

    try {
      // Memory management: if changing model, dispose previous adapter
      if (currentAdapter && currentModelId && currentModelId !== targetModelId) {
        console.log(`[AI Worker] Switching model from ${currentModelId} to ${targetModelId}`);
        await currentAdapter.dispose();
        currentAdapter = null;
      }

      currentModelId = targetModelId;
      currentAdapter = getModelAdapter(targetModelId);
      const metadata = getModelMetadata(targetModelId);

      // 1. Ensure Model is Loaded
      if (!currentAdapter.isLoaded()) {
        self.postMessage({
          type: 'status',
          status: 'loading-model',
          modelId: targetModelId,
        } satisfies WorkerOutgoingMessage);

        await currentAdapter.load((progress: ModelProgressInfo) => {
          self.postMessage({
            type: 'progress',
            progressInfo: { ...progress, modelId: targetModelId },
            modelId: targetModelId,
          } satisfies WorkerOutgoingMessage);
        }, preferredRuntime);
      }

      // 2. Status: Removing Background
      self.postMessage({
        type: 'status',
        status: 'removing-background',
        modelId: targetModelId,
        runtime: currentAdapter.getRuntime(),
      } satisfies WorkerOutgoingMessage);

      // 3. Run model inference through adapter
      const { alphaMatte, maskWidth, maskHeight, inferenceTimeMs, runtime } =
        await currentAdapter.removeBackground(source);

      // 4. Shared postprocessing: Upscale mask to original image dimensions (e.g. 4000x3000)
      const fullAlpha = upscaleMaskToOriginal(
        alphaMatte,
        width,
        height,
        maskWidth,
        maskHeight
      );

      // 5. Shared postprocessing: Apply alpha matte to original RGB buffer
      const resultImageData = applyAlphaToOriginal(source, width, height, fullAlpha);

      const totalTimeMs = Math.round(performance.now() - totalStart);

      // 6. Convert to ImageBitmap for zero-copy postMessage transfer
      const resultBitmap = await imageDataToBitmap(resultImageData);

      const outgoing: WorkerOutgoingMessage = {
        type: 'result',
        modelId: targetModelId,
        result: {
          resultBitmap,
          metrics: {
            inferenceTimeMs,
            totalTimeMs,
            runtime,
            inputWidth: width,
            inputHeight: height,
            modelInputWidth: maskWidth,
            modelInputHeight: maskHeight,
            modelName: metadata.name,
            modelId: targetModelId,
          },
        },
      };

      // Transfer resultBitmap to avoid memory copying
      self.postMessage(outgoing, [resultBitmap]);
    } catch (err: any) {
      console.error(`[AI Worker] Error during background removal with ${targetModelId}:`, err);
      self.postMessage({
        type: 'error',
        modelId: targetModelId,
        error: err?.message || 'An error occurred during inference',
      } satisfies WorkerOutgoingMessage);
    }
  }
});
