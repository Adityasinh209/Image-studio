"use client";

import { useEffect, useRef, useState } from "react";

import {
  applyCanvasFilters,
  applyDenoise,
  applySharpen,
} from "@/lib/canvasFilters";
import {
  computeOutputDimensions,
  type ImageAdjustments,
  type ResizeSettings,
} from "@/lib/imageOps";

type CanvasPreviewProps = {
  sourceUrl: string | null;
  originalWidth: number;
  originalHeight: number;
  adjustments: ImageAdjustments;
  resize: ResizeSettings;
  onProcessedUrlChange?: (url: string | null) => void;
};

export function CanvasPreview({
  sourceUrl,
  originalWidth,
  originalHeight,
  adjustments,
  resize,
  onProcessedUrlChange,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const outputDimensions = computeOutputDimensions(
    originalWidth,
    originalHeight,
    resize,
  );

  useEffect(() => {
    if (!sourceUrl) {
      onProcessedUrlChange?.(null);
      return;
    }

    const image = new Image();
    image.src = sourceUrl;
    imageRef.current = image;

    image.onload = () => {
      renderPreview();
    };

    return () => {
      image.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl, originalWidth, originalHeight]);

  useEffect(() => {
    if (!sourceUrl || !imageRef.current?.complete) return;

    const timeout = setTimeout(() => {
      renderPreview();
    }, adjustments.sharpness > 0 || adjustments.noiseReduction > 0 ? 120 : 0);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, resize, sourceUrl, outputDimensions.width, outputDimensions.height]);

  const renderPreview = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    setIsRendering(true);

    const { width, height } = outputDimensions;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    applyCanvasFilters(ctx, adjustments);
    ctx.drawImage(image, 0, 0, width, height);

    let imageData = ctx.getImageData(0, 0, width, height);

    if (adjustments.sharpness > 0) {
      imageData = applySharpen(imageData, adjustments.sharpness);
    }

    if (adjustments.noiseReduction > 0) {
      imageData = applyDenoise(imageData, adjustments.noiseReduction);
    }

    ctx.putImageData(imageData, 0, 0);
    onProcessedUrlChange?.(canvas.toDataURL("image/png"));
    setIsRendering(false);
  };

  if (!sourceUrl) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex min-h-[360px] items-center justify-center rounded-xl border">
        Upload an image to see the preview
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border bg-black/5">
      <canvas
        ref={canvasRef}
        className="mx-auto block max-h-[70vh] w-full object-contain"
      />
      {isRendering && (
        <div className="bg-background/70 absolute inset-0 flex items-center justify-center text-sm">
          Updating preview...
        </div>
      )}
    </div>
  );
}
