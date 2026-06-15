"use client";

import { Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  computeOutputDimensions,
  type ResizeSettings,
} from "@/lib/imageOps";

type ResizeControlsProps = {
  resize: ResizeSettings;
  originalWidth: number;
  originalHeight: number;
  /** Live preview while dragging scale slider */
  onChange: (resize: ResizeSettings) => void;
  /** Finalize slider drag */
  onCommit?: (resize: ResizeSettings) => void;
  onBeginEdit?: () => void;
  /** Width/height inputs — pushes undo immediately */
  onDimensionChange: (resize: ResizeSettings) => void;
  disabled?: boolean;
};

export function ResizeControls({
  resize,
  originalWidth,
  originalHeight,
  onChange,
  onCommit,
  onBeginEdit,
  onDimensionChange,
  disabled,
}: ResizeControlsProps) {
  const updateDimensions = (partial: Partial<ResizeSettings>) => {
    onDimensionChange({ ...resize, ...partial });
  };

  const output = computeOutputDimensions(originalWidth, originalHeight, resize);

  const handleWidthChange = (value: string) => {
    const width = Math.max(0, Number.parseInt(value, 10) || 0);
    if (resize.maintainAspectRatio && originalWidth > 0 && width > 0) {
      const aspect = originalHeight / originalWidth;
      updateDimensions({
        width,
        height: Math.round(width * aspect),
        scalePercent: 100,
      });
      return;
    }
    updateDimensions({ width, scalePercent: 100 });
  };

  const handleHeightChange = (value: string) => {
    const height = Math.max(0, Number.parseInt(value, 10) || 0);
    if (resize.maintainAspectRatio && originalHeight > 0 && height > 0) {
      const aspect = originalWidth / originalHeight;
      updateDimensions({
        height,
        width: Math.round(height * aspect),
        scalePercent: 100,
      });
      return;
    }
    updateDimensions({ height, scalePercent: 100 });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <Label>Scale</Label>
          <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs tabular-nums">
            {resize.scalePercent}%
          </span>
        </div>
        <Slider
          min={10}
          max={200}
          step={1}
          value={[resize.scalePercent]}
          onValueChange={([scalePercent]) => {
            onBeginEdit?.();
            onChange({
              ...resize,
              scalePercent,
              width: 0,
              height: 0,
              mode: "scale",
            });
          }}
          onValueCommit={([scalePercent]) =>
            onCommit?.({
              ...resize,
              scalePercent,
              width: 0,
              height: 0,
              mode: "scale",
            })
          }
          disabled={disabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="space-y-2">
          <Label htmlFor="width">Width (px)</Label>
          <Input
            id="width"
            type="number"
            min={0}
            value={resize.width > 0 ? resize.width : ""}
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
            value={resize.height > 0 ? resize.height : ""}
            placeholder={originalHeight ? String(originalHeight) : "Auto"}
            onChange={(event) => handleHeightChange(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      {output.width > 0 && output.height > 0 && (
        <p className="text-muted-foreground text-sm">
          Output: {output.width} × {output.height}px
          {resize.mode === "cover" && " (cover crop)"}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-xl"
        onClick={() =>
          updateDimensions({ maintainAspectRatio: !resize.maintainAspectRatio })
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
