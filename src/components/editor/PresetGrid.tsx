"use client";

import { Button } from "@/components/ui/button";
import { SOCIAL_PRESETS } from "@/lib/presets";
import { type ResizeSettings } from "@/lib/imageOps";

type PresetGridProps = {
  onSelect: (resize: Partial<ResizeSettings>) => void;
  disabled?: boolean;
};

export function PresetGrid({ onSelect, disabled }: PresetGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {SOCIAL_PRESETS.map((preset) => (
        <Button
          key={preset.id}
          type="button"
          variant="outline"
          className="h-auto flex-col items-start gap-1 px-3 py-3 text-left"
          onClick={() =>
            onSelect({
              width: preset.width,
              height: preset.height,
              scalePercent: 100,
              maintainAspectRatio: false,
            })
          }
          disabled={disabled}
        >
          <span className="font-medium">{preset.name}</span>
          <span className="text-muted-foreground text-xs">
            {preset.width} × {preset.height}
          </span>
        </Button>
      ))}
    </div>
  );
}
