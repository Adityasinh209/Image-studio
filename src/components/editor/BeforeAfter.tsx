"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type BeforeAfterProps = {
  originalUrl: string | null;
  processedUrl: string | null;
  className?: string;
};

export function BeforeAfter({
  originalUrl,
  processedUrl,
  className,
}: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  if (!originalUrl || !processedUrl) {
    return (
      <div
        className={cn(
          "bg-muted/40 text-muted-foreground flex min-h-[360px] items-center justify-center rounded-xl border",
          className,
        )}
      >
        Upload and edit an image to compare before and after
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border bg-black select-none",
        className,
      )}
      onPointerMove={(event) => {
        if (isDragging) updatePosition(event.clientX);
      }}
      onPointerUp={() => setIsDragging(false)}
      onPointerLeave={() => setIsDragging(false)}
    >
      <img
        src={processedUrl}
        alt="Enhanced"
        className="absolute inset-0 size-full object-contain"
        draggable={false}
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={originalUrl}
          alt="Original"
          className="h-full max-w-none object-contain"
          style={{ width: containerRef.current?.offsetWidth ?? "100%" }}
          draggable={false}
        />
      </div>
      <div
        className="absolute inset-y-0 z-10 w-0.5 bg-white shadow-lg"
        style={{ left: `${position}%` }}
      >
        <button
          type="button"
          aria-label="Drag to compare"
          className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-white/90 shadow-md"
          onPointerDown={(event) => {
            event.preventDefault();
            setIsDragging(true);
            updatePosition(event.clientX);
          }}
        >
          <span className="text-foreground text-xs font-semibold">↔</span>
        </button>
      </div>
      <div className="pointer-events-none absolute top-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
        Before
      </div>
      <div className="pointer-events-none absolute top-3 right-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
        After
      </div>
    </div>
  );
}
