"use client";

import { Eraser, Loader2, RotateCcw, Scissors, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ModelStatus } from "@/lib/backgroundRemoval";
import { type BackgroundSettings } from "@/lib/imageOps";

const PRESET_COLORS = [
  "#ffffff",
  "#000000",
  "#f8fafc",
  "#1e293b",
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
];

type BackgroundControlsProps = {
  background: BackgroundSettings;
  imageCount: number;
  cutoutCount: number;
  isProcessing: boolean;
  progress: string;
  modelStatus?: ModelStatus;
  onBackgroundChange: (background: BackgroundSettings) => void;
  onRemoveBackgrounds: () => void;
  onRestoreOriginals: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

function ModelStatusBadge({ status }: { status: ModelStatus }) {
  if (status === "idle") return null;
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
        <span className="size-1.5 rounded-full bg-green-500" />
        AI ready
      </span>
    );
  }
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
        <Loader2 className="size-2.5 animate-spin" />
        Loading AI…
      </span>
    );
  }
  return null;
}

/** Parse "Loading model… 42%" → 42, otherwise null */
function parsePercent(msg: string): number | null {
  const m = msg.match(/(\d+)%/);
  return m ? parseInt(m[1], 10) : null;
}

export function BackgroundControls({
  background,
  imageCount,
  cutoutCount,
  isProcessing,
  progress,
  modelStatus = "idle",
  onBackgroundChange,
  onRemoveBackgrounds,
  onRestoreOriginals,
  onCancel,
  disabled,
}: BackgroundControlsProps) {
  const setType = (type: BackgroundSettings["type"]) => {
    onBackgroundChange({ ...background, type });
  };

  const percent = isProcessing ? parsePercent(progress) : null;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <Label>Remove background</Label>
          <ModelStatusBadge status={modelStatus} />
        </div>
        <p className="text-muted-foreground text-sm">
          Runs locally in your browser. First use downloads the AI model
          (~25 MB), then caches it for instant future runs.
        </p>

        {/* Progress bar */}
        {isProcessing && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground truncate">{progress}</span>
              {percent !== null && (
                <span className="text-primary shrink-0 tabular-nums">{percent}%</span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{
                  width: percent !== null ? `${percent}%` : "100%",
                  animation: percent === null ? "pulse 1.5s ease-in-out infinite" : undefined,
                }}
              />
            </div>
          </div>
        )}

        {/* Model pre-loading progress (silent warm-up) */}
        {!isProcessing && modelStatus === "loading" && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">
              Downloading AI model in the background…
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="bg-primary/50 h-full w-1/3 rounded-full animate-[slide-x_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {modelStatus === "ready" && !isProcessing && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Zap className="size-3" />
            <span>Model cached — removal will be instant.</span>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="h-11 flex-1 hover-lift"
            onClick={onRemoveBackgrounds}
            disabled={disabled || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {progress || "Processing…"}
              </>
            ) : (
              <>
                <Scissors className="size-4" />
                Remove from all ({imageCount})
              </>
            )}
          </Button>
          {isProcessing ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              onClick={onRestoreOriginals}
              disabled={disabled || cutoutCount === 0}
            >
              <RotateCcw className="size-4" />
              Restore
            </Button>
          )}
        </div>
        {cutoutCount > 0 && (
          <p className="text-muted-foreground text-sm">
            {cutoutCount} of {imageCount} image
            {imageCount === 1 ? "" : "s"} with background removed
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
        <Label>Replacement background</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={background.type === "transparent" ? "default" : "outline"}
            className={cn(
              "h-11 rounded-xl",
              background.type === "transparent" &&
                "shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.2)]",
            )}
            onClick={() => setType("transparent")}
            disabled={disabled}
          >
            <Eraser className="size-4" />
            Transparent
          </Button>
          <Button
            type="button"
            variant={background.type === "color" ? "default" : "outline"}
            className={cn(
              "h-11 rounded-xl",
              background.type === "color" &&
                "shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.2)]",
            )}
            onClick={() => setType("color")}
            disabled={disabled}
          >
            Solid color
          </Button>
        </div>

        {background.type === "color" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Background color ${color}`}
                  className={cn(
                    "size-9 rounded-full border-2 transition-all hover:scale-110",
                    background.color === color
                      ? "border-primary shadow-[0_0_0_3px_oklch(0.48_0.2_265/0.3)]"
                      : "border-border/60",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() =>
                    onBackgroundChange({ ...background, color })
                  }
                  disabled={disabled}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={background.color}
                onChange={(event) =>
                  onBackgroundChange({
                    ...background,
                    color: event.target.value,
                  })
                }
                className="h-11 w-16 shrink-0 cursor-pointer rounded-xl p-1"
                disabled={disabled}
              />
              <Input
                type="text"
                value={background.color}
                onChange={(event) =>
                  onBackgroundChange({
                    ...background,
                    color: event.target.value,
                  })
                }
                className="h-11 rounded-xl font-mono uppercase"
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {background.type === "transparent" && cutoutCount > 0 && (
          <p className="text-muted-foreground text-xs sm:text-sm">
            Transparent exports work best as PNG or WEBP. JPG will use a white
            background.
          </p>
        )}
      </div>
    </div>
  );
}
