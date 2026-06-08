import sharp from "sharp";

import {
  blurStrengthToSigma,
  brightnessToFilter,
  computeOutputDimensions,
  contrastToFilter,
  type EffectsSettings,
  type ExportFormat,
  type ImageOps,
} from "@/lib/imageOps";

const PORTRAIT_SUBJECT_SHARPNESS = 22;

type RawImage = {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
};

async function toRaw(pipeline: ReturnType<typeof sharp>): Promise<RawImage> {
  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

function fromRaw(raw: RawImage): ReturnType<typeof sharp> {
  return sharp(raw.data, {
    raw: {
      width: raw.width,
      height: raw.height,
      channels: raw.channels as 1 | 2 | 3 | 4,
    },
  });
}

export async function processImageWithSharp(
  buffer: Buffer,
  ops: ImageOps,
  format: ExportFormat,
  cutoutBuffer: Buffer | null = null,
  maxSizeKb: number | null = null,
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  const { width, height } = computeOutputDimensions(
    originalWidth,
    originalHeight,
    ops.resize,
  );

  const fit =
    ops.resize.mode === "cover"
      ? "cover"
      : ops.resize.maintainAspectRatio
        ? "inside"
        : "fill";

  const brightness = brightnessToFilter(ops.adjustments.brightness);
  const contrast = contrastToFilter(ops.adjustments.contrast);

  const sharpenAmount =
    ops.adjustments.sharpness > 0
      ? ops.adjustments.sharpness
      : ops.resize.upscaleFactor > 1
        ? 15
        : 0;

  const flattenColor =
    ops.background.type === "color"
      ? ops.background.color
      : format === "jpg"
        ? "#ffffff"
        : null;

  let raw: RawImage;
  if (ops.portrait.enabled && cutoutBuffer) {
    raw = await buildPortraitRaw(
      buffer,
      cutoutBuffer,
      ops,
      width,
      height,
      fit,
      brightness,
      contrast,
      sharpenAmount,
      format === "jpg" ? "#ffffff" : null,
    );
  } else {
    raw = await buildStandardRaw(
      buffer,
      ops,
      width,
      height,
      fit,
      brightness,
      contrast,
      sharpenAmount,
      flattenColor,
    );
  }

  raw = await applyExportEffects(raw, ops.effects);

  return encodeFinal(raw, format, maxSizeKb);
}

async function buildStandardRaw(
  buffer: Buffer,
  ops: ImageOps,
  width: number,
  height: number,
  fit: "cover" | "inside" | "fill",
  brightness: number,
  contrast: number,
  sharpenAmount: number,
  flattenColor: string | null,
): Promise<RawImage> {
  let pipeline = sharp(buffer);

  if (ops.adjustments.noiseReduction > 0) {
    const size = ops.adjustments.noiseReduction > 60 ? 5 : 3;
    pipeline = pipeline.median(size);
  }

  pipeline = pipeline.resize(width, height, {
    fit,
    position: "centre",
    kernel: sharp.kernel.lanczos3,
    withoutEnlargement: false,
  });

  pipeline = pipeline.modulate({ brightness });

  if (ops.adjustments.contrast !== 0) {
    pipeline = pipeline.linear(contrast, -(128 * contrast) + 128);
  }

  if (sharpenAmount > 0) {
    const sigma = 0.5 + (sharpenAmount / 100) * 2;
    pipeline = pipeline.sharpen({ sigma });
  }

  if (flattenColor) {
    pipeline = pipeline.flatten({ background: flattenColor });
  }

  return toRaw(pipeline);
}

async function buildPortraitRaw(
  buffer: Buffer,
  cutoutBuffer: Buffer,
  ops: ImageOps,
  width: number,
  height: number,
  fit: "cover" | "inside" | "fill",
  brightness: number,
  contrast: number,
  sharpenAmount: number,
  flattenColor: string | null,
): Promise<RawImage> {
  const minEdge = Math.min(width, height);
  const sigma = blurStrengthToSigma(ops.portrait.blurStrength, minEdge);
  const subjectSharpen = Math.max(sharpenAmount, PORTRAIT_SUBJECT_SHARPNESS);

  const resizeOpts = {
    fit,
    position: "centre" as const,
    kernel: sharp.kernel.lanczos3,
    withoutEnlargement: false,
  };

  let originalPipeline = sharp(buffer);

  if (ops.adjustments.noiseReduction > 0) {
    const size = ops.adjustments.noiseReduction > 60 ? 5 : 3;
    originalPipeline = originalPipeline.median(size);
  }

  originalPipeline = originalPipeline
    .resize(width, height, resizeOpts)
    .modulate({ brightness });

  if (ops.adjustments.contrast !== 0) {
    originalPipeline = originalPipeline.linear(contrast, -(128 * contrast) + 128);
  }

  const originalBuf = await originalPipeline.toBuffer();

  const cutoutResized = await sharp(cutoutBuffer)
    .resize(width, height, resizeOpts)
    .ensureAlpha()
    .toBuffer();

  const blurredBg = await sharp(originalBuf).blur(sigma).toBuffer();

  let sharpSubject = sharp(originalBuf)
    .ensureAlpha()
    .composite([{ input: cutoutResized, blend: "dest-in" }]);

  if (subjectSharpen > 0) {
    const sharpenSigma = 0.5 + (subjectSharpen / 100) * 2;
    sharpSubject = sharpSubject.sharpen({ sigma: sharpenSigma });
  }

  const subjectBuf = await sharpSubject.png().toBuffer();

  let composed = sharp(blurredBg).composite([
    { input: subjectBuf, blend: "over" },
  ]);

  if (flattenColor) {
    composed = composed.flatten({ background: flattenColor });
  }

  return toRaw(composed);
}

function vignetteSvg(width: number, height: number, amount: number): string {
  const strength = Math.min(100, Math.max(0, amount)) / 100;
  const edge = Math.round((1 - strength * 0.7) * 255);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset="35%" stop-color="rgb(255,255,255)"/><stop offset="100%" stop-color="rgb(${edge},${edge},${edge})"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;
}

async function applyExportEffects(
  raw: RawImage,
  effects: EffectsSettings,
): Promise<RawImage> {
  const hasLook = effects.look !== "none";
  const hasRetouch = effects.retouch > 0;
  const hasVignette = effects.vignette > 0;

  if (!hasLook && !hasRetouch && !hasVignette) {
    return raw;
  }

  let pipeline = fromRaw(raw);

  if (effects.look === "bw") {
    pipeline = pipeline.grayscale().toColourspace("srgb");
  } else if (effects.look === "sepia") {
    pipeline = pipeline.tint({ r: 160, g: 112, b: 60 });
  } else if (effects.look === "vintage") {
    pipeline = pipeline.modulate({ saturation: 0.6, brightness: 1.02, hue: 8 });
    pipeline = pipeline.linear(0.92, 10);
  }

  if (hasRetouch) {
    const strength = effects.retouch / 100;
    pipeline = pipeline.modulate({ brightness: 1 + strength * 0.05 });
    pipeline = pipeline.linear(1 + strength * 0.08, -(strength * 6));
  }

  if (hasVignette) {
    const current = await toRaw(pipeline);
    const svg = vignetteSvg(current.width, current.height, effects.vignette);
    pipeline = fromRaw(current).composite([
      { input: Buffer.from(svg), blend: "multiply" },
    ]);
  }

  return toRaw(pipeline);
}

function encodeFormat(
  pipeline: ReturnType<typeof sharp>,
  format: ExportFormat,
  quality: number,
): Promise<Buffer> {
  switch (format) {
    case "jpg":
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    case "webp":
      return pipeline.webp({ quality }).toBuffer();
    case "png":
    default:
      return pipeline.png({ compressionLevel: 6 }).toBuffer();
  }
}

async function encodeFinal(
  raw: RawImage,
  format: ExportFormat,
  maxSizeKb: number | null,
): Promise<Buffer> {
  if (format === "png") {
    let output = await fromRaw(raw).png({ compressionLevel: 9 }).toBuffer();
    if (maxSizeKb && output.length > maxSizeKb * 1024) {
      const quantized = await fromRaw(raw)
        .png({ compressionLevel: 9, palette: true, quality: 80 })
        .toBuffer();
      if (quantized.length < output.length) {
        output = quantized;
      }
    }
    return output;
  }

  let quality = 92;
  let output = await encodeFormat(fromRaw(raw), format, quality);

  if (maxSizeKb) {
    const target = maxSizeKb * 1024;
    while (output.length > target && quality > 30) {
      quality -= 8;
      output = await encodeFormat(fromRaw(raw), format, quality);
    }
  }

  return output;
}
