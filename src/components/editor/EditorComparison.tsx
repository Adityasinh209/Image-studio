"use client";

import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import { BeforeAfter } from "@/components/editor/BeforeAfter";
import { CanvasPreview } from "@/components/editor/CanvasPreview";
import type { EditorImage } from "@/lib/editorImages";
import {
  computeOutputDimensions,
  type BackgroundSettings,
  type EffectsSettings,
  type ImageAdjustments,
  type PortraitSettings,
  type PreviewUrls,
  type ResizeSettings,
} from "@/lib/imageOps";
import { revokePreviewUrl } from "@/lib/previewScheduler";

type EditorComparisonProps = {
  activeImage: EditorImage | null;
  adjustments: ImageAdjustments;
  resize: ResizeSettings;
  background: BackgroundSettings;
  portrait: PortraitSettings;
  effects: EffectsSettings;
  useBackgroundCutout: boolean;
  showCheckerboard: boolean;
  fill: boolean;
  hasImages: boolean;
  imageCount: number;
  upscaleFactor: number;
  onUploadClick?: () => void;
  className?: string;
};

export const EditorComparison = memo(function EditorComparison({
  activeImage,
  adjustments,
  resize,
  background,
  portrait,
  effects,
  useBackgroundCutout,
  showCheckerboard,
  fill,
  hasImages,
  imageCount,
  upscaleFactor,
  onUploadClick,
  className,
}: EditorComparisonProps) {
  const [preview, setPreview] = useState<PreviewUrls | null>(null);
  const deferredPreview = useDeferredValue(preview);
  const previewRef = useRef<PreviewUrls | null>(null);

  const outputDimensions = activeImage
    ? computeOutputDimensions(
        activeImage.originalWidth,
        activeImage.originalHeight,
        resize,
      )
    : { width: 0, height: 0 };

  const handlePreviewChange = useCallback((next: PreviewUrls | null) => {
    previewRef.current = next;
    startTransition(() => {
      setPreview(next);
    });
  }, []);

  useEffect(() => {
    return () => {
      const current = previewRef.current;
      if (current) {
        revokePreviewUrl(current.processed);
      }
    };
  }, [activeImage?.id]);

  return (
    <>
      {activeImage && (
        <CanvasPreview
          key={`${activeImage.id}-${activeImage.cutoutUrl ?? "orig"}`}
          hidden
          originalUrl={activeImage.sourceUrl}
          cutoutUrl={activeImage.cutoutUrl}
          originalWidth={activeImage.originalWidth}
          originalHeight={activeImage.originalHeight}
          adjustments={adjustments}
          resize={resize}
          background={background}
          portrait={portrait}
          effects={effects}
          useBackgroundCutout={useBackgroundCutout}
          onPreviewChange={handlePreviewChange}
        />
      )}

      <BeforeAfter
        baselineUrl={deferredPreview?.baseline ?? null}
        processedUrl={deferredPreview?.processed ?? null}
        outputWidth={deferredPreview?.outputWidth ?? outputDimensions.width}
        outputHeight={deferredPreview?.outputHeight ?? outputDimensions.height}
        showCheckerboard={showCheckerboard}
        fill={fill}
        onUploadClick={onUploadClick}
        className={className}
        isStale={preview !== deferredPreview}
      />

      {hasImages && upscaleFactor > 1 && activeImage && (
        <p className="text-muted-foreground shrink-0 text-center text-xs sm:text-sm lg:text-[11px]">
          Preview is capped for performance. Full {upscaleFactor}x resolution is
          applied to all {imageCount} image{imageCount === 1 ? "" : "s"} on
          download.
        </p>
      )}
    </>
  );
});
