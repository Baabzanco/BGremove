/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ImagePreview } from './components/ImagePreview';
import { ResultPreview } from './components/ResultPreview';
import { CompareSlider } from './components/CompareSlider';
import { ProcessingStatus } from './components/ProcessingStatus';
import { PerformanceBar } from './components/PerformanceBar';
import type {
  ExecutionRuntime,
  ProcessingStatus as StatusType,
  ModelProgressInfo,
  ProcessingMetrics,
  WorkerOutgoingMessage,
} from './types';
import { Columns2, SlidersHorizontal, ShieldCheck, Cpu } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<StatusType>('idle');
  const [progressInfo, setProgressInfo] = useState<ModelProgressInfo | null>(null);
  const [metrics, setMetrics] = useState<ProcessingMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedRuntime, setDetectedRuntime] = useState<ExecutionRuntime | null>(null);

  // Images state
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string>('image.png');
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [originalSizeStr, setOriginalSizeStr] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'side-by-side' | 'split'>('side-by-side');

  // Web Worker ref
  const workerRef = useRef<Worker | null>(null);

  // Initialize Worker and detect hardware WebGPU capability
  useEffect(() => {
    // 1. Detect WebGPU
    const checkGPU = async () => {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            setDetectedRuntime('WebGPU');
            return;
          }
        } catch {
          // Fallback to WASM
        }
      }
      setDetectedRuntime('WASM');
    };
    checkGPU();

    // 2. Initialize Web Worker
    try {
      const worker = new Worker(
        new URL('./workers/backgroundRemoval.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
        const { type, status: newStatus, progressInfo: progress, result, error: workerErr, runtime } = event.data;

        if (type === 'status' && newStatus) {
          setStatus(newStatus);
          if (runtime) setDetectedRuntime(runtime);
        } else if (type === 'progress' && progress) {
          setProgressInfo(progress);
        } else if (type === 'result' && result) {
          const { resultBitmap, metrics: resultMetrics } = result;
          if (resultBitmap) {
            // Render result bitmap to OffscreenCanvas or Canvas to create downloadable PNG blob
            const canvas = document.createElement('canvas');
            canvas.width = resultBitmap.width;
            canvas.height = resultBitmap.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(resultBitmap, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) {
                  setResultBlob(blob);
                  const url = URL.createObjectURL(blob);
                  setResultUrl(url);
                }
              }, 'image/png');
            }
          }
          setMetrics(resultMetrics);
          if (resultMetrics.runtime) {
            setDetectedRuntime(resultMetrics.runtime);
          }
          setStatus('success');
        } else if (type === 'error') {
          console.error('[Main] Worker error:', workerErr);
          setError(workerErr || 'Failed to process image');
          setStatus('error');
        }
      };

      worker.onerror = (e) => {
        console.error('[Main] Worker exception:', e);
        setError('Web Worker initialization error. Please reload.');
        setStatus('error');
      };

      workerRef.current = worker;

      // Warm up model in background
      worker.postMessage({ type: 'preload' });
    } catch (e: any) {
      console.error('[Main] Failed to create Web Worker:', e);
      setError('Web Worker support is required for background inference.');
      setStatus('error');
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Process selected image
  const processImageFile = useCallback(async (file: File) => {
    setError(null);
    setResultUrl(null);
    setResultBlob(null);
    setMetrics(null);
    setStatus('removing-background');

    const fileName = file.name || 'image.png';
    setOriginalName(fileName);
    setOriginalSizeStr(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);

    // Create local object URL for preview (strictly local in browser memory)
    const localUrl = URL.createObjectURL(file);
    setOriginalUrl(localUrl);

    try {
      // Decode image locally using ImageBitmap
      const imageBitmap = await createImageBitmap(file);
      const { width, height } = imageBitmap;
      setOriginalDimensions({ width, height });

      if (!workerRef.current) {
        throw new Error('Worker is not available');
      }

      // Send to Web Worker with transferable ImageBitmap
      workerRef.current.postMessage(
        {
          type: 'process',
          payload: {
            imageBitmap,
            width,
            height,
          },
        },
        [imageBitmap]
      );
    } catch (err: any) {
      console.error('[Main] Error reading image file:', err);
      setError(err?.message || 'Failed to read image file');
      setStatus('error');
    }
  }, []);

  // Handle preset sample images
  const handleSampleSelected = useCallback(async (url: string, name: string) => {
    try {
      setStatus('loading-model');
      setError(null);
      // Fetch sample into a local blob
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `${name.toLowerCase()}.jpg`, { type: blob.type || 'image/jpeg' });
      processImageFile(file);
    } catch (err: any) {
      setError(`Failed to load sample image: ${err?.message}`);
      setStatus('error');
    }
  }, [processImageFile]);

  // Handle Download PNG
  const handleDownload = useCallback(() => {
    if (!resultBlob && !resultUrl) return;

    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}-nobg.png`;

    const a = document.createElement('a');
    a.href = resultUrl!;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resultBlob, resultUrl, originalName]);

  // Handle Reset / Upload New
  const handleReset = useCallback(() => {
    setOriginalUrl(null);
    setResultUrl(null);
    setResultBlob(null);
    setMetrics(null);
    setStatus('idle');
    setError(null);
  }, []);

  const isProcessing = status === 'loading-model' || status === 'removing-background';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header detectedRuntime={detectedRuntime} modelReady={status !== 'loading-model'} />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center">
        {/* Privacy Highlight Banner */}
        <div className="w-full mb-6 p-3 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Zero-Server Architecture:</strong> Your photo is segmented directly inside your browser using{' '}
              <span className="text-indigo-300 font-semibold">BiRefNet-lite 512</span> ONNX Runtime Web.
            </span>
          </div>

          <div className="flex items-center gap-3 text-zinc-400 text-[11px] shrink-0 font-mono">
            <span>Execution Provider: {detectedRuntime || 'Checking...'}</span>
          </div>
        </div>

        {/* Upload State (when no image selected yet) */}
        {!originalUrl ? (
          <div className="w-full max-w-2xl my-auto py-6">
            <ImageUploader
              onImageSelected={processImageFile}
              onSampleSelected={handleSampleSelected}
              disabled={isProcessing}
            />

            <ProcessingStatus
              status={status}
              progressInfo={progressInfo}
              metrics={metrics}
              error={error}
            />
          </div>
        ) : (
          /* Preview and Results State */
          <div className="w-full flex flex-col gap-5">
            {/* Processing Status Banner */}
            <ProcessingStatus
              status={status}
              progressInfo={progressInfo}
              metrics={metrics}
              error={error}
            />

            {/* View Mode Switcher (Side-by-side vs Split Slider) */}
            {resultUrl && (
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-medium text-zinc-400">
                  Comparison Mode:
                </span>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('side-by-side')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'side-by-side'
                        ? 'bg-zinc-800 text-white font-medium shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>Side-by-Side</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'split'
                        ? 'bg-zinc-800 text-white font-medium shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Split Slider</span>
                  </button>
                </div>
              </div>
            )}

            {/* Split Comparison Slider View */}
            {resultUrl && viewMode === 'split' ? (
              <div className="flex flex-col gap-4">
                <CompareSlider
                  originalUrl={originalUrl}
                  resultUrl={resultUrl}
                  width={originalDimensions?.width}
                  height={originalDimensions?.height}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
                  >
                    Download PNG
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm border border-zinc-700 transition-colors cursor-pointer"
                  >
                    New Image
                  </button>
                </div>
              </div>
            ) : (
              /* Side-by-Side View (Original vs Result) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <ImagePreview
                  imageUrl={originalUrl}
                  width={originalDimensions?.width}
                  height={originalDimensions?.height}
                  fileName={originalName}
                  fileSize={originalSizeStr}
                />

                <ResultPreview
                  resultUrl={resultUrl}
                  isLoading={isProcessing}
                  width={originalDimensions?.width}
                  height={originalDimensions?.height}
                  onDownload={handleDownload}
                  onReset={handleReset}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Performance Information Bar */}
      <PerformanceBar
        metrics={metrics}
        detectedRuntime={detectedRuntime || undefined}
      />
    </div>
  );
}
