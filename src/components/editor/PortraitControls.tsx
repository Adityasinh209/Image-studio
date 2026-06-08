"use client";

import { Camera, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  ratioToCoverDimensions,
  type PortraitOrientation,
  type PortraitSettings,
  type ResizeSettings,
} from "@/lib/imageOps";

const ORIENTATIONS: { id: PortraitOrientation; label: string; w: number; h: number }[] = [
  { id: "original", label: "Original", w: 0, h: 0 },
  { id: "4:5", label: "4:5", w: 4, h: 5 },
  { id: "3:4", label: "3:4", w: 3, h: 4 },
  { id: "9:16", label: "9:16", w: 9, h: 16 },
];

type PortraitControlsProps = {
  portrait: PortraitSettings;
  resize: ResizeSettings;
  originalWidth: number;
  originalHeight: number;
  isProcessing: boolean;
  progress: string;
  onPortraitChange: (portrait: PortraitSettings) => void;
  onResizeChange: (resize: ResizeSettings) => void;
  onTurnOn: () => void;
  onTurnOff: () => void;
  disabled?: boolean;
};

export function PortraitControls({
  portrait,
  resize,
  originalWidth,
  originalHeight,
  isProcessing,
  progress,
  onPortraitChange,
  onResizeChange,
  onTurnOn,
  onTurnOff,
  disabled,
}: PortraitControlsProps) {
  const activeOrientation = ORIENTATIONS.find((o) => {
    if (o.id === "original") return resize.width === 0 && resize.height === 0;
    const dims = ratioToCoverDimensions(originalWidth, originalHeight, o.w, o.h);
    return resize.width === dims.width && resize.height === dims.height && resize.mode === "cover";
  })?.id ?? "original";

  const handleOrientationSelect = (o: typeof ORIENTATIONS[number]) => {
    if (o.id === "original") {
      onResizeChange({
        ...resize,
        width: 0,
        height: 0,
        mode: "scale",
        maintainAspectRatio: true,
        scalePercent: 100,
      });
      return;
    }
    const dims = ratioToCoverDimensions(originalWidth, originalHeight, o.w, o.h);
    onResizeChange({
      ...resize,
      width: dims.width,
      height: dims.height,
      mode: "cover",
      maintainAspectRatio: false,
    });
  };

  return (
    <div className="space-y-5">
      {!portrait.enabled ? (
        <div className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-center sm:p-6">
          <div className="gradient-chip mx-auto flex size-14 items-center justify-center rounded-2xl shadow-lg">
            <Camera className="size-7" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Camera-style portrait look</p>
            <p className="text-muted-foreground text-sm">
              Blur the background and sharpen your subject — just like portrait
              mode on a phone camera.
            </p>
          </div>
          <Button
            type="button"
            className="h-12 w-full text-base hover-lift"
            onClick={onTurnOn}
            disabled={disabled || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {progress || "Turning on Portrait Mode..."}
              </>
            ) : (
              <>
                <Camera className="size-4" />
                Turn On Portrait Mode
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="gradient-chip flex size-2.5 rounded-full" />
              <span className="text-sm font-medium">Portrait Mode is on</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={onTurnOff}
              disabled={disabled || isProcessing}
            >
              Turn Off
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <Label>Background blur</Label>
              <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs tabular-nums">
                {portrait.blurStrength}
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[portrait.blurStrength]}
              onValueChange={([v]) =>
                onPortraitChange({ ...portrait, blurStrength: v })
              }
              disabled={disabled}
            />
            <p className="text-muted-foreground text-xs">
              0 = sharp background, 100 = maximum bokeh
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <Label>Vertical orientation</Label>
        <p className="text-muted-foreground text-sm">
          Crop to a portrait aspect ratio. Works independently of Portrait Mode.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ORIENTATIONS.map((o) => (
            <Button
              key={o.id}
              type="button"
              variant={activeOrientation === o.id ? "default" : "outline"}
              className={cn(
                "h-11 rounded-xl text-xs sm:text-sm",
                activeOrientation === o.id &&
                  "shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.2)]",
                activeOrientation !== o.id && "hover-lift",
              )}
              onClick={() => handleOrientationSelect(o)}
              disabled={disabled}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
