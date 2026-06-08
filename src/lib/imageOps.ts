export type ExportFormat = "png" | "jpg" | "webp";

export const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export type ImageAdjustments = {
  brightness: number;
  contrast: number;
  sharpness: number;
  noiseReduction: number;
};

export type ResizeSettings = {
  width: number;
  height: number;
  scalePercent: number;
  maintainAspectRatio: boolean;
};

export type ImageOps = {
  adjustments: ImageAdjustments;
  resize: ResizeSettings;
};

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  noiseReduction: 0,
};

export const DEFAULT_RESIZE: ResizeSettings = {
  width: 0,
  height: 0,
  scalePercent: 100,
  maintainAspectRatio: true,
};

export const DEFAULT_OPS: ImageOps = {
  adjustments: DEFAULT_ADJUSTMENTS,
  resize: DEFAULT_RESIZE,
};

export const AUTO_ENHANCE_VALUES: ImageAdjustments = {
  brightness: 8,
  contrast: 12,
  sharpness: 25,
  noiseReduction: 20,
};

export function isSupportedImage(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = SUPPORTED_MIME_TYPES.includes(
    file.type as (typeof SUPPORTED_MIME_TYPES)[number],
  );
  return hasValidExtension || hasValidMime;
}

export function brightnessToFilter(value: number): number {
  return 1 + value / 100;
}

export function contrastToFilter(value: number): number {
  return 1 + value / 100;
}

export function computeOutputDimensions(
  originalWidth: number,
  originalHeight: number,
  resize: ResizeSettings,
): { width: number; height: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const scale = resize.scalePercent / 100;
  let width = Math.round(originalWidth * scale);
  let height = Math.round(originalHeight * scale);

  if (resize.width > 0 || resize.height > 0) {
    if (resize.maintainAspectRatio) {
      const aspect = originalWidth / originalHeight;
      if (resize.width > 0 && resize.height > 0) {
        const targetAspect = resize.width / resize.height;
        if (targetAspect > aspect) {
          height = resize.height;
          width = Math.round(height * aspect);
        } else {
          width = resize.width;
          height = Math.round(width / aspect);
        }
      } else if (resize.width > 0) {
        width = resize.width;
        height = Math.round(width / aspect);
      } else {
        height = resize.height;
        width = Math.round(height * aspect);
      }
    } else {
      width = resize.width > 0 ? resize.width : width;
      height = resize.height > 0 ? resize.height : height;
    }
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}
