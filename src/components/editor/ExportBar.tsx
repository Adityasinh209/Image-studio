"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
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
import {
  type ExportFormat,
  type ImageOps,
} from "@/lib/imageOps";

type ExportBarProps = {
  file: File | null;
  ops: ImageOps;
  disabled?: boolean;
};

export function ExportBar({ file, ops, disabled }: ExportBarProps) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (!file) {
      toast.error("Upload an image before downloading.");
      return;
    }

    setIsExporting(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("ops", JSON.stringify(ops));
      formData.append("format", format);

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? "Failed to process image.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const baseName = file.name.replace(/\.[^.]+$/, "");
      anchor.href = url;
      anchor.download = `${baseName}-optimized.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Image downloaded successfully.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Download failed.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <Label>Export format</Label>
        <Select
          value={format}
          onValueChange={(value) => setFormat(value as ExportFormat)}
          disabled={disabled || isExporting}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="png">PNG</SelectItem>
            <SelectItem value="jpg">JPG</SelectItem>
            <SelectItem value="webp">WEBP</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        className="sm:ml-auto"
        onClick={handleDownload}
        disabled={disabled || isExporting || !file}
      >
        {isExporting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Download className="size-4" />
            Download
          </>
        )}
      </Button>
    </div>
  );
}
