import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ImagePreviewProps {
  imageUrl: string;
  width?: number;
  height?: number;
  fileName?: string;
  fileSize?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageUrl,
  width,
  height,
  fileName,
  fileSize,
}) => {
  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
          <span>Original</span>
        </div>
        {width && height && (
          <span className="font-mono text-[11px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            {width} × {height} px
          </span>
        )}
      </div>

      <div className="relative aspect-[4/3] sm:aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner group">
        <img
          src={imageUrl}
          alt="Original preview"
          className="max-h-full max-w-full object-contain select-none"
        />

        {fileName && (
          <div className="absolute bottom-2 left-2 right-2 bg-zinc-950/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-300 truncate">
            {fileName} {fileSize && <span className="text-zinc-500 ml-1">({fileSize})</span>}
          </div>
        )}
      </div>
    </div>
  );
};
