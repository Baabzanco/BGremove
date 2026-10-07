import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CompareSliderProps {
  originalUrl: string;
  resultUrl: string;
  width?: number;
  height?: number;
}

export const CompareSlider: React.FC<CompareSliderProps> = ({
  originalUrl,
  resultUrl,
}) => {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const handleMouseDown = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      updatePosition(e.clientX);
    };
    const handleMouseUp = () => setIsDragging(false);

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      updatePosition(e.touches[0].clientX);
    };
    const handleTouchEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, updatePosition]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <span className="font-medium text-zinc-300">Interactive Split Comparison</span>
        <span className="text-[11px] text-zinc-400">Drag center slider to inspect edges</span>
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-xl overflow-hidden border border-zinc-800 cursor-ew-resize select-none bg-[#18181b]"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #27272a 25%, transparent 25%),
            linear-gradient(-45deg, #27272a 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #27272a 75%),
            linear-gradient(-45deg, transparent 75%, #27272a 75%)
          `,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        }}
      >
        {/* Layer 1: Result Image (transparent PNG over checkerboard) */}
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <img
            src={resultUrl}
            alt="Result background removed"
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>

        {/* Layer 2: Original Image clipped to sliderPos */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
        >
          <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center p-2">
            <img
              src={originalUrl}
              alt="Original"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
          <span className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur-xs text-[11px] text-zinc-300 font-medium px-2 py-0.5 rounded border border-zinc-800">
            Original
          </span>
        </div>

        <span className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-xs text-[11px] text-emerald-400 font-medium px-2 py-0.5 rounded border border-zinc-800">
          Result
        </span>

        {/* Divider Bar */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.7)] pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg border border-zinc-200 text-xs font-bold">
            ↔
          </div>
        </div>
      </div>
    </div>
  );
};
