"use client";

import { Sparkles, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  AUTO_ENHANCE_VALUES,
  DEFAULT_ADJUSTMENTS,
  type ImageAdjustments,
} from "@/lib/imageOps";

type AdjustmentControlsProps = {
  adjustments: ImageAdjustments;
  onChange: (adjustments: ImageAdjustments) => void;
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-muted-foreground text-sm">{value}</span>
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
  onChange,
  disabled,
}: AdjustmentControlsProps) {
  const update = (key: keyof ImageAdjustments, value: number) => {
    onChange({ ...adjustments, [key]: value });
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          onClick={() => onChange(AUTO_ENHANCE_VALUES)}
          disabled={disabled}
        >
          <Sparkles className="size-4" />
          Auto Enhance
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(DEFAULT_ADJUSTMENTS)}
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
    </div>
  );
}
