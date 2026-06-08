"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MAX_BATCH_IMAGES } from "@/lib/editorImages";
import { isSupportedImage } from "@/lib/imageOps";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = {
  onFilesSelect: (files: File[]) => void;
  currentCount?: number;
  disabled?: boolean;
};

export function UploadDropzone({
  onFilesSelect,
  currentCount = 0,
  disabled,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const remainingSlots = MAX_BATCH_IMAGES - currentCount;
  const isFull = remainingSlots <= 0;

  const handleFiles = useCallback(
    (fileList: FileList | File[] | undefined) => {
      if (!fileList || fileList.length === 0) return;

      const incoming = Array.from(fileList);
      const supported = incoming.filter(isSupportedImage);
      const invalidCount = incoming.length - supported.length;

      if (supported.length === 0) {
        toast.error("Invalid format. Please upload JPG, JPEG, PNG, or WEBP.");
        return;
      }

      if (invalidCount > 0) {
        toast.error(`${invalidCount} file(s) skipped — unsupported format.`);
      }

      const accepted = supported.slice(0, remainingSlots);
      if (accepted.length === 0) {
        toast.error(`Maximum ${MAX_BATCH_IMAGES} images allowed.`);
        return;
      }

      if (supported.length > remainingSlots) {
        toast.warning(
          `Only ${remainingSlots} more image(s) added (max ${MAX_BATCH_IMAGES}).`,
        );
      }

      onFilesSelect(accepted);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [onFilesSelect, remainingSlots],
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled || isFull) return;
      handleFiles(event.dataTransfer.files);
    },
    [disabled, handleFiles, isFull],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled && !isFull) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200 sm:min-h-44 sm:gap-4 sm:p-6 md:min-h-48 md:p-8",
        isDragging
          ? "border-primary/60 bg-primary/5 shadow-[0_0_32px_oklch(0.48_0.2_265/0.15)]"
          : "border-border/70 bg-muted/20 hover:border-primary/30 hover:bg-muted/30",
        (disabled || isFull) && "pointer-events-none opacity-50",
      )}
    >
      <div className="gradient-chip flex size-14 items-center justify-center rounded-2xl shadow-lg sm:size-16">
        <ImagePlus className="size-7 sm:size-8" />
      </div>
      <div className="space-y-1 px-2">
        <p className="text-sm font-medium sm:text-base">
          <span className="sm:hidden">Tap to upload images</span>
          <span className="hidden sm:inline">
            Drag and drop images here (up to {MAX_BATCH_IMAGES})
          </span>
        </p>
        <p className="text-muted-foreground text-xs sm:text-sm">
          JPG, JPEG, PNG, WEBP
          {currentCount > 0 && ` · ${currentCount}/${MAX_BATCH_IMAGES} added`}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full max-w-xs hover-lift sm:w-auto"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isFull}
      >
        <Upload className="size-4" />
        {currentCount > 0 ? "Add more images" : "Choose images"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files ?? undefined)}
      />
    </div>
  );
}
