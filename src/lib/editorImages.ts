import { isSupportedImage } from "@/lib/imageOps";

export const MAX_BATCH_IMAGES = 15;

export type BgStatus = "none" | "processing" | "done" | "error";

export type EditorImage = {
  id: string;
  file: File;
  sourceUrl: string;
  originalWidth: number;
  originalHeight: number;
  cutoutUrl: string | null;
  cutoutFile: File | null;
  bgStatus: BgStatus;
};

export function createImageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadEditorImage(file: File): Promise<EditorImage> {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        id: createImageId(),
        file,
        sourceUrl,
        originalWidth: image.naturalWidth,
        originalHeight: image.naturalHeight,
        cutoutUrl: null,
        cutoutFile: null,
        bgStatus: "none",
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error(file.name));
    };

    image.src = sourceUrl;
  });
}

export function filterSupportedFiles(files: File[]): File[] {
  return files.filter(isSupportedImage);
}

export function revokeEditorImage(image: EditorImage): void {
  URL.revokeObjectURL(image.sourceUrl);
  if (image.cutoutUrl) URL.revokeObjectURL(image.cutoutUrl);
}

export function revokeEditorImages(images: EditorImage[]): void {
  for (const image of images) {
    revokeEditorImage(image);
  }
}

export function getEffectiveSourceUrl(image: EditorImage): string {
  return image.cutoutUrl ?? image.sourceUrl;
}

export function getExportFile(image: EditorImage): File {
  return image.cutoutFile ?? image.file;
}

export function createCutoutFile(originalFile: File, blob: Blob): File {
  const baseName = originalFile.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-cutout.png`, { type: "image/png" });
}
