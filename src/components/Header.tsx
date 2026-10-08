import React from 'react';
import { ShieldCheck, Cpu, Sparkles } from 'lucide-react';
import type { ExecutionRuntime } from '../types';

interface HeaderProps {
  detectedRuntime?: ExecutionRuntime | null;
  modelReady?: boolean;
  selectedModelName?: string;
}

export const Header: React.FC<HeaderProps> = ({ detectedRuntime, modelReady, selectedModelName }) => {
  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white">
                AI Background Remover
              </h1>
              <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {selectedModelName || 'Multi-Model AI'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 inline shrink-0" />
              <span>100% private — your image never leaves your browser</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-zinc-400">Engine:</span>
            <span className="font-medium text-zinc-200">
              {detectedRuntime ? (
                <span className={detectedRuntime === 'WebGPU' ? 'text-emerald-400' : 'text-amber-400'}>
                  {detectedRuntime}
                </span>
              ) : (
                'WebGPU / WASM'
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Local Inference</span>
          </div>
        </div>
      </div>
    </header>
  );
};
