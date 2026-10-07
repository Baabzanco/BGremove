/**
 * Postprocessing for BiRefNet-lite 512 segmentation output
 * - Sigmoid activation for continuous alpha matte [0, 1]
 * - Smooth resizing of 512x512 mask to original resolution
 * - Merging alpha channel with original RGB image
 */

export interface PostprocessOptions {
  /** Contrast/gamma adjustment if desired, default 1.0 (linear continuous) */
  contrast?: number;
  /** Edge feathering / smoothing radius, default 0 */
  featherRadius?: number;
}

/**
 * Converts raw logits tensor data to 512x512 alpha matte (0 to 255)
 */
export function logitsToAlphaMatte(
  logits: Float32Array,
  width = 512,
  height = 512
): Uint8ClampedArray {
  const pixelCount = width * height;
  const alphaMatte = new Uint8ClampedArray(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    // Sigmoid function: 1 / (1 + exp(-x))
    const logit = logits[i];
    const prob = 1.0 / (1.0 + Math.exp(-logit));
    // Store as 0 - 255
    alphaMatte[i] = Math.round(prob * 255);
  }

  return alphaMatte;
}

/**
 * Creates an OffscreenCanvas or Canvas containing the 512x512 mask
 */
function createMaskCanvas(
  alphaMatte512: Uint8ClampedArray,
  width = 512,
  height = 512
): OffscreenCanvas {
  const maskCanvas = new OffscreenCanvas(width, height);
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context for mask canvas');

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let i = 0; i < width * height; i++) {
    const a = alphaMatte512[i];
    const idx = i * 4;
    // Store grayscale in RGB channels to easily sample later
    data[idx] = a;
    data[idx + 1] = a;
    data[idx + 2] = a;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return maskCanvas;
}

/**
 * Interpolates the 512x512 alpha matte to target resolution (originalWidth x originalHeight)
 * using GPU-accelerated bicubic/bilinear smoothing via OffscreenCanvas
 */
export function upscaleMaskToOriginal(
  alphaMatte512: Uint8ClampedArray,
  origWidth: number,
  origHeight: number
): Uint8ClampedArray {
  const maskCanvas512 = createMaskCanvas(alphaMatte512, 512, 512);

  // Scaled canvas at original resolution
  const scaledCanvas = new OffscreenCanvas(origWidth, origHeight);
  const scaledCtx = scaledCanvas.getContext('2d', { willReadFrequently: true });
  if (!scaledCtx) throw new Error('Could not get 2D context for scaled canvas');

  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';
  scaledCtx.drawImage(maskCanvas512, 0, 0, origWidth, origHeight);

  const scaledImgData = scaledCtx.getImageData(0, 0, origWidth, origHeight);
  const scaledData = scaledImgData.data;
  const fullPixelCount = origWidth * origHeight;
  const fullAlpha = new Uint8ClampedArray(fullPixelCount);

  // Extract sampled alpha from Red channel (R=G=B=alpha)
  for (let i = 0; i < fullPixelCount; i++) {
    fullAlpha[i] = scaledData[i * 4];
  }

  return fullAlpha;
}

/**
 * Combines original image with upscaled alpha mask to produce final transparent RGBA ImageData
 */
export function applyAlphaToOriginal(
  originalBitmap: ImageBitmap | ImageData,
  origWidth: number,
  origHeight: number,
  fullAlpha: Uint8ClampedArray
): ImageData {
  let origData: Uint8ClampedArray;

  if (originalBitmap instanceof ImageData) {
    origData = originalBitmap.data;
  } else {
    const canvas = new OffscreenCanvas(origWidth, origHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2D context for original image');
    ctx.drawImage(originalBitmap, 0, 0, origWidth, origHeight);
    origData = ctx.getImageData(0, 0, origWidth, origHeight).data;
  }

  // Create resulting transparent ImageData
  const resultCanvas = new OffscreenCanvas(origWidth, origHeight);
  const resultCtx = resultCanvas.getContext('2d');
  if (!resultCtx) throw new Error('Failed to get 2D context for result image');

  const resultImageData = resultCtx.createImageData(origWidth, origHeight);
  const resultData = resultImageData.data;
  const totalPixels = origWidth * origHeight;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    resultData[idx] = origData[idx];         // Red (preserved)
    resultData[idx + 1] = origData[idx + 1]; // Green (preserved)
    resultData[idx + 2] = origData[idx + 2]; // Blue (preserved)
    resultData[idx + 3] = fullAlpha[i];      // Continuous Alpha matte
  }

  return resultImageData;
}

/**
 * Converts ImageData to ImageBitmap for zero-copy postMessage transfer
 */
export async function imageDataToBitmap(imageData: ImageData): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas for bitmap conversion');
  ctx.putImageData(imageData, 0, 0);
  return createImageBitmap(canvas);
}
