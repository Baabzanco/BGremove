import React from 'react';
import { Cpu, Zap, Maximize2, Shield, Clock } from 'lucide-react';
import type { ProcessingMetrics } from '../types';

interface PerformanceBarProps {
  metrics: ProcessingMetrics | null;
  detectedRuntime?: string;
  selectedModelName?: string;
}

export const PerformanceBar: React.FC<PerformanceBarProps> = ({
  metrics,
  detectedRuntime,
  selectedModelName,
}) => {
  return (
    <footer className="w-full mt-10 border-t border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm py-4 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-zinc-400">
        {/* Performance metrics grid */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-zinc-500">AI Model:</span>
            <span className="font-semibold text-zinc-200">
              {metrics?.modelName || selectedModelName || 'BiRefNet-lite 512'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-zinc-500">Runtime:</span>
            <span className="font-semibold text-zinc-200">
              {metrics?.runtime || detectedRuntime || 'WebGPU / WASM'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-500">Input:</span>
            <span className="font-mono text-zinc-200">
              {metrics ? `${metrics.inputWidth} × ${metrics.inputHeight}` : '—'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Model Input:</span>
            <span className="font-mono text-zinc-200">
              {metrics ? `${metrics.modelInputWidth} × ${metrics.modelInputHeight}` : '512 × 512'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-500">Processing Time:</span>
            <span className="font-mono text-emerald-300 font-semibold">
              {metrics ? `${metrics.inferenceTimeMs} ms` : '—'}
            </span>
          </div>
        </div>

        {/* Privacy verification badge */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 border-t md:border-t-0 border-zinc-800/60 pt-2 md:pt-0">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local memory processing • 0 bytes uploaded to any server</span>
        </div>
      </div>
    </footer>
  );
};
