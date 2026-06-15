import {
  brightnessToFilter,
  contrastToFilter,
  type BackgroundSettings,
  type ImageAdjustments,
  type LookType,
  type ResizeMode,
} from "@/lib/imageOps";

const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

export function fillBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundSettings,
): void {
  ctx.clearRect(0, 0, width, height);

  if (background.type === "color") {
    ctx.fillStyle = background.color;
    ctx.fillRect(0, 0, width, height);
  }
}

export function drawImageToCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  destWidth: number,
  destHeight: number,
  mode: ResizeMode,
): void {
  const srcWidth = image.naturalWidth;
  const srcHeight = image.naturalHeight;

  if (srcWidth <= 0 || srcHeight <= 0 || destWidth <= 0 || destHeight <= 0) {
    return;
  }

  if (mode === "cover") {
    const srcAspect = srcWidth / srcHeight;
    const destAspect = destWidth / destHeight;

    let sx = 0;
    let sy = 0;
    let sw = srcWidth;
    let sh = srcHeight;

    if (srcAspect > destAspect) {
      sw = srcHeight * destAspect;
      sx = (srcWidth - sw) / 2;
    } else {
      sh = srcWidth / destAspect;
      sy = (srcHeight - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, destWidth, destHeight);
    return;
  }

  ctx.drawImage(image, 0, 0, destWidth, destHeight);
}

export function buildCanvasFilterString(
  adjustments: ImageAdjustments,
  blurPx = 0,
): string {
  const parts: string[] = [];
  if (blurPx > 0) {
    parts.push(`blur(${blurPx}px)`);
  }
  parts.push(`brightness(${brightnessToFilter(adjustments.brightness)})`);
  parts.push(`contrast(${contrastToFilter(adjustments.contrast)})`);
  return parts.join(" ");
}

export function applyCanvasFilters(
  ctx: CanvasRenderingContext2D,
  adjustments: ImageAdjustments,
  blurPx = 0,
): void {
  ctx.filter = buildCanvasFilterString(adjustments, blurPx);
}

export const PORTRAIT_SUBJECT_SHARPNESS = 22;

let portraitBgCanvas: HTMLCanvasElement | null = null;
let portraitFgCanvas: HTMLCanvasElement | null = null;

function getPortraitLayerCanvas(
  which: "bg" | "fg",
  width: number,
  height: number,
  readPixels: boolean,
): CanvasRenderingContext2D | null {
  const pool = which === "bg" ? portraitBgCanvas : portraitFgCanvas;
  const canvas = pool ?? document.createElement("canvas");
  if (which === "bg") portraitBgCanvas = canvas;
  else portraitFgCanvas = canvas;

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  return canvas.getContext("2d", {
    willReadFrequently: readPixels,
  });
}

export function compositePortraitBokeh(
  ctx: CanvasRenderingContext2D,
  originalImage: HTMLImageElement,
  cutoutImage: HTMLImageElement,
  width: number,
  height: number,
  mode: ResizeMode,
  adjustments: ImageAdjustments,
  blurPx: number,
  subjectSharpness = PORTRAIT_SUBJECT_SHARPNESS,
): void {
  const bgCtx = getPortraitLayerCanvas("bg", width, height, false);
  if (!bgCtx) return;

  bgCtx.setTransform(1, 0, 0, 1, 0, 0);
  bgCtx.globalCompositeOperation = "source-over";
  bgCtx.clearRect(0, 0, width, height);
  bgCtx.filter = buildCanvasFilterString(adjustments, blurPx);
  drawImageToCanvas(bgCtx, originalImage, width, height, mode);
  ctx.drawImage(bgCtx.canvas, 0, 0);

  const fgCtx = getPortraitLayerCanvas("fg", width, height, true);
  if (!fgCtx) return;

  fgCtx.setTransform(1, 0, 0, 1, 0, 0);
  fgCtx.globalCompositeOperation = "source-over";
  fgCtx.clearRect(0, 0, width, height);
  fgCtx.filter = buildCanvasFilterString(adjustments);
  drawImageToCanvas(fgCtx, originalImage, width, height, mode);
  fgCtx.globalCompositeOperation = "destination-in";
  fgCtx.filter = "none";
  drawImageToCanvas(fgCtx, cutoutImage, width, height, mode);

  const effectiveSharpness = Math.max(
    adjustments.sharpness,
    subjectSharpness,
  );
  if (effectiveSharpness > 0) {
    const imageData = fgCtx.getImageData(0, 0, width, height);
    fgCtx.putImageData(applySharpen(imageData, effectiveSharpness), 0, 0);
  }

  ctx.drawImage(fgCtx.canvas, 0, 0);
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

export function applyLook(imageData: ImageData, look: LookType): ImageData {
  if (look === "none") return imageData;

  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);

  for (let i = 0; i < output.length; i += 4) {
    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];
    const luma = LUMA_R * r + LUMA_G * g + LUMA_B * b;

    if (look === "bw") {
      output[i] = luma;
      output[i + 1] = luma;
      output[i + 2] = luma;
    } else if (look === "sepia") {
      output[i] = 0.393 * r + 0.769 * g + 0.189 * b;
      output[i + 1] = 0.349 * r + 0.686 * g + 0.168 * b;
      output[i + 2] = 0.272 * r + 0.534 * g + 0.131 * b;
    } else if (look === "vintage") {
      let vr = r * 0.6 + luma * 0.4;
      let vg = g * 0.6 + luma * 0.4;
      let vb = b * 0.6 + luma * 0.4;
      vr *= 1.06;
      vb *= 0.92;
      output[i] = vr * 0.92 + 12;
      output[i + 1] = vg * 0.92 + 12;
      output[i + 2] = vb * 0.92 + 12;
    }
  }

  return new ImageData(output, width, height);
}

export function applyRetouch(imageData: ImageData, amount: number): ImageData {
  if (amount <= 0) return imageData;

  const { data, width, height } = imageData;
  const output = new Uint8ClampedArray(data);
  const strength = amount / 100;
  const glow = strength * 6;

  for (let i = 0; i < output.length; i += 4) {
    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];
    const luma = LUMA_R * r + LUMA_G * g + LUMA_B * b;
    const highlight = Math.max(0, Math.min(1, (luma - 140) / 115));
    const lift = highlight * strength * 38 + glow;
    output[i] = r + lift;
    output[i + 1] = g + lift;
    output[i + 2] = b + lift;
  }

  return new ImageData(output, width, height);
}

export function applyVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0) return;

  const strength = Math.min(100, Math.max(0, amount)) / 100;
  const edge = Math.round((1 - strength * 0.7) * 255);
  const cx = width / 2;
  const cy = height / 2;
  const inner = Math.min(width, height) * 0.35;
  const outer = Math.max(width, height) * 0.72;

  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, `rgba(${edge},${edge},${edge},1)`);

  ctx.save();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
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
