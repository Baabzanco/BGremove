import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Zap, Clock, HardDrive } from 'lucide-react';
import type { ProcessingStatus as StatusType, ModelProgressInfo, ProcessingMetrics } from '../types';

interface ProcessingStatusProps {
  status: StatusType;
  progressInfo?: ModelProgressInfo | null;
  metrics?: ProcessingMetrics | null;
  error?: string | null;
  modelName?: string;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  progressInfo,
  metrics,
  error,
  modelName,
}) => {
  if (status === 'idle') return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const activeModelDisplay = metrics?.modelName || modelName || 'AI model';

  return (
    <div className="w-full my-4 rounded-xl border p-4 transition-all duration-300">
      {status === 'loading-model' && (
        <div className="flex flex-col gap-2.5 bg-indigo-950/20 border-indigo-900/50 text-indigo-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="font-medium text-sm text-indigo-200">
                Loading {activeModelDisplay}...
              </span>
            </div>
            {progressInfo?.progress !== undefined && (
              <span className="text-xs font-mono text-indigo-300">
                {progressInfo.progress}%
                {progressInfo.loaded && progressInfo.total && (
                  <span className="text-zinc-400 ml-1.5">
                    ({formatBytes(progressInfo.loaded)} / {formatBytes(progressInfo.total)})
                  </span>
                )}
              </span>
            )}
          </div>

          {progressInfo?.progress !== undefined ? (
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.max(5, progressInfo.progress)}%` }}
              />
            </div>
          ) : (
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full w-1/3 animate-pulse" />
            </div>
          )}

          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
            <span>Model weights are saved in browser storage after first download.</span>
          </p>
        </div>
      )}

      {status === 'removing-background' && (
        <div className="flex items-center justify-between bg-zinc-900/60 border-zinc-800 text-zinc-200 p-2">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            <span className="font-medium text-sm text-zinc-100">
              Removing background with {activeModelDisplay}...
            </span>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            Client-side segmentation
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-950/20 border-emerald-900/40 text-emerald-300 p-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-sm text-emerald-200">
              Background removed successfully
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            {metrics?.inferenceTimeMs !== undefined && (
              <span className="flex items-center gap-1 text-zinc-300 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                <Clock className="w-3 h-3 text-zinc-400" />
                Processing time: <strong className="text-emerald-400">{metrics.inferenceTimeMs} ms</strong>
              </span>
            )}
            {metrics?.runtime && (
              <span className="flex items-center gap-1 text-zinc-300 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                <Zap className="w-3 h-3 text-amber-400" />
                Runtime: <strong className="text-zinc-200">{metrics.runtime}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2.5 bg-red-950/30 border-red-900/60 text-red-300 p-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <strong className="font-semibold text-red-200">Processing Error: </strong>
            <span>{error || 'Unable to process image. Please try another image or reload.'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
