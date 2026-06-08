"use client";

import { Sparkles, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  AUTO_ENHANCE_VALUES,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_EFFECTS,
  LOOKS,
  UPSCALE_FACTORS,
  type EffectsSettings,
  type ImageAdjustments,
  type LookType,
  type UpscaleFactor,
} from "@/lib/imageOps";

type AdjustmentControlsProps = {
  adjustments: ImageAdjustments;
  effects: EffectsSettings;
  upscaleFactor: UpscaleFactor;
  outputWidth: number;
  outputHeight: number;
  onChange: (adjustments: ImageAdjustments) => void;
  onEffectsChange: (effects: EffectsSettings) => void;
  onUpscaleChange: (factor: UpscaleFactor) => void;
  disabled?: boolean;
};

function AdjustmentSlider({
  label,
  value,
  min,
  max,
  onValueChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs tabular-nums">
          {value}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([next]) => onValueChange(next)}
        disabled={disabled}
      />
    </div>
  );
}

export function AdjustmentControls({
  adjustments,
  effects,
  upscaleFactor,
  outputWidth,
  outputHeight,
  onChange,
  onEffectsChange,
  onUpscaleChange,
  disabled,
}: AdjustmentControlsProps) {
  const update = (key: keyof ImageAdjustments, value: number) => {
    onChange({ ...adjustments, [key]: value });
  };

  const updateEffect = (key: keyof EffectsSettings, value: number | LookType) => {
    onEffectsChange({ ...effects, [key]: value });
  };

  const handleReset = () => {
    onChange(DEFAULT_ADJUSTMENTS);
    onEffectsChange(DEFAULT_EFFECTS);
    onUpscaleChange(1);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <Label>Resolution</Label>
          <span className="bg-muted rounded-md px-2 py-0.5 text-xs font-medium">
            {upscaleFactor}x upscale
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {UPSCALE_FACTORS.map((factor) => (
            <Button
              key={factor}
              type="button"
              variant={upscaleFactor === factor ? "default" : "outline"}
              className={cn(
                "h-11 rounded-xl",
                upscaleFactor === factor &&
                  "shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.2)]",
                upscaleFactor !== factor && "hover-lift",
              )}
              onClick={() => onUpscaleChange(factor)}
              disabled={disabled}
            >
              {factor}x
            </Button>
          ))}
        </div>
        {outputWidth > 0 && outputHeight > 0 && (
          <p className="text-muted-foreground text-sm">
            Export size: {outputWidth} × {outputHeight}px
            {upscaleFactor > 1 && " (full resolution applied on download)"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="h-11 flex-1 hover-lift"
          onClick={() => onChange(AUTO_ENHANCE_VALUES)}
          disabled={disabled}
        >
          <Sparkles className="size-4" />
          Auto Enhance
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={handleReset}
          disabled={disabled}
        >
          <RotateCcw className="size-4" />
          Reset
        </Button>
      </div>

      <AdjustmentSlider
        label="Brightness"
        value={adjustments.brightness}
        min={-100}
        max={100}
        onValueChange={(value) => update("brightness", value)}
        disabled={disabled}
      />
      <AdjustmentSlider
        label="Contrast"
        value={adjustments.contrast}
        min={-100}
        max={100}
        onValueChange={(value) => update("contrast", value)}
        disabled={disabled}
      />
      <AdjustmentSlider
        label="Sharpness"
        value={adjustments.sharpness}
        min={0}
        max={100}
        onValueChange={(value) => update("sharpness", value)}
        disabled={disabled}
      />
      <AdjustmentSlider
        label="Noise Reduction"
        value={adjustments.noiseReduction}
        min={0}
        max={100}
        onValueChange={(value) => update("noiseReduction", value)}
        disabled={disabled}
      />

      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <Label>Looks</Label>
        <div className="grid grid-cols-4 gap-2">
          {LOOKS.map((look) => (
            <Button
              key={look.id}
              type="button"
              variant={effects.look === look.id ? "default" : "outline"}
              className={cn(
                "h-11 rounded-xl text-xs sm:text-sm",
                effects.look === look.id &&
                  "shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.2)]",
                effects.look !== look.id && "hover-lift",
              )}
              onClick={() => updateEffect("look", look.id)}
              disabled={disabled}
            >
              {look.label}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          One-click film looks: black & white, sepia, or faded vintage.
        </p>
      </div>

      <AdjustmentSlider
        label="Vignette"
        value={effects.vignette}
        min={0}
        max={100}
        onValueChange={(value) => updateEffect("vignette", value)}
        disabled={disabled}
      />

      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Portrait Retouch</Label>
          <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs tabular-nums">
            {effects.retouch}
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[effects.retouch]}
          onValueChange={([next]) => updateEffect("retouch", next)}
          disabled={disabled}
        />
        <p className="text-muted-foreground text-xs">
          Subtly brightens teeth, eyes, and face highlights for a clean look.
        </p>
      </div>
    </div>
  );
}
