import { getPreviewRenderSize, isSupportedImage } from "@/lib/imageOps";

export const MAX_BATCH_IMAGES = 15;

/** Max edge for strip thumbnails — keeps decode cost tiny vs full-resolution blobs. */
const THUMB_MAX_EDGE = 128;

export type BgStatus = "none" | "processing" | "done" | "error";

export type EditorImage = {
  id: string;
  file: File;
  sourceUrl: string;
  /** Small preview for the image strip — never use sourceUrl there. */
  thumbnailUrl: string;
  originalWidth: number;
  originalHeight: number;
  cutoutUrl: string | null;
  cutoutThumbnailUrl: string | null;
  cutoutFile: File | null;
  bgStatus: BgStatus;
  /** True when the user explicitly removed the background (not portrait-only cutout). */
  bgRemovedByUser: boolean;
};

export function createImageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

async function createThumbnailFromImage(
  image: HTMLImageElement,
): Promise<string> {
  const { width, height } = getPreviewRenderSize(
    image.naturalWidth,
    image.naturalHeight,
    THUMB_MAX_EDGE,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create thumbnail canvas");
  }

  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.72);
  });

  if (!blob) {
    throw new Error("Failed to encode thumbnail");
  }

  return URL.createObjectURL(blob);
}

export async function createThumbnailFromBlob(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadHtmlImage(url);
    return await createThumbnailFromImage(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadEditorImage(file: File): Promise<EditorImage> {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadHtmlImage(sourceUrl);
    const thumbnailUrl = await createThumbnailFromImage(image);

    return {
      id: createImageId(),
      file,
      sourceUrl,
      thumbnailUrl,
      originalWidth: image.naturalWidth,
      originalHeight: image.naturalHeight,
      cutoutUrl: null,
      cutoutThumbnailUrl: null,
      cutoutFile: null,
      bgStatus: "none",
      bgRemovedByUser: false,
    };
  } catch (error) {
    URL.revokeObjectURL(sourceUrl);
    throw error instanceof Error ? error : new Error(file.name);
  }
}

export function filterSupportedFiles(files: File[]): File[] {
  return files.filter(isSupportedImage);
}

export function revokeEditorImage(image: EditorImage): void {
  URL.revokeObjectURL(image.sourceUrl);
  URL.revokeObjectURL(image.thumbnailUrl);
  if (image.cutoutUrl) URL.revokeObjectURL(image.cutoutUrl);
  if (image.cutoutThumbnailUrl) URL.revokeObjectURL(image.cutoutThumbnailUrl);
}

export function revokeEditorImages(images: EditorImage[]): void {
  for (const image of images) {
    revokeEditorImage(image);
  }
}

export function getEffectiveSourceUrl(image: EditorImage): string {
  return image.cutoutUrl ?? image.sourceUrl;
}

export function getStripThumbnailUrl(image: EditorImage): string {
  if (image.bgRemovedByUser && image.cutoutThumbnailUrl) {
    return image.cutoutThumbnailUrl;
  }
  return image.thumbnailUrl;
}

export function getExportFile(image: EditorImage): File {
  return image.cutoutFile ?? image.file;
}

export function createCutoutFile(originalFile: File, blob: Blob): File {
  const baseName = originalFile.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-cutout.png`, { type: "image/png" });
}
