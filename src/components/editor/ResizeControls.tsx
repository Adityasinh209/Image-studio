"use client";

import { Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { type ResizeSettings } from "@/lib/imageOps";

type ResizeControlsProps = {
  resize: ResizeSettings;
  originalWidth: number;
  originalHeight: number;
  onChange: (resize: ResizeSettings) => void;
  disabled?: boolean;
};

export function ResizeControls({
  resize,
  originalWidth,
  originalHeight,
  onChange,
  disabled,
}: ResizeControlsProps) {
  const update = (partial: Partial<ResizeSettings>) => {
    onChange({ ...resize, ...partial });
  };

  const handleWidthChange = (value: string) => {
    const width = Number(value) || 0;
    if (resize.maintainAspectRatio && originalWidth > 0 && width > 0) {
      const aspect = originalHeight / originalWidth;
      update({ width, height: Math.round(width * aspect) });
      return;
    }
    update({ width });
  };

  const handleHeightChange = (value: string) => {
    const height = Number(value) || 0;
    if (resize.maintainAspectRatio && originalHeight > 0 && height > 0) {
      const aspect = originalWidth / originalHeight;
      update({ height, width: Math.round(height * aspect) });
      return;
    }
    update({ height });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Scale</Label>
          <span className="text-muted-foreground text-sm">
            {resize.scalePercent}%
          </span>
        </div>
        <Slider
          min={10}
          max={200}
          step={1}
          value={[resize.scalePercent]}
          onValueChange={([scalePercent]) => update({ scalePercent })}
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="width">Width (px)</Label>
          <Input
            id="width"
            type="number"
            min={0}
            value={resize.width || ""}
            placeholder={originalWidth ? String(originalWidth) : "Auto"}
            onChange={(event) => handleWidthChange(event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Height (px)</Label>
          <Input
            id="height"
            type="number"
            min={0}
            value={resize.height || ""}
            placeholder={originalHeight ? String(originalHeight) : "Auto"}
            onChange={(event) => handleHeightChange(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() =>
          update({ maintainAspectRatio: !resize.maintainAspectRatio })
        }
        disabled={disabled}
      >
        {resize.maintainAspectRatio ? (
          <>
            <Lock className="size-4" />
            Maintain Aspect Ratio
          </>
        ) : (
          <>
            <Unlock className="size-4" />
            Ignore Aspect Ratio
          </>
        )}
      </Button>
    </div>
  );
}
