import React from 'react';
import { AVAILABLE_MODELS } from '../ai/registry';
import type { ModelId, ModelCacheStatus } from '../types';
import { Check, Download, Loader2, Sparkles, Zap, User, HardDrive } from 'lucide-react';

interface ModelSelectorProps {
  selectedModelId: ModelId;
  onSelectModel: (id: ModelId) => void;
  onDownloadModel?: (id: ModelId) => void;
  cacheStates: Record<ModelId, ModelCacheStatus>;
  downloadProgress?: Record<ModelId, number | undefined>;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
  onDownloadModel,
  cacheStates,
  downloadProgress,
  disabled = false,
}) => {
  const getBadgeIcon = (id: ModelId) => {
    switch (id) {
      case 'birefnet-lite-512':
        return <Sparkles className="w-3.5 h-3.5 text-indigo-400" />;
      case 'isnet-int8':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'modnet':
        return <User className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getStatusBadge = (modelId: ModelId) => {
    const status = cacheStates[modelId] || 'not-downloaded';
    const progress = downloadProgress?.[modelId];

    switch (status) {
      case 'ready':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md">
            <Check className="w-3 h-3" />
            <span>Ready</span>
          </span>
        );
      case 'cached':
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-md">
            <HardDrive className="w-3 h-3" />
            <span>Downloaded</span>
          </span>
        );
      case 'downloading':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded-md">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{progress !== undefined ? `${progress}%` : 'Downloading...'}</span>
          </span>
        );
      case 'loading':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded-md">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading...</span>
          </span>
        );
      case 'error':
        return (
          <span className="text-[11px] font-medium text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-md">
            Error
          </span>
        );
      case 'not-downloaded':
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-800/60 border border-zinc-700/60 px-2 py-0.5 rounded-md">
            <Download className="w-3 h-3 text-zinc-400" />
            <span>Download</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Choose AI Model
        </label>
        <span className="text-[11px] text-zinc-500">
          Lazy-loaded on demand • Cached in browser
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {AVAILABLE_MODELS.map((model) => {
          const isSelected = selectedModelId === model.id;
          const status = cacheStates[model.id] || 'not-downloaded';
          const progress = downloadProgress?.[model.id];

          return (
            <div
              key={model.id}
              onClick={() => {
                if (!disabled) {
                  onSelectModel(model.id);
                }
              }}
              className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-md shadow-indigo-950/30 ring-1 ring-indigo-500/50'
                  : 'border-zinc-800/90 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80'
              } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {/* Header: Radio circle + Badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-zinc-600 bg-zinc-800'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                    {getBadgeIcon(model.id)}
                    {model.badge}
                  </span>
                </div>

                {getStatusBadge(model.id)}
              </div>

              {/* Model Info */}
              <div className="space-y-1 my-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-200 truncate">
                    {model.name}
                  </h3>
                  <span className="text-xs font-mono text-zinc-400 shrink-0">
                    {model.size}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2">
                  {model.description}
                </p>
              </div>

              {/* Progress bar if currently downloading */}
              {status === 'downloading' && (
                <div className="w-full mt-2.5">
                  <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(5, progress || 0)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Footer specs */}
              <div className="mt-3 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Speed: <strong className="text-zinc-300 font-normal">{model.speed}</strong></span>
                <span>Quality: <strong className="text-zinc-300 font-normal">{model.quality}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
