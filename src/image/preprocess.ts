/**
 * Image preprocessing for BiRefNet-lite 512
 * - Target resolution: 512x512
 * - Normalization: ImageNet (mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225])
 * - Rescale factor: 1 / 255.0
 * - Format: NCHW [1, 3, 512, 512] float32
 */

export const MODEL_INPUT_SIZE = 512;

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

export interface PreprocessOutput {
  tensorData: Float32Array; // 1 * 3 * 512 * 512 = 786432 values
  dims: [number, number, number, number];
}

/**
 * Preprocesses an ImageBitmap or ImageData into a normalized NCHW Float32Array tensor.
 */
export function preprocessToNCHW(
  source: ImageBitmap | ImageData,
  targetSize = MODEL_INPUT_SIZE
): PreprocessOutput {
  const width = targetSize;
  const height = targetSize;
  let sourceImageData: ImageData;

  if (source instanceof ImageData) {
    if (source.width === width && source.height === height) {
      sourceImageData = source;
    } else {
      sourceImageData = resizeImageData(source, width, height);
    }
  } else {
    // ImageBitmap: draw to OffscreenCanvas or regular Canvas
    sourceImageData = sampleBitmapToImageData(source, width, height);
  }

  const { data } = sourceImageData;
  const pixelCount = width * height;
  const tensorData = new Float32Array(3 * pixelCount);

  const rOffset = 0;
  const gOffset = pixelCount;
  const bOffset = 2 * pixelCount;

  for (let i = 0; i < pixelCount; i++) {
    const srcIdx = i * 4;
    // Rescale to [0, 1] then normalize
    const r = data[srcIdx] / 255.0;
    const g = data[srcIdx + 1] / 255.0;
    const b = data[srcIdx + 2] / 255.0;

    tensorData[rOffset + i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    tensorData[gOffset + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    tensorData[bOffset + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return {
    tensorData,
    dims: [1, 3, height, width],
  };
}

/**
 * Samples an ImageBitmap onto an OffscreenCanvas of dimensions width x height
 */
function sampleBitmapToImageData(bitmap: ImageBitmap, width: number, height: number): ImageData {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D context from OffscreenCanvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } else if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D context from Canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  }
  throw new Error('Canvas / OffscreenCanvas is not available in current environment');
}

/**
 * Resizes an ImageData to target dimensions using OffscreenCanvas
 */
function resizeImageData(imgData: ImageData, targetW: number, targetH: number): ImageData {
  if (typeof OffscreenCanvas !== 'undefined') {
    const srcCanvas = new OffscreenCanvas(imgData.width, imgData.height);
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) throw new Error('Could not get 2D context');
    srcCtx.putImageData(imgData, 0, 0);

    const destCanvas = new OffscreenCanvas(targetW, targetH);
    const destCtx = destCanvas.getContext('2d', { willReadFrequently: true });
    if (!destCtx) throw new Error('Could not get 2D context');
    destCtx.imageSmoothingEnabled = true;
    destCtx.imageSmoothingQuality = 'high';
    destCtx.drawImage(srcCanvas, 0, 0, targetW, targetH);
    return destCtx.getImageData(0, 0, targetW, targetH);
  }
  throw new Error('OffscreenCanvas required for resizing ImageData in Worker');
}
