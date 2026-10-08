/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ModelSelector } from './components/ModelSelector';
import { ImageUploader } from './components/ImageUploader';
import { ImagePreview } from './components/ImagePreview';
import { ResultPreview } from './components/ResultPreview';
import { CompareSlider } from './components/CompareSlider';
import { ProcessingStatus } from './components/ProcessingStatus';
import { PerformanceBar } from './components/PerformanceBar';
import { MODEL_REGISTRY, DEFAULT_MODEL_ID, getModelMetadata } from './ai/registry';
import { detectBestRuntime } from './ai/runtime';
import { isModelCached, markModelAsCached } from './ai/cache';
import type {
  ExecutionRuntime,
  ModelId,
  ModelCacheStatus,
  ProcessingStatus as StatusType,
  ModelProgressInfo,
  ProcessingMetrics,
  WorkerOutgoingMessage,
} from './types';
import { Columns2, SlidersHorizontal, ShieldCheck } from 'lucide-react';

const STORAGE_SELECTED_MODEL = 'background-removal-selected-model';

export default function App() {
  // Selected Model (persisted locally, but never auto-downloaded on page load)
  const [selectedModelId, setSelectedModelId] = useState<ModelId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SELECTED_MODEL) as ModelId;
      if (saved && MODEL_REGISTRY[saved]) {
        return saved;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_MODEL_ID;
  });

  // Model cache and download progress states
  const [cacheStates, setCacheStates] = useState<Record<ModelId, ModelCacheStatus>>({
    'birefnet-lite-512': 'not-downloaded',
    'isnet-int8': 'not-downloaded',
    'modnet': 'not-downloaded',
  });
  const [downloadProgress, setDownloadProgress] = useState<Record<ModelId, number | undefined>>({
    'birefnet-lite-512': undefined,
    'isnet-int8': undefined,
    'modnet': undefined,
  });

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
  const [resultPngBlob, setResultPngBlob] = useState<Blob | null>(null);
  const [resultWebpBlob, setResultWebpBlob] = useState<Blob | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'side-by-side' | 'split'>('side-by-side');

  // Web Worker ref
  const workerRef = useRef<Worker | null>(null);

  // Check cache status for all models on mount (without downloading anything)
  useEffect(() => {
    const checkCaches = async () => {
      const states: Record<ModelId, ModelCacheStatus> = { ...cacheStates };
      for (const id of Object.keys(MODEL_REGISTRY) as ModelId[]) {
        const cached = await isModelCached(id);
        states[id] = cached ? 'cached' : 'not-downloaded';
      }
      setCacheStates(states);
    };
    checkCaches();
  }, []);

  // Initialize centralized runtime detection & Web Worker
  useEffect(() => {
    // 1. Centralized Runtime Detection
    detectBestRuntime().then((rt) => setDetectedRuntime(rt));

    // 2. Initialize Web Worker (LAZY-LOADED: do not send preload on page load!)
    try {
      const worker = new Worker(
        new URL('./workers/backgroundRemoval.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
        const {
          type,
          modelId: workerModelId,
          status: newStatus,
          progressInfo: progress,
          result,
          error: workerErr,
          runtime,
        } = event.data;

        const activeId = workerModelId || selectedModelId;

        if (type === 'status' && newStatus) {
          setStatus(newStatus);
          if (newStatus === 'loading-model') {
            setCacheStates((prev) => ({ ...prev, [activeId]: 'loading' }));
          }
          if (runtime) setDetectedRuntime(runtime);
        } else if (type === 'progress' && progress) {
          setProgressInfo(progress);
          if (progress.progress !== undefined) {
            setDownloadProgress((prev) => ({ ...prev, [activeId]: progress.progress }));
            setCacheStates((prev) => ({ ...prev, [activeId]: 'downloading' }));
          }
        } else if (type === 'model-ready') {
          markModelAsCached(activeId);
          setCacheStates((prev) => ({ ...prev, [activeId]: 'ready' }));
          if (status === 'loading-model') setStatus('idle');
          if (runtime) setDetectedRuntime(runtime);
        } else if (type === 'result' && result) {
          markModelAsCached(activeId);
          setCacheStates((prev) => ({ ...prev, [activeId]: 'ready' }));

          const { resultBitmap, metrics: resultMetrics } = result;
          if (resultBitmap) {
            // Render result bitmap to Canvas to create downloadable PNG and WebP blobs
            const canvas = document.createElement('canvas');
            canvas.width = resultBitmap.width;
            canvas.height = resultBitmap.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(resultBitmap, 0, 0);

              // 1. Transparent PNG
              canvas.toBlob((blob) => {
                if (blob) {
                  setResultPngBlob(blob);
                  const url = URL.createObjectURL(blob);
                  setResultUrl(url);
                }
              }, 'image/png');

              // 2. Transparent WebP
              canvas.toBlob((blob) => {
                if (blob) {
                  setResultWebpBlob(blob);
                }
              }, 'image/webp', 0.95);
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
          setCacheStates((prev) => ({ ...prev, [activeId]: 'error' }));
        }
      };

      worker.onerror = (e) => {
        console.error('[Main] Worker exception:', e);
        setError('Web Worker initialization error. Please reload.');
        setStatus('error');
      };

      workerRef.current = worker;
      // NOTE: Models are LAZY-LOADED. No model is downloaded until requested by the user.
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

  // Handle model selection: save to localStorage WITHOUT auto-downloading
  const handleSelectModel = useCallback((modelId: ModelId) => {
    setSelectedModelId(modelId);
    try {
      localStorage.setItem(STORAGE_SELECTED_MODEL, modelId);
    } catch {
      // Ignore
    }
  }, []);

  // Handle explicit model download request
  const handleDownloadModel = useCallback((modelId: ModelId) => {
    if (!workerRef.current) return;
    setStatus('loading-model');
    setCacheStates((prev) => ({ ...prev, [modelId]: 'downloading' }));
    workerRef.current.postMessage({
      type: 'load-model',
      payload: { modelId },
    });
  }, []);

  // Process selected image
  const processImageFile = useCallback(
    async (file: File) => {
      setError(null);
      setResultUrl(null);
      setResultPngBlob(null);
      setResultWebpBlob(null);
      setMetrics(null);
      setStatus('loading-model');

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

        // Send to Web Worker with transferable ImageBitmap and selectedModelId
        workerRef.current.postMessage(
          {
            type: 'process',
            payload: {
              modelId: selectedModelId,
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
    },
    [selectedModelId]
  );

  // Handle preset sample images
  const handleSampleSelected = useCallback(
    async (url: string, name: string) => {
      try {
        setStatus('loading-model');
        setError(null);
        // Fetch sample into a local blob
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `${name.toLowerCase()}.jpg`, {
          type: blob.type || 'image/jpeg',
        });
        processImageFile(file);
      } catch (err: any) {
        setError(`Failed to load sample image: ${err?.message}`);
        setStatus('error');
      }
    },
    [processImageFile]
  );

  // Handle Download PNG
  const handleDownloadPng = useCallback(() => {
    if (!resultPngBlob && !resultUrl) return;

    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}-nobg.png`;

    const a = document.createElement('a');
    a.href = resultUrl!;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resultPngBlob, resultUrl, originalName]);

  // Handle Download Transparent WebP
  const handleDownloadWebp = useCallback(() => {
    if (!resultWebpBlob) return;

    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}-nobg.webp`;

    const url = URL.createObjectURL(resultWebpBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [resultWebpBlob, originalName]);

  // Handle Reset / Upload New
  const handleReset = useCallback(() => {
    setOriginalUrl(null);
    setResultUrl(null);
    setResultPngBlob(null);
    setResultWebpBlob(null);
    setMetrics(null);
    setStatus('idle');
    setError(null);
  }, []);

  const isProcessing = status === 'loading-model' || status === 'removing-background';
  const selectedMetadata = getModelMetadata(selectedModelId);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        detectedRuntime={detectedRuntime}
        modelReady={status !== 'loading-model'}
        selectedModelName={selectedMetadata.name}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center">
        {/* Privacy Highlight Banner */}
        <div className="w-full mb-6 p-3 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Zero-Server Architecture:</strong> 100% Client-Side. Your images never leave your browser.
            </span>
          </div>

          <div className="flex items-center gap-3 text-zinc-400 text-[11px] shrink-0 font-mono">
            <span>Runtime: <strong className="text-zinc-200">{detectedRuntime || 'Checking...'}</strong></span>
          </div>
        </div>

        {/* Model Selector */}
        <div className="w-full mb-6">
          <ModelSelector
            selectedModelId={selectedModelId}
            onSelectModel={handleSelectModel}
            onDownloadModel={handleDownloadModel}
            cacheStates={cacheStates}
            downloadProgress={downloadProgress}
            disabled={isProcessing}
          />
        </div>

        {/* Upload State (when no image selected yet) */}
        {!originalUrl ? (
          <div className="w-full max-w-2xl my-auto py-2">
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
              modelName={selectedMetadata.name}
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
              modelName={selectedMetadata.name}
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

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
                  >
                    Download PNG
                  </button>
                  {resultWebpBlob && (
                    <button
                      type="button"
                      onClick={handleDownloadWebp}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
                    >
                      Download WebP
                    </button>
                  )}
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
                  onDownload={handleDownloadPng}
                  onDownloadWebp={handleDownloadWebp}
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
        selectedModelName={selectedMetadata.name}
      />
    </div>
  );
}
