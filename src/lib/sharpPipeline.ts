import sharp from "sharp";

import {
  brightnessToFilter,
  contrastToFilter,
  computeOutputDimensions,
  type ExportFormat,
  type ImageOps,
} from "@/lib/imageOps";

export async function processImageWithSharp(
  buffer: Buffer,
  ops: ImageOps,
  format: ExportFormat,
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  const { width, height } = computeOutputDimensions(
    originalWidth,
    originalHeight,
    ops.resize,
  );

  let pipeline = sharp(buffer).resize(width, height, {
    fit: "fill",
    withoutEnlargement: false,
  });

  const brightness = brightnessToFilter(ops.adjustments.brightness);
  const contrast = contrastToFilter(ops.adjustments.contrast);

  pipeline = pipeline.modulate({
    brightness,
  });

  if (ops.adjustments.contrast !== 0) {
    pipeline = pipeline.linear(contrast, -(128 * contrast) + 128);
  }

  if (ops.adjustments.sharpness > 0) {
    const sigma = 0.5 + (ops.adjustments.sharpness / 100) * 2;
    pipeline = pipeline.sharpen({ sigma });
  }

  if (ops.adjustments.noiseReduction > 0) {
    const size = ops.adjustments.noiseReduction > 60 ? 5 : 3;
    pipeline = pipeline.median(size);
  }

  switch (format) {
    case "jpg":
      return pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    case "webp":
      return pipeline.webp({ quality: 92 }).toBuffer();
    case "png":
    default:
      return pipeline.png({ compressionLevel: 6 }).toBuffer();
  }
}
