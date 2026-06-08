"use client";

import { Button } from "@/components/ui/button";
import { SOCIAL_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { type ResizeSettings } from "@/lib/imageOps";

type PresetGridProps = {
  resize: ResizeSettings;
  onSelect: (resize: Partial<ResizeSettings>) => void;
  disabled?: boolean;
};

export function PresetGrid({ resize, onSelect, disabled }: PresetGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2">
      {SOCIAL_PRESETS.map((preset) => {
        const isActive =
          resize.mode === "cover" &&
          resize.width === preset.width &&
          resize.height === preset.height;

        return (
          <Button
            key={preset.id}
            type="button"
            variant={isActive ? "default" : "outline"}
            className={cn(
              "h-auto min-h-12 flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-all",
              isActive && "shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.2)]",
              !isActive && "hover-lift",
            )}
            onClick={() =>
              onSelect({
                width: preset.width,
                height: preset.height,
                scalePercent: 100,
                maintainAspectRatio: false,
                mode: "cover",
              })
            }
            disabled={disabled}
          >
            <span className="font-medium">{preset.name}</span>
            <span
              className={cn(
                "text-xs",
                isActive ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {preset.width} × {preset.height}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
