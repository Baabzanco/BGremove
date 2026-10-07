/// <reference lib="webworker" />

import { loadBiRefNetModel, type LoadedModelBundle } from '../ai/model';
import { runBiRefNetInference } from '../ai/inference';
import { preprocessToNCHW, MODEL_INPUT_SIZE } from '../image/preprocess';
import {
  logitsToAlphaMatte,
  upscaleMaskToOriginal,
  applyAlphaToOriginal,
  imageDataToBitmap,
} from '../image/postprocess';
import type {
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  ModelProgressInfo,
} from '../types';

let activeModelBundle: LoadedModelBundle | null = null;

// Worker message listener
self.addEventListener('message', async (event: MessageEvent<WorkerIncomingMessage>) => {
  const { type, payload } = event.data;

  if (type === 'preload') {
    try {
      self.postMessage({
        type: 'status',
        status: 'loading-model',
      } satisfies WorkerOutgoingMessage);

      activeModelBundle = await loadBiRefNetModel((progress: ModelProgressInfo) => {
        self.postMessage({
          type: 'progress',
          progressInfo: progress,
        } satisfies WorkerOutgoingMessage);
      }, payload?.preferredRuntime);

      self.postMessage({
        type: 'status',
        status: 'idle',
        runtime: activeModelBundle.runtime,
      } satisfies WorkerOutgoingMessage);
    } catch (err: any) {
      self.postMessage({
        type: 'error',
        error: err?.message || 'Failed to preload model',
      } satisfies WorkerOutgoingMessage);
    }
    return;
  }

  if (type === 'process' && payload) {
    const totalStart = performance.now();
    const { imageBitmap, imageData, width, height, preferredRuntime } = payload;
    const source = imageBitmap || imageData;

    if (!source) {
      self.postMessage({
        type: 'error',
        error: 'No image source provided to worker',
      } satisfies WorkerOutgoingMessage);
      return;
    }

    try {
      // 1. Ensure Model is Loaded
      self.postMessage({
        type: 'status',
        status: 'loading-model',
      } satisfies WorkerOutgoingMessage);

      if (!activeModelBundle) {
        activeModelBundle = await loadBiRefNetModel((progress: ModelProgressInfo) => {
          self.postMessage({
            type: 'progress',
            progressInfo: progress,
          } satisfies WorkerOutgoingMessage);
        }, preferredRuntime);
      }

      // 2. Status: Removing Background
      self.postMessage({
        type: 'status',
        status: 'removing-background',
        runtime: activeModelBundle.runtime,
      } satisfies WorkerOutgoingMessage);

      // 3. Preprocess to 512x512 NCHW Float32
      const preprocessed = preprocessToNCHW(source, MODEL_INPUT_SIZE);

      // 4. Run AI Inference
      const { logits, inferenceTimeMs, runtime } = await runBiRefNetInference(
        preprocessed,
        activeModelBundle
      );

      // 5. Postprocess: Continuous Alpha Matte
      const alphaMatte512 = logitsToAlphaMatte(logits, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

      // 6. Upscale mask to original image dimensions (e.g. 4000x3000)
      const fullAlpha = upscaleMaskToOriginal(alphaMatte512, width, height);

      // 7. Apply mask to original RGB image
      const resultImageData = applyAlphaToOriginal(source, width, height, fullAlpha);

      const totalTimeMs = Math.round(performance.now() - totalStart);

      // 8. Convert to ImageBitmap for zero-copy postMessage transfer
      const resultBitmap = await imageDataToBitmap(resultImageData);

      const outgoing: WorkerOutgoingMessage = {
        type: 'result',
        result: {
          resultBitmap,
          metrics: {
            inferenceTimeMs,
            totalTimeMs,
            runtime,
            inputWidth: width,
            inputHeight: height,
            modelInputWidth: MODEL_INPUT_SIZE,
            modelInputHeight: MODEL_INPUT_SIZE,
            modelName: 'BiRefNet-lite 512',
          },
        },
      };

      // Transfer resultBitmap to avoid memory copying
      self.postMessage(outgoing, [resultBitmap]);
    } catch (err: any) {
      console.error('[AI Worker] Error during background removal:', err);
      self.postMessage({
        type: 'error',
        error: err?.message || 'An error occurred during inference',
      } satisfies WorkerOutgoingMessage);
    }
  }
});
