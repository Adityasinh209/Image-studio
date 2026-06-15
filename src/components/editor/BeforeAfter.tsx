"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

type BeforeAfterProps = {
  baselineUrl: string | null;
  processedUrl: string | null;
  outputWidth: number;
  outputHeight: number;
  showCheckerboard?: boolean;
  /** When true, scales the comparison to fit its parent height (laptop/desktop). */
  fill?: boolean;
  /** True while a newer preview is still rendering (deferred value catching up). */
  isStale?: boolean;
  onUploadClick?: () => void;
  className?: string;
};

export const BeforeAfter = memo(function BeforeAfter({
  baselineUrl,
  processedUrl,
  outputWidth,
  outputHeight,
  showCheckerboard = false,
  fill = false,
  isStale = false,
  onUploadClick,
  className,
}: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  /* Reset slider only when the source image or output size changes — not on every effect tweak */
  useEffect(() => {
    setPosition(50);
  }, [baselineUrl, outputWidth, outputHeight]);

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
          "bg-muted/30 text-muted-foreground flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-6 text-center text-sm sm:min-h-56",
          className,
        )}
      >
        <span className="text-2xl opacity-40">↔</span>
        <p className="max-w-xs leading-relaxed">
          Upload and edit an image to compare before &amp; after
        </p>
        {onUploadClick && (
          <button
            type="button"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            onClick={onUploadClick}
          >
            Open upload
          </button>
        )}
      </div>
    );
  }

  const aspectRatio =
    outputWidth > 0 && outputHeight > 0
      ? `${outputWidth} / ${outputHeight}`
      : "16 / 9";
  const isLandscape = outputWidth >= outputHeight;

  const comparison = (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-[var(--shadow-soft)] select-none transition-opacity duration-150",
        showCheckerboard ? "checkerboard" : "bg-black",
        fill ? "max-h-full max-w-full" : "max-h-full w-full",
        isStale && "opacity-90",
      )}
      style={
        fill
          ? {
              aspectRatio,
              width: isLandscape ? "100%" : "auto",
              height: isLandscape ? "auto" : "100%",
              maxWidth: "100%",
              maxHeight: "100%",
            }
          : { aspectRatio }
      }
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img
        src={processedUrl}
        alt="Enhanced"
        className="absolute inset-0 size-full object-contain"
        draggable={false}
        decoding="async"
      />
      <img
        src={baselineUrl}
        alt="Original resized"
        className="absolute inset-0 size-full object-contain"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        draggable={false}
        decoding="async"
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
            "gradient-chip absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full shadow-lg touch-none sm:size-11 lg:size-10",
            isDragging ? "scale-110" : "hover:scale-105",
            "transition-transform",
          )}
          onPointerDown={handlePointerDown}
        >
          <GripVertical className="size-5 sm:size-4" />
        </button>
      </div>
      <div className="pointer-events-none absolute top-2 left-2 rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-md sm:top-3 sm:left-3 sm:px-3 sm:py-1 sm:text-xs">
        Before
      </div>
      <div className="pointer-events-none absolute top-2 right-2 rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-md sm:top-3 sm:right-3 sm:px-3 sm:py-1 sm:text-xs">
        After
      </div>
    </div>
  );

  if (fill) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full items-center justify-center",
          className,
        )}
      >
        {comparison}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center overflow-hidden",
        className,
      )}
    >
      {comparison}
    </div>
  );
});
