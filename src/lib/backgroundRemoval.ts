"use client";

import type { ProgressCallback } from "@huggingface/transformers";

export const BACKGROUND_REMOVAL_MODEL = "onnx-community/ormbg-ONNX";

type ProgressHandler = (message: string) => void;

type BackgroundRemovalPipeline = (
  images: File,
) => Promise<{ toBlob: (type?: string) => Promise<Blob> }>;

let pipelinePromise: Promise<BackgroundRemovalPipeline> | null = null;

async function getPipeline(onProgress?: ProgressHandler) {
  if (!pipelinePromise) {
    onProgress?.("Loading background removal model...");

    const { pipeline } = await import("@huggingface/transformers");

    pipelinePromise = pipeline(
      "background-removal",
      BACKGROUND_REMOVAL_MODEL,
      {
        progress_callback: ((info) => {
          if (info.status === "progress" && "progress" in info) {
            onProgress?.(`Loading model: ${Math.round(info.progress)}%`);
            return;
          }
          if (info.status === "download" && "file" in info) {
            onProgress?.(`Downloading ${info.file}...`);
          }
        }) satisfies ProgressCallback,
      },
    ) as Promise<BackgroundRemovalPipeline>;
  }

  return pipelinePromise;
}

export async function removeBackground(
  file: File,
  onProgress?: ProgressHandler,
): Promise<Blob> {
  const segmenter = await getPipeline(onProgress);
  onProgress?.("Removing background...");
  const result = await segmenter(file);
  const image = Array.isArray(result) ? result[0] : result;
  return image.toBlob("image/png");
}
