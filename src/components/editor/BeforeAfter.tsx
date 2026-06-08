"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

type BeforeAfterProps = {
  baselineUrl: string | null;
  processedUrl: string | null;
  outputWidth: number;
  outputHeight: number;
  showCheckerboard?: boolean;
  className?: string;
};

export function BeforeAfter({
  baselineUrl,
  processedUrl,
  outputWidth,
  outputHeight,
  showCheckerboard = false,
  className,
}: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPosition(50);
  }, [baselineUrl, processedUrl]);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      containerRef.current?.setPointerCapture(event.pointerId);
      setIsDragging(true);
      updatePosition(event.clientX);
    },
    [updatePosition],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      updatePosition(event.clientX);
    },
    [isDragging, updatePosition],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (container?.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
      setIsDragging(false);
    },
    [],
  );

  if (!baselineUrl || !processedUrl) {
    return (
      <div
        className={cn(
          "bg-muted/30 text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-center text-sm sm:min-h-64 md:min-h-80",
          className,
        )}
      >
        <span className="text-2xl opacity-40">↔</span>
        Upload and edit an image to compare before and after
      </div>
    );
  }

  const aspectRatio =
    outputWidth > 0 && outputHeight > 0
      ? `${outputWidth} / ${outputHeight}`
      : "16 / 9";

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border shadow-[var(--shadow-soft)] select-none",
        showCheckerboard ? "checkerboard" : "bg-black",
        className,
      )}
      style={{ aspectRatio }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img
        src={processedUrl}
        alt="Enhanced"
        className="absolute inset-0 size-full object-contain"
        draggable={false}
      />
      <img
        src={baselineUrl}
        alt="Original resized"
        className="absolute inset-0 size-full object-contain"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        draggable={false}
      />
      <div
        className="absolute inset-y-0 z-10 w-0.5"
        style={{
          left: `${position}%`,
          background: "var(--gradient-accent)",
          boxShadow: "0 0 12px oklch(0.48 0.2 265 / 0.5)",
        }}
      >
        <button
          type="button"
          aria-label="Drag to compare"
          className={cn(
            "gradient-chip absolute top-1/2 left-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full shadow-lg touch-none sm:size-10",
            isDragging ? "scale-110" : "hover:scale-105",
            "transition-transform",
          )}
          onPointerDown={handlePointerDown}
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute top-3 left-3 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
        Before
      </div>
      <div className="pointer-events-none absolute top-3 right-3 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
        After
      </div>
    </div>
  );
}
