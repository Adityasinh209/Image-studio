"use client";

import { memo } from "react";
import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getStripThumbnailUrl,
  MAX_BATCH_IMAGES,
  type EditorImage,
} from "@/lib/editorImages";
import { cn } from "@/lib/utils";

type ImageStripProps = {
  images: EditorImage[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

type ImageStripItemProps = {
  image: EditorImage;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

const ImageStripItem = memo(function ImageStripItem({
  image,
  index,
  isActive,
  onSelect,
  onRemove,
}: ImageStripItemProps) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => onSelect(image.id)}
        className={cn(
          "relative size-[4.25rem] overflow-hidden rounded-xl border-2 transition-all duration-200 active:scale-[0.98] sm:size-20",
          image.bgRemovedByUser && image.cutoutThumbnailUrl && "checkerboard",
          isActive
            ? "border-primary shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.25)]"
            : "border-border/60 hover:border-primary/40 hover:shadow-sm",
        )}
        aria-label={`Select image ${index + 1}: ${image.file.name}`}
        aria-pressed={isActive}
      >
        <img
          src={getStripThumbnailUrl(image)}
          alt=""
          className="size-full object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
        {image.bgStatus === "processing" && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Loader2 className="size-4 animate-spin text-white" />
          </span>
        )}
        {image.bgRemovedByUser && image.bgStatus === "done" && (
          <span className="gradient-chip absolute top-1 right-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold">
            Cut
          </span>
        )}
        <span className="absolute right-0 bottom-0 left-0 bg-black/60 py-0.5 text-center text-[10px] font-medium text-white backdrop-blur-sm">
          {index + 1}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(image.id)}
        className="bg-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110"
        aria-label={`Remove ${image.file.name}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
});

export function ImageStrip({
  images,
  activeId,
  onSelect,
  onRemove,
  onClearAll,
}: ImageStripProps) {
  if (images.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">
          {images.length} image{images.length === 1 ? "" : "s"} · edits apply to
          all
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 shrink-0 px-2"
          onClick={onClearAll}
        >
          <Trash2 className="size-3.5" />
          Clear all
        </Button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((image, index) => (
          <ImageStripItem
            key={image.id}
            image={image}
            index={index}
            isActive={image.id === activeId}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ))}

        {images.length < MAX_BATCH_IMAGES && (
          <div className="text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-xs sm:size-20">
            +{MAX_BATCH_IMAGES - images.length}
          </div>
        )}
      </div>
    </div>
  );
}
