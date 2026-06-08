import {
  brightnessToFilter,
  contrastToFilter,
  type ImageAdjustments,
} from "@/lib/imageOps";

export function applyCanvasFilters(
  ctx: CanvasRenderingContext2D,
  adjustments: ImageAdjustments,
): void {
  const brightness = brightnessToFilter(adjustments.brightness);
  const contrast = contrastToFilter(adjustments.contrast);
  ctx.filter = `brightness(${brightness}) contrast(${contrast})`;
}

export function applySharpen(
  imageData: ImageData,
  amount: number,
): ImageData {
  if (amount <= 0) return imageData;

  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  const strength = amount / 100;
  const kernel = [
    0, -strength, 0,
    -strength, 1 + 4 * strength, -strength,
    0, -strength, 0,
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[ki];
            ki++;
          }
        }
        const outIdx = (y * width + x) * 4 + c;
        output[outIdx] = Math.min(255, Math.max(0, sum));
      }
    }
  }

  return new ImageData(output, width, height);
}

export function applyDenoise(
  imageData: ImageData,
  amount: number,
): ImageData {
  if (amount <= 0) return imageData;

  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  const radius = amount > 60 ? 2 : 1;

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx];
            count++;
          }
        }
        const outIdx = (y * width + x) * 4 + c;
        const original = data[outIdx];
        const blurred = sum / count;
        const blend = amount / 100;
        output[outIdx] = Math.round(original * (1 - blend) + blurred * blend);
      }
    }
  }

  return new ImageData(output, width, height);
}
