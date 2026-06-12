"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyCanvasFilters,
  applyDenoise,
  applyLook,
  applyRetouch,
  applySharpen,
  applyVignette,
  compositePortraitBokeh,
  drawImageToCanvas,
  fillBackground,
} from "@/lib/canvasFilters";
import {
  blurStrengthToPixels,
  computeOutputDimensions,
  getPreviewRenderSize,
  type BackgroundSettings,
  type EffectsSettings,
  type ImageAdjustments,
  type PortraitSettings,
  type PreviewUrls,
  type ResizeSettings,
} from "@/lib/imageOps";

type CanvasPreviewProps = {
  originalUrl: string | null;
  cutoutUrl: string | null;
  originalWidth: number;
  originalHeight: number;
  adjustments: ImageAdjustments;
  resize: ResizeSettings;
  background: BackgroundSettings;
  portrait: PortraitSettings;
  effects: EffectsSettings;
  /** Use cutout for transparent background (user-initiated removal only). */
  useBackgroundCutout?: boolean;
  onPreviewChange?: (preview: PreviewUrls | null) => void;
  hidden?: boolean;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export function CanvasPreview({
  originalUrl,
  cutoutUrl,
  originalWidth,
  originalHeight,
  adjustments,
  resize,
  background,
  portrait,
  effects,
  useBackgroundCutout = false,
  onPreviewChange,
  hidden = false,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const cutoutImageRef = useRef<HTMLImageElement | null>(null);
  const renderPreviewRef = useRef<() => void>(() => undefined);
  const [isRendering, setIsRendering] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const originalImage = originalImageRef.current;
    if (!canvas || !originalImage || !originalImage.complete) return;

    const baseWidth =
      originalWidth > 0 ? originalWidth : originalImage.naturalWidth;
    const baseHeight =
      originalHeight > 0 ? originalHeight : originalImage.naturalHeight;

    if (baseWidth <= 0 || baseHeight <= 0) return;

    const output = computeOutputDimensions(baseWidth, baseHeight, resize);
    if (output.width <= 0 || output.height <= 0) return;

    const previewSize = getPreviewRenderSize(output.width, output.height);
    if (previewSize.width <= 0 || previewSize.height <= 0) return;

    setIsRendering(true);

    try {
      canvas.width = previewSize.width;
      canvas.height = previewSize.height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const cutoutImage = cutoutImageRef.current;
      const portraitActive = portrait.enabled && Boolean(cutoutImage?.complete);
      const minEdge = Math.min(previewSize.width, previewSize.height);
      const blurPx = blurStrengthToPixels(portrait.blurStrength, minEdge);

      const drawBaseline = () => {
        ctx.filter = "none";
        ctx.clearRect(0, 0, previewSize.width, previewSize.height);
        drawImageToCanvas(
          ctx,
          originalImage,
          previewSize.width,
          previewSize.height,
          resize.mode,
        );
      };

      drawBaseline();
      const baseline = canvas.toDataURL("image/png");

      if (portraitActive && cutoutImage) {
        ctx.filter = "none";
        ctx.clearRect(0, 0, previewSize.width, previewSize.height);
        compositePortraitBokeh(
          ctx,
          originalImage,
          cutoutImage,
          previewSize.width,
          previewSize.height,
          resize.mode,
          adjustments,
          blurPx,
        );
      } else {
        fillBackground(ctx, previewSize.width, previewSize.height, background);
        applyCanvasFilters(ctx, adjustments);

        const useCutout =
          useBackgroundCutout && Boolean(cutoutImage?.complete);
        const sourceImage = useCutout ? cutoutImage! : originalImage;
        drawImageToCanvas(
          ctx,
          sourceImage,
          previewSize.width,
          previewSize.height,
          resize.mode,
        );
      }

      const needsSharpenDenoise =
        !portraitActive &&
        (adjustments.sharpness > 0 || adjustments.noiseReduction > 0);
      const needsLookRetouch = effects.look !== "none" || effects.retouch > 0;

      if (needsSharpenDenoise || needsLookRetouch) {
        let imageData = ctx.getImageData(
          0,
          0,
          previewSize.width,
          previewSize.height,
        );

        if (needsSharpenDenoise && adjustments.sharpness > 0) {
          imageData = applySharpen(imageData, adjustments.sharpness);
        }

        if (needsSharpenDenoise && adjustments.noiseReduction > 0) {
          imageData = applyDenoise(imageData, adjustments.noiseReduction);
        }

        if (effects.look !== "none") {
          imageData = applyLook(imageData, effects.look);
        }

        if (effects.retouch > 0) {
          imageData = applyRetouch(imageData, effects.retouch);
        }

        ctx.putImageData(imageData, 0, 0);
      }

      if (effects.vignette > 0) {
        applyVignette(
          ctx,
          previewSize.width,
          previewSize.height,
          effects.vignette,
        );
      }

      ctx.filter = "none";

      onPreviewChange?.({
        processed: canvas.toDataURL("image/png"),
        baseline,
        outputWidth: output.width,
        outputHeight: output.height,
      });
    } finally {
      setIsRendering(false);
    }
  }, [
    adjustments,
    background,
    cutoutUrl,
    effects,
    onPreviewChange,
    originalHeight,
    originalWidth,
    portrait,
    resize,
    useBackgroundCutout,
  ]);

  renderPreviewRef.current = renderPreview;

  useEffect(() => {
    if (!originalUrl) {
      originalImageRef.current = null;
      cutoutImageRef.current = null;
      setLoadError(false);
      onPreviewChange?.(null);
      return;
    }

    let cancelled = false;

    const urls: string[] = [originalUrl];
    if (cutoutUrl) urls.push(cutoutUrl);

    Promise.all(urls.map((u) => loadImage(u)))
      .then(([origImg, cutoutImg]) => {
        if (cancelled) return;
        originalImageRef.current = origImg;
        cutoutImageRef.current = cutoutImg ?? null;
        setLoadError(false);
        renderPreviewRef.current();
      })
      .catch(() => {
        if (cancelled) return;
        originalImageRef.current = null;
        cutoutImageRef.current = null;
        setLoadError(true);
        onPreviewChange?.(null);
      });

    return () => {
      cancelled = true;
    };
  }, [originalUrl, cutoutUrl, onPreviewChange]);

  useEffect(() => {
    if (!originalUrl || !originalImageRef.current?.complete) return;

    // Use a longer debounce when expensive pixel ops are active so rapid
    // slider drags don't queue up many heavy renders.
    let delay = 0;
    if (portrait.enabled) delay = 80; // compositing two canvases
    else if (adjustments.sharpness > 0 || adjustments.noiseReduction > 0) delay = 80;
    else if (effects.look !== "none" || effects.retouch > 0 || effects.vignette > 0) delay = 40;

    const timeout = window.setTimeout(renderPreviewRef.current, delay);
    return () => window.clearTimeout(timeout);
  }, [
    adjustments,
    background,
    portrait,
    effects,
    resize,
    originalUrl,
    cutoutUrl,
    originalWidth,
    originalHeight,
    useBackgroundCutout,
  ]);

  if (hidden) {
    return (
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 -z-50 size-px opacity-0"
      />
    );
  }

  if (!originalUrl) {
    return (
      <div className="bg-muted/40 text-muted-foreground flex min-h-48 items-center justify-center rounded-xl border px-4 text-center text-sm sm:min-h-64 md:min-h-80">
        Upload an image to see the preview
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-destructive/10 text-destructive flex min-h-48 items-center justify-center rounded-xl border px-4 text-center text-sm sm:min-h-64">
        Failed to load image preview
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border bg-black/5">
      <canvas
        ref={canvasRef}
        className="mx-auto block max-h-[45vh] w-full object-contain sm:max-h-[55vh] lg:max-h-[70vh]"
      />
      {isRendering && (
        <div className="bg-background/70 absolute inset-0 flex items-center justify-center text-sm">
          Updating preview...
        </div>
      )}
    </div>
  );
}
