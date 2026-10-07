import { Tensor } from '@huggingface/transformers';
import type { PreprocessOutput } from '../image/preprocess';
import { loadBiRefNetModel, type LoadedModelBundle } from './model';
import type { ExecutionRuntime } from '../types';

export interface InferenceResult {
  logits: Float32Array; // 512 * 512 = 262144 values
  inferenceTimeMs: number;
  runtime: ExecutionRuntime;
}

/**
 * Runs BiRefNet-lite 512 inference on preprocessed tensor.
 */
export async function runBiRefNetInference(
  preprocessed: PreprocessOutput,
  modelBundle?: LoadedModelBundle
): Promise<InferenceResult> {
  const bundle = modelBundle || (await loadBiRefNetModel());
  const { model, runtime } = bundle;

  // Build input tensor [1, 3, 512, 512]
  const inputTensor = new Tensor(
    'float32',
    preprocessed.tensorData,
    preprocessed.dims
  );

  const t0 = performance.now();

  // BiRefNet-lite expects input name 'input_image'
  const feeds = { input_image: inputTensor };
  const outputs = await model.sessions.model.run(feeds);

  const t1 = performance.now();
  const inferenceTimeMs = Math.round(t1 - t0);

  // Output tensor is 'output_image' [1, 1, 512, 512]
  const outputTensor = outputs.output_image;
  if (!outputTensor || !outputTensor.data) {
    throw new Error('BiRefNet model did not return output_image tensor');
  }

  const logits = outputTensor.data as Float32Array;

  return {
    logits,
    inferenceTimeMs,
    runtime,
  };
}
