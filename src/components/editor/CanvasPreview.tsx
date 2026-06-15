"use client";

import { useCallback, useEffect, useRef } from "react";

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
  MAX_LIVE_PREVIEW_EDGE,
  type BackgroundSettings,
  type EffectsSettings,
  type ImageAdjustments,
  type PortraitSettings,
  type PreviewUrls,
  type ResizeSettings,
} from "@/lib/imageOps";
import {
  createPreviewScheduler,
  encodePreviewCanvas,
  revokePreviewUrl,
} from "@/lib/previewScheduler";

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

function baselineCacheKey(
  originalUrl: string,
  originalWidth: number,
  originalHeight: number,
  resize: ResizeSettings,
): string {
  return [
    originalUrl,
    originalWidth,
    originalHeight,
    resize.width,
    resize.height,
    resize.mode,
    resize.scalePercent,
    resize.maintainAspectRatio,
  ].join("|");
}

function getRenderDelay(
  portrait: PortraitSettings,
  adjustments: ImageAdjustments,
  effects: EffectsSettings,
): number {
  if (portrait.enabled) return 90;
  if (adjustments.sharpness > 0 || adjustments.noiseReduction > 0) return 90;
  if (effects.look !== "none" || effects.retouch > 0) return 55;
  if (effects.vignette > 0) return 35;
  return 20;
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
  const schedulerRef = useRef(createPreviewScheduler());
  const renderGenerationRef = useRef(0);
  const onPreviewChangeRef = useRef(onPreviewChange);
  const previewUrlsRef = useRef<{ baseline: string; processed: string } | null>(
    null,
  );
  const baselineCacheRef = useRef<{
    key: string;
    url: string;
    outputWidth: number;
    outputHeight: number;
  } | null>(null);

  onPreviewChangeRef.current = onPreviewChange;

  const publishPreview = useCallback((preview: PreviewUrls | null) => {
    const prev = previewUrlsRef.current;
    if (preview) {
      if (prev?.processed && prev.processed !== preview.processed) {
        revokePreviewUrl(prev.processed);
      }
      previewUrlsRef.current = {
        baseline: preview.baseline,
        processed: preview.processed,
      };
    } else {
      if (prev) {
        revokePreviewUrl(prev.processed);
      }
      previewUrlsRef.current = null;
    }

    onPreviewChangeRef.current?.(preview);
  }, []);

  const renderPreview = useCallback(async () => {
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

    const previewSize = getPreviewRenderSize(
      output.width,
      output.height,
      MAX_LIVE_PREVIEW_EDGE,
    );
    if (previewSize.width <= 0 || previewSize.height <= 0) return;

    const generation = ++renderGenerationRef.current;

    try {
      canvas.width = previewSize.width;
      canvas.height = previewSize.height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const cutoutImage = cutoutImageRef.current;
      const portraitActive = portrait.enabled && Boolean(cutoutImage?.complete);
      const minEdge = Math.min(previewSize.width, previewSize.height);
      const blurPx = blurStrengthToPixels(portrait.blurStrength, minEdge);
      const needsAlpha =
        (useBackgroundCutout && background.type === "transparent") ||
        (background.type === "transparent" && portraitActive);

      const cacheKey = baselineCacheKey(
        originalUrl ?? "",
        baseWidth,
        baseHeight,
        resize,
      );

      let baseline = baselineCacheRef.current;
      if (!baseline || baseline.key !== cacheKey) {
        if (baseline) revokePreviewUrl(baseline.url);

        ctx.filter = "none";
        ctx.clearRect(0, 0, previewSize.width, previewSize.height);
        drawImageToCanvas(
          ctx,
          originalImage,
          previewSize.width,
          previewSize.height,
          resize.mode,
        );

        const baselineUrl = await encodePreviewCanvas(canvas, false);
        if (generation !== renderGenerationRef.current) {
          revokePreviewUrl(baselineUrl);
          return;
        }

        baseline = {
          key: cacheKey,
          url: baselineUrl,
          outputWidth: output.width,
          outputHeight: output.height,
        };
        baselineCacheRef.current = baseline;
      }

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

      const processedUrl = await encodePreviewCanvas(canvas, needsAlpha);
      if (generation !== renderGenerationRef.current) {
        revokePreviewUrl(processedUrl);
        return;
      }

      publishPreview({
        processed: processedUrl,
        baseline: baseline.url,
        outputWidth: baseline.outputWidth,
        outputHeight: baseline.outputHeight,
      });
    } catch (error) {
      if (generation === renderGenerationRef.current) {
        console.error("Preview render failed:", error);
      }
    }
  }, [
    adjustments,
    background,
    effects,
    originalHeight,
    originalUrl,
    originalWidth,
    portrait,
    publishPreview,
    resize,
    useBackgroundCutout,
  ]);

  const scheduleRender = useCallback(() => {
    const delay = getRenderDelay(portrait, adjustments, effects);
    schedulerRef.current.schedule(() => {
      void renderPreview();
    }, delay);
  }, [adjustments, effects, portrait, renderPreview]);

  useEffect(() => {
    if (!originalUrl) {
      schedulerRef.current.invalidate();
      renderGenerationRef.current++;
      originalImageRef.current = null;
      cutoutImageRef.current = null;

      if (baselineCacheRef.current) {
        revokePreviewUrl(baselineCacheRef.current.url);
        baselineCacheRef.current = null;
      }

      publishPreview(null);
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
        scheduleRender();
      })
      .catch(() => {
        if (cancelled) return;
        originalImageRef.current = null;
        cutoutImageRef.current = null;
        publishPreview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cutoutUrl, originalUrl, publishPreview, scheduleRender]);

  useEffect(() => {
    if (!originalUrl || !originalImageRef.current?.complete) return;
    scheduleRender();
    return () => schedulerRef.current.cancel();
  }, [
    adjustments,
    background,
    cutoutUrl,
    effects,
    originalHeight,
    originalUrl,
    originalWidth,
    portrait,
    resize,
    scheduleRender,
    useBackgroundCutout,
  ]);

  useEffect(() => {
    return () => {
      schedulerRef.current.invalidate();
      renderGenerationRef.current++;

      if (baselineCacheRef.current) {
        revokePreviewUrl(baselineCacheRef.current.url);
        baselineCacheRef.current = null;
      }

      const urls = previewUrlsRef.current;
      if (urls) {
        revokePreviewUrl(urls.processed);
        previewUrlsRef.current = null;
      }
    };
  }, []);

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

  return (
    <div className="relative overflow-hidden rounded-xl border bg-black/5">
      <canvas
        ref={canvasRef}
        className="mx-auto block max-h-[45vh] w-full object-contain sm:max-h-[55vh] lg:max-h-[70vh]"
      />
    </div>
  );
}
