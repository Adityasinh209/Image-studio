"use client";

import type { ProgressCallback } from "@huggingface/transformers";

export const BACKGROUND_REMOVAL_MODEL = "onnx-community/ormbg-ONNX";

type ProgressHandler = (message: string, percent?: number) => void;

type BackgroundRemovalPipeline = (
  images: File,
) => Promise<{ toBlob: (type?: string) => Promise<Blob> }>;

export type ModelStatus = "idle" | "loading" | "ready" | "error";

let pipelinePromise: Promise<BackgroundRemovalPipeline> | null = null;
let modelStatus: ModelStatus = "idle";
const statusListeners: Array<(s: ModelStatus) => void> = [];

function notifyStatus(s: ModelStatus) {
  modelStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

export function getModelStatus(): ModelStatus {
  return modelStatus;
}

export function onModelStatusChange(fn: (s: ModelStatus) => void): () => void {
  statusListeners.push(fn);
  return () => {
    const idx = statusListeners.indexOf(fn);
    if (idx !== -1) statusListeners.splice(idx, 1);
  };
}

async function buildPipeline(onProgress?: ProgressHandler): Promise<BackgroundRemovalPipeline> {
  const { pipeline, env } = await import("@huggingface/transformers");

  // Allow local model cache to avoid repeated downloads
  env.allowLocalModels = true;
  env.useBrowserCache = true;

  return pipeline(
    "background-removal",
    BACKGROUND_REMOVAL_MODEL,
    {
      progress_callback: ((info) => {
        if (info.status === "progress" && "progress" in info) {
          const pct = Math.round(info.progress as number);
          onProgress?.(`Loading model… ${pct}%`, pct);
          return;
        }
        if (info.status === "download" && "file" in info) {
          const fname = (info.file as string).split("/").pop() ?? info.file;
          onProgress?.(`Downloading ${fname}…`);
          return;
        }
        if (info.status === "initiate") {
          onProgress?.("Initialising model…");
        }
        if (info.status === "done") {
          onProgress?.("Model ready.", 100);
        }
      }) satisfies ProgressCallback,
    },
  ) as Promise<BackgroundRemovalPipeline>;
}

async function getPipeline(onProgress?: ProgressHandler) {
  if (!pipelinePromise) {
    notifyStatus("loading");
    pipelinePromise = buildPipeline(onProgress)
      .then((p) => {
        notifyStatus("ready");
        return p;
      })
      .catch((err) => {
        notifyStatus("error");
        pipelinePromise = null; // allow retry
        throw err;
      });
  }

  // If already loading, still pipe progress messages through
  return pipelinePromise;
}

/**
 * Call this as soon as images are uploaded so the model downloads in
 * the background while the user explores other controls.
 * Safe to call multiple times — only triggers one download.
 */
export function warmUpModel() {
  if (modelStatus === "loading" || modelStatus === "ready") return;
  if (modelStatus === "error") {
    pipelinePromise = null;
    notifyStatus("idle");
  }
  getPipeline(() => {}).catch(() => {});
}

export async function removeBackground(
  file: File,
  onProgress?: ProgressHandler,
): Promise<Blob> {
  const segmenter = await getPipeline(onProgress);
  onProgress?.("Processing image…");
  const result = await segmenter(file);
  const image = Array.isArray(result) ? result[0] : result;
  return image.toBlob("image/png");
}
