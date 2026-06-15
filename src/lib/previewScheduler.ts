/** Coalesces rapid preview updates into one rAF-aligned render per burst. */
export function createPreviewScheduler() {
  let frameId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  const cancel = () => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const schedule = (fn: () => void, delayMs: number) => {
    cancel();
    const gen = ++generation;

    const run = () => {
      frameId = null;
      timeoutId = null;
      if (gen !== generation) return;
      fn();
    };

    if (delayMs <= 0) {
      frameId = requestAnimationFrame(run);
    } else {
      timeoutId = setTimeout(() => {
        frameId = requestAnimationFrame(run);
      }, delayMs);
    }
  };

  const invalidate = () => {
    generation++;
    cancel();
  };

  return { schedule, cancel, invalidate };
}

export function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export async function encodePreviewCanvas(
  canvas: HTMLCanvasElement,
  needsAlpha: boolean,
): Promise<string> {
  const type = needsAlpha ? "image/webp" : "image/jpeg";
  const quality = needsAlpha ? 0.85 : 0.8;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

  if (!blob) {
    throw new Error("Failed to encode preview canvas");
  }

  return URL.createObjectURL(blob);
}
