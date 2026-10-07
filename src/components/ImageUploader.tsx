import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  onSampleSelected?: (url: string, name: string) => void;
  disabled?: boolean;
}

// Curated public domain / test samples for instant 1-click verification
const SAMPLE_IMAGES = [
  {
    name: 'Portrait',
    description: 'Fine hair & soft edges',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    thumb: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=70',
  },
  {
    name: 'Product',
    description: 'Crisp product contours',
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    thumb: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=70',
  },
  {
    name: 'Pet',
    description: 'Detailed fur boundaries',
    url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    thumb: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=200&q=70',
  },
  {
    name: 'Automobile',
    description: 'Complex reflections & wheels',
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    thumb: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=200&q=70',
  },
];

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageSelected,
  onSampleSelected,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (isValidImage(file)) {
        onImageSelected(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (isValidImage(file)) {
        onImageSelected(file);
      }
      e.target.value = '';
    }
  };

  const isValidImage = (file: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return validTypes.includes(file.type);
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-200 ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-950/20 scale-[0.99]'
            : 'border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/70'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-300 group-hover:text-indigo-400 group-hover:border-indigo-500/50 group-hover:scale-105 transition-all duration-200 shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <p className="text-base sm:text-lg font-semibold text-zinc-100">
              Drop your image here
            </p>
            <p className="text-xs sm:text-sm text-zinc-400">
              or
            </p>
            <button
              type="button"
              className="mt-1 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm transition-colors shadow-sm cursor-pointer"
            >
              Choose Image
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400 pt-2">
            <span>Supports: JPG, JPEG, PNG, WebP</span>
            <span>•</span>
            <span className="text-emerald-400 font-medium">100% Client-Side</span>
          </div>
        </div>
      </div>

      {/* Preset Test Samples */}
      {onSampleSelected && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Or try a sample image:
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SAMPLE_IMAGES.map((sample) => (
              <button
                key={sample.name}
                type="button"
                disabled={disabled}
                onClick={() => onSampleSelected(sample.url, sample.name)}
                className="group relative flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 text-left transition-all duration-150 cursor-pointer disabled:opacity-50"
              >
                <img
                  src={sample.thumb}
                  alt={sample.name}
                  className="w-11 h-11 rounded-lg object-cover bg-zinc-800 shrink-0 border border-zinc-700/50 group-hover:scale-105 transition-transform"
                  crossOrigin="anonymous"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                    {sample.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">
                    {sample.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
