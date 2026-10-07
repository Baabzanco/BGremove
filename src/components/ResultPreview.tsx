import React, { useState } from 'react';
import { Download, Sparkles, Check, RefreshCw } from 'lucide-react';

interface ResultPreviewProps {
  resultUrl: string | null;
  isLoading: boolean;
  width?: number;
  height?: number;
  onDownload: () => void;
  onReset: () => void;
}

type BgOption = 'checkerboard' | 'white' | 'black' | 'gray' | 'custom';

export const ResultPreview: React.FC<ResultPreviewProps> = ({
  resultUrl,
  isLoading,
  width,
  height,
  onDownload,
  onReset,
}) => {
  const [bgOption, setBgOption] = useState<BgOption>('checkerboard');
  const [customColor, setCustomColor] = useState('#2563eb');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadClick = () => {
    onDownload();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const getBgStyle = () => {
    switch (bgOption) {
      case 'white':
        return { backgroundColor: '#ffffff' };
      case 'black':
        return { backgroundColor: '#000000' };
      case 'gray':
        return { backgroundColor: '#6b7280' };
      case 'custom':
        return { backgroundColor: customColor };
      case 'checkerboard':
      default:
        return {
          backgroundImage: `
            linear-gradient(45deg, #27272a 25%, transparent 25%),
            linear-gradient(-45deg, #27272a 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #27272a 75%),
            linear-gradient(-45deg, transparent 75%, #27272a 75%)
          `,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: '#18181b',
        };
    }
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <div className="flex items-center gap-1.5 font-medium text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Result</span>
        </div>
        {width && height && (
          <span className="font-mono text-[11px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            {width} × {height} px (Alpha PNG)
          </span>
        )}
      </div>

      {/* Main Preview Container with Checkerboard or custom BG */}
      <div
        style={getBgStyle()}
        className="relative aspect-[4/3] sm:aspect-square w-full rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center shadow-inner group transition-colors duration-150"
      >
        {resultUrl ? (
          <img
            src={resultUrl}
            alt="Transparent result"
            className="max-h-full max-w-full object-contain select-none transition-transform duration-200"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-300">Processing segmentation...</span>
              </div>
            ) : (
              <span className="text-xs">Result will appear here</span>
            )}
          </div>
        )}
      </div>

      {/* Controls below result */}
      {resultUrl && (
        <div className="flex flex-col gap-3 pt-1">
          {/* Background Tester Tabs */}
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
            <span className="text-zinc-400 text-[11px] font-medium pl-1 hidden sm:inline">
              Preview BG:
            </span>
            <div className="flex items-center gap-1 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setBgOption('checkerboard')}
                title="Transparent Checkerboard"
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  bgOption === 'checkerboard'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Checker
              </button>
              <button
                type="button"
                onClick={() => setBgOption('white')}
                title="White Background"
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  bgOption === 'white'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                White
              </button>
              <button
                type="button"
                onClick={() => setBgOption('black')}
                title="Black Background"
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  bgOption === 'black'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Black
              </button>
              <button
                type="button"
                onClick={() => setBgOption('gray')}
                title="Gray Background"
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  bgOption === 'gray'
                    ? 'bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Gray
              </button>
              <label
                title="Custom Color"
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer ${
                  bgOption === 'custom' ? 'bg-zinc-700' : 'hover:bg-zinc-800'
                }`}
              >
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    setBgOption('custom');
                  }}
                  className="w-4 h-4 rounded-full border-0 p-0 bg-transparent cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Action Buttons: Download PNG & Reset */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={isLoading || !resultUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-md shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download PNG</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onReset}
              title="Upload new image"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-sm border border-zinc-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
