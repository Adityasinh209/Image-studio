import { NextResponse } from "next/server";

import {
  DEFAULT_OPS,
  isSupportedImage,
  mergeImageOps,
  type ExportFormat,
  type ImageOps,
} from "@/lib/imageOps";
import { processImageWithSharp } from "@/lib/sharpPipeline";

export const runtime = "nodejs";

const MIME_TYPES: Record<ExportFormat, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const cutout = formData.get("cutout");
    const opsRaw = formData.get("ops");
    const formatRaw = formData.get("format");
    const maxSizeRaw = formData.get("maxSizeKb");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    if (!isSupportedImage(image)) {
      return NextResponse.json(
        { error: "Unsupported image format." },
        { status: 400 },
      );
    }

    const format = (formatRaw as ExportFormat) || "png";
    if (!["png", "jpg", "webp"].includes(format)) {
      return NextResponse.json({ error: "Invalid export format." }, { status: 400 });
    }

    let ops: ImageOps = DEFAULT_OPS;
    if (typeof opsRaw === "string") {
      try {
        const parsed = JSON.parse(opsRaw) as Partial<ImageOps>;
        ops = mergeImageOps(parsed);
      } catch {
        return NextResponse.json({ error: "Invalid operations payload." }, { status: 400 });
      }
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let cutoutBuffer: Buffer | null = null;
    if (cutout instanceof File) {
      const cutoutAb = await cutout.arrayBuffer();
      cutoutBuffer = Buffer.from(cutoutAb);
    }

    let maxSizeKb: number | null = null;
    if (typeof maxSizeRaw === "string" && maxSizeRaw.length > 0) {
      const parsed = Number.parseInt(maxSizeRaw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        maxSizeKb = parsed;
      }
    }

    const output = await processImageWithSharp(
      buffer,
      ops,
      format,
      cutoutBuffer,
      maxSizeKb,
    );

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": MIME_TYPES[format],
        "Content-Disposition": `attachment; filename="optimized.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Image processing failed:", error);
    return NextResponse.json(
      { error: "Failed to process image." },
      { status: 500 },
    );
  }
}
