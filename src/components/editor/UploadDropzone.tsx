"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isSupportedImage } from "@/lib/imageOps";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
};

export function UploadDropzone({ onFileSelect, disabled }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;

      if (!isSupportedImage(file)) {
        toast.error("Invalid format. Please upload JPG, JPEG, PNG, or WEBP.");
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      handleFile(event.dataTransfer.files[0]);
    },
    [disabled, handleFile],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex min-h-48 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-full">
        <ImagePlus className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">Drag and drop your image here</p>
        <p className="text-muted-foreground text-sm">
          Supports JPG, JPEG, PNG, and WEBP
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Upload className="size-4" />
        Choose file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
