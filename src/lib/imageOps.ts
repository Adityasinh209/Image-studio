export type ExportFormat = "png" | "jpg" | "webp";

export const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export const MAX_PREVIEW_EDGE = 1600;
export const MAX_OUTPUT_EDGE = 8000;
export const UPSCALE_FACTORS = [1, 2, 4] as const;
export type UpscaleFactor = (typeof UPSCALE_FACTORS)[number];

export type ImageAdjustments = {
  brightness: number;
  contrast: number;
  sharpness: number;
  noiseReduction: number;
};

export type ResizeMode = "scale" | "cover" | "fill";

export type ResizeSettings = {
  width: number;
  height: number;
  scalePercent: number;
  maintainAspectRatio: boolean;
  mode: ResizeMode;
  upscaleFactor: UpscaleFactor;
};

export type BackgroundType = "transparent" | "color";

export type BackgroundSettings = {
  type: BackgroundType;
  color: string;
};

export type PortraitSettings = {
  enabled: boolean;
  blurStrength: number;
};

export type PortraitOrientation = "original" | "4:5" | "3:4" | "9:16";

export type LookType = "none" | "bw" | "sepia" | "vintage";

export const LOOKS: { id: LookType; label: string }[] = [
  { id: "none", label: "Original" },
  { id: "bw", label: "B&W" },
  { id: "sepia", label: "Sepia" },
  { id: "vintage", label: "Vintage" },
];

export type EffectsSettings = {
  look: LookType;
  vignette: number;
  retouch: number;
};

export type ImageOps = {
  adjustments: ImageAdjustments;
  resize: ResizeSettings;
  background: BackgroundSettings;
  portrait: PortraitSettings;
  effects: EffectsSettings;
};

export type PreviewUrls = {
  processed: string;
  baseline: string;
  outputWidth: number;
  outputHeight: number;
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
  mode: "scale",
  upscaleFactor: 1,
};

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  type: "transparent",
  color: "#ffffff",
};

export const DEFAULT_PORTRAIT: PortraitSettings = {
  enabled: false,
  blurStrength: 50,
};

export const DEFAULT_EFFECTS: EffectsSettings = {
  look: "none",
  vignette: 0,
  retouch: 0,
};

export const DEFAULT_OPS: ImageOps = {
  adjustments: DEFAULT_ADJUSTMENTS,
  resize: DEFAULT_RESIZE,
  background: DEFAULT_BACKGROUND,
  portrait: DEFAULT_PORTRAIT,
  effects: DEFAULT_EFFECTS,
};

export const AUTO_ENHANCE_VALUES: ImageAdjustments = {
  brightness: 8,
  contrast: 12,
  sharpness: 25,
  noiseReduction: 20,
};

export function isSupportedImage(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext),
  );
  const hasValidMime =
    file.type.length > 0 &&
    SUPPORTED_MIME_TYPES.includes(
      file.type as (typeof SUPPORTED_MIME_TYPES)[number],
    );
  return hasValidExtension || hasValidMime;
}

export function brightnessToFilter(value: number): number {
  return Math.max(0, 1 + value / 100);
}

export function contrastToFilter(value: number): number {
  return Math.max(0, 1 + value / 100);
}

export function hasExplicitResizeTargets(resize: ResizeSettings): boolean {
  return resize.width > 0 || resize.height > 0;
}

function applyUpscaleAndClamp(
  width: number,
  height: number,
  upscaleFactor: number,
): { width: number; height: number } {
  let nextWidth = Math.max(1, Math.round(width * upscaleFactor));
  let nextHeight = Math.max(1, Math.round(height * upscaleFactor));

  const longestEdge = Math.max(nextWidth, nextHeight);
  if (longestEdge > MAX_OUTPUT_EDGE) {
    const scale = MAX_OUTPUT_EDGE / longestEdge;
    nextWidth = Math.max(1, Math.round(nextWidth * scale));
    nextHeight = Math.max(1, Math.round(nextHeight * scale));
  }

  return { width: nextWidth, height: nextHeight };
}

export function computeOutputDimensions(
  originalWidth: number,
  originalHeight: number,
  resize: ResizeSettings,
): { width: number; height: number } {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return { width: 0, height: 0 };
  }

  let width = originalWidth;
  let height = originalHeight;

  if (
    hasExplicitResizeTargets(resize) &&
    (resize.mode === "cover" || resize.mode === "fill") &&
    resize.width > 0 &&
    resize.height > 0
  ) {
    width = resize.width;
    height = resize.height;
  } else if (!hasExplicitResizeTargets(resize)) {
    const scale = resize.scalePercent / 100;
    width = Math.max(1, Math.round(originalWidth * scale));
    height = Math.max(1, Math.round(originalHeight * scale));
  } else if (resize.maintainAspectRatio) {
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

  return applyUpscaleAndClamp(
    Math.max(1, width),
    Math.max(1, height),
    resize.upscaleFactor,
  );
}

export function getPreviewRenderSize(
  width: number,
  height: number,
  maxEdge = MAX_PREVIEW_EDGE,
): { width: number; height: number; scale: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0, scale: 1 };
  }

  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height, scale: 1 };
  }

  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function blurStrengthToPixels(strength: number, minEdge: number): number {
  const normalised = strength / 100;
  return Math.max(1, Math.round(normalised * minEdge * 0.06));
}

export function blurStrengthToSigma(strength: number, minEdge: number): number {
  const normalised = strength / 100;
  const sigma = normalised * minEdge * 0.025;
  return Math.min(1000, Math.max(0.3, sigma));
}

export function ratioToCoverDimensions(
  origW: number,
  origH: number,
  ratioW: number,
  ratioH: number,
): { width: number; height: number } {
  if (origW <= 0 || origH <= 0) return { width: origW, height: origH };
  const srcAspect = origW / origH;
  const targetAspect = ratioW / ratioH;
  if (srcAspect > targetAspect) {
    const height = origH;
    const width = Math.round(height * targetAspect);
    return { width, height };
  }
  const width = origW;
  const height = Math.round(width / targetAspect);
  return { width, height };
}

export function mergeImageOps(partial: Partial<ImageOps>): ImageOps {
  return {
    adjustments: {
      ...DEFAULT_ADJUSTMENTS,
      ...partial.adjustments,
    },
    resize: {
      ...DEFAULT_RESIZE,
      ...partial.resize,
      mode: partial.resize?.mode ?? DEFAULT_RESIZE.mode,
      upscaleFactor:
        partial.resize?.upscaleFactor ?? DEFAULT_RESIZE.upscaleFactor,
    },
    background: {
      ...DEFAULT_BACKGROUND,
      ...partial.background,
      type: partial.background?.type ?? DEFAULT_BACKGROUND.type,
      color: partial.background?.color ?? DEFAULT_BACKGROUND.color,
    },
    portrait: {
      ...DEFAULT_PORTRAIT,
      ...partial.portrait,
    },
    effects: {
      ...DEFAULT_EFFECTS,
      ...partial.effects,
      look: partial.effects?.look ?? DEFAULT_EFFECTS.look,
    },
  };
}
