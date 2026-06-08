"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type ExportFormat, type ImageOps } from "@/lib/imageOps";

export type ExportItem = {
  file: File;
  originalFile: File;
  cutoutFile: File | null;
};

type ExportBarProps = {
  items: ExportItem[];
  ops: ImageOps;
  disabled?: boolean;
  compact?: boolean;
};

function createUniqueStamp(): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${datePart}-${timePart}-${randomPart}`;
}

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "No limit" },
  { value: "200", label: "Under 200 KB" },
  { value: "500", label: "Under 500 KB" },
  { value: "1024", label: "Under 1 MB" },
  { value: "2048", label: "Under 2 MB" },
];

async function processImage(
  item: ExportItem,
  ops: ImageOps,
  format: ExportFormat,
  maxSizeKb: number,
): Promise<Blob> {
  const formData = new FormData();
  formData.append("image", item.originalFile);
  formData.append("ops", JSON.stringify(ops));
  formData.append("format", format);
  if (maxSizeKb > 0) {
    formData.append("maxSizeKb", String(maxSizeKb));
  }
  if (ops.portrait.enabled && item.cutoutFile) {
    formData.append("cutout", item.cutoutFile);
  }

  const response = await fetch("/api/process", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? `Failed to process ${item.originalFile.name}.`);
  }

  return response.blob();
}

export function ExportBar({
  items,
  ops,
  disabled,
  compact = false,
}: ExportBarProps) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [maxSize, setMaxSize] = useState("0");
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState("");

  const maxSizeKb = Number.parseInt(maxSize, 10) || 0;

  const handleDownload = async () => {
    if (items.length === 0) {
      toast.error("Upload images before downloading.");
      return;
    }

    setIsExporting(true);
    setProgress("");

    try {
      if (items.length === 1) {
        setProgress("Processing...");
        const item = items[0];
        const blob = await processImage(item, ops, format, maxSizeKb);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Image-studio-${createUniqueStamp()}.${format}`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success("Image downloaded successfully.");
        return;
      }

      const zip = new JSZip();
      const failures: string[] = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        setProgress(`Processing ${index + 1}/${items.length}...`);

        try {
          const blob = await processImage(item, ops, format, maxSizeKb);
          const baseName = item.originalFile.name.replace(/\.[^.]+$/, "");
          zip.file(`${baseName}-optimized.${format}`, blob);
        } catch (error) {
          failures.push(
            error instanceof Error ? error.message : item.originalFile.name,
          );
        }
      }

      const processedCount = items.length - failures.length;
      if (processedCount === 0) {
        throw new Error("All images failed to process.");
      }

      setProgress("Creating ZIP...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Image-studio-batch-${processedCount}-${createUniqueStamp()}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);

      if (failures.length > 0) {
        toast.warning(
          `Downloaded ${processedCount} image(s). ${failures.length} failed.`,
        );
      } else {
        toast.success(`Downloaded ${processedCount} images as ZIP.`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Download failed.",
      );
    } finally {
      setIsExporting(false);
      setProgress("");
    }
  };

  const buttonLabel =
    items.length > 1 ? `Download all (${items.length})` : "Download";
  const formatLabel = format.toUpperCase();

  return (
    <div
      className={cn(
        "flex gap-3",
        compact
          ? "flex-row items-center"
          : "flex-col sm:flex-row sm:items-end",
      )}
    >
      <div
        className={cn(
          "space-y-2",
          compact ? "min-w-0 flex-1" : "w-full sm:w-auto",
        )}
      >
        {!compact && <Label>Export format</Label>}
        <Select
          value={format}
          onValueChange={(value) => setFormat(value as ExportFormat)}
          disabled={disabled || isExporting}
        >
          <SelectTrigger
            className={cn(
              "rounded-xl",
              compact ? "w-full" : "w-full sm:w-40",
            )}
          >
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">PNG</SelectItem>
            <SelectItem value="jpg">JPG</SelectItem>
            <SelectItem value="webp">WEBP</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Selected format: <span className="text-foreground font-semibold">{formatLabel}</span>
        </p>
      </div>
      {!compact && (
        <div className="w-full space-y-2 sm:w-auto">
          <Label>Max file size</Label>
          <Select
            value={maxSize}
            onValueChange={setMaxSize}
            disabled={disabled || isExporting}
          >
            <SelectTrigger className="w-full rounded-xl sm:w-44">
              <SelectValue placeholder="No limit" />
            </SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            JPG/WEBP compress toward the target. PNG may not reach small sizes.
          </p>
        </div>
      )}
      <Button
        type="button"
        className={cn(
          "hover-lift rounded-xl",
          compact ? "shrink-0" : "w-full sm:ml-auto sm:w-auto",
        )}
        onClick={handleDownload}
        disabled={disabled || isExporting || items.length === 0}
      >
        {isExporting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span className={compact ? "sr-only sm:not-sr-only" : ""}>
              {progress || "Processing..."}
            </span>
          </>
        ) : (
          <>
            <Download className="size-4" />
            <span className={compact ? "" : ""}>
              {buttonLabel} ({formatLabel})
            </span>
          </>
        )}
      </Button>
    </div>
  );
}
