"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Columns2,
  Eraser,
  ImageIcon,
  Layers,
  Moon,
  Sparkles,
  Sun,
  Undo2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { AdjustmentControls } from "@/components/editor/AdjustmentControls";
import { BackgroundControls } from "@/components/editor/BackgroundControls";
import { BeforeAfter } from "@/components/editor/BeforeAfter";
import { CanvasPreview } from "@/components/editor/CanvasPreview";
import { ExportBar } from "@/components/editor/ExportBar";
import { ImageStrip } from "@/components/editor/ImageStrip";
import { PortraitControls } from "@/components/editor/PortraitControls";
import { PresetGrid } from "@/components/editor/PresetGrid";
import { ResizeControls } from "@/components/editor/ResizeControls";
import { UploadDropzone } from "@/components/editor/UploadDropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createCutoutFile,
  getExportFile,
  loadEditorImage,
  revokeEditorImage,
  revokeEditorImages,
  type EditorImage,
} from "@/lib/editorImages";
import {
  computeOutputDimensions,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_BACKGROUND,
  DEFAULT_EFFECTS,
  DEFAULT_PORTRAIT,
  DEFAULT_RESIZE,
  type BackgroundSettings,
  type EffectsSettings,
  type ImageAdjustments,
  type ImageOps,
  type PortraitSettings,
  type PreviewUrls,
  type ResizeSettings,
  type UpscaleFactor,
} from "@/lib/imageOps";
import { SOCIAL_PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";

/* ── Control panel IDs ──────────────────────────────────────────────────── */
type ControlPanel = "upload" | "enhance" | "resize" | "background" | "portrait" | "presets";

const PANEL_LABELS: Record<ControlPanel, string> = {
  upload: "Upload",
  enhance: "Enhance",
  resize: "Resize",
  background: "Background",
  portrait: "Portrait",
  presets: "Presets",
};

const CONTROL_TABS: {
  id: ControlPanel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "upload", label: "Upload", icon: Upload },
  { id: "enhance", label: "Enhance", icon: Sparkles },
  { id: "resize", label: "Resize", icon: ImageIcon },
  { id: "background", label: "Background", icon: Eraser },
  { id: "portrait", label: "Portrait", icon: Camera },
  { id: "presets", label: "Presets", icon: Layers },
];

/* ── Dimension summary ──────────────────────────────────────────────────── */
function DimensionSummary({
  originalWidth,
  originalHeight,
  outputWidth,
  outputHeight,
  imageIndex,
  imageCount,
  fileName,
}: {
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  imageIndex: number;
  imageCount: number;
  fileName: string;
}) {
  return (
    <span className="flex flex-col gap-0.5 text-left sm:block">
      {imageCount > 1 && (
        <span className="text-foreground/80 block truncate">
          Image {imageIndex + 1} of {imageCount}: {fileName}
        </span>
      )}
      <span>
        Original {originalWidth} × {originalHeight}px
      </span>
      <span className="hidden sm:inline"> → </span>
      <span className="text-foreground/80 sm:text-inherit">
        Output {outputWidth} × {outputHeight}px
      </span>
    </span>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  /* Images */
  const [images, setImages] = useState<EditorImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewUrls | null>(null);

  /* Editing state */
  const [adjustments, setAdjustments] =
    useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);
  const [resize, setResize] = useState<ResizeSettings>(DEFAULT_RESIZE);
  const [background, setBackground] =
    useState<BackgroundSettings>(DEFAULT_BACKGROUND);
  const [portrait, setPortrait] = useState<PortraitSettings>(DEFAULT_PORTRAIT);
  const [effects, setEffects] = useState<EffectsSettings>(DEFAULT_EFFECTS);

  /* Background-removal / portrait processing */
  const [bgProgress, setBgProgress] = useState("");
  const [isBgProcessing, setIsBgProcessing] = useState(false);
  const [portraitActivating, setPortraitActivating] = useState(false);

  /* Bottom control panel */
  const [activePanel, setActivePanel] = useState<ControlPanel | null>(null);
  const [undoStack, setUndoStack] = useState<ImageOps[]>([]);
  const [isLgUp, setIsLgUp] = useState(false);

  const imagesRef = useRef(images);
  const bgCancelRef = useRef(false);
  const adjustmentsRef = useRef(adjustments);
  const resizeRef = useRef(resize);
  const backgroundRef = useRef(background);
  const portraitRef = useRef(portrait);
  const effectsRef = useRef(effects);
  imagesRef.current = images;
  adjustmentsRef.current = adjustments;
  resizeRef.current = resize;
  backgroundRef.current = background;
  portraitRef.current = portrait;
  effectsRef.current = effects;

  /* ── Derived values ───────────────────────────────────────────────────── */
  const activeImage = useMemo(
    () => images.find((img) => img.id === activeImageId) ?? null,
    [activeImageId, images],
  );

  const ops: ImageOps = useMemo(
    () => ({ adjustments, resize, background, portrait, effects }),
    [adjustments, resize, background, portrait, effects],
  );

  const outputDimensions = useMemo(() => {
    if (!activeImage) return { width: 0, height: 0 };
    return computeOutputDimensions(
      activeImage.originalWidth,
      activeImage.originalHeight,
      resize,
    );
  }, [activeImage, resize]);

  const activeImageIndex = useMemo(
    () => (activeImage ? images.findIndex((i) => i.id === activeImage.id) : -1),
    [activeImage, images],
  );

  const cutoutCount = useMemo(
    () => images.filter((i) => i.bgRemovedByUser && i.bgStatus === "done").length,
    [images],
  );

  const exportItems = useMemo(
    () =>
      images.map((img) => ({
        file: getExportFile(img),
        originalFile: img.file,
        cutoutFile: img.cutoutFile,
      })),
    [images],
  );

  const useBackgroundCutout =
    !portrait.enabled &&
    background.type === "transparent" &&
    Boolean(activeImage?.bgRemovedByUser && activeImage?.cutoutUrl);

  const showCheckerboard = useBackgroundCutout;

  const hasImages = images.length > 0;
  const canUndo = hasImages && undoStack.length > 0;
  const isPanelOpen = activePanel !== null;

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  const togglePanel = useCallback((id: ControlPanel) => {
    setActivePanel((prev) => (prev === id ? null : id));
  }, []);

  const cloneOps = useCallback((source: ImageOps): ImageOps => {
    return {
      adjustments: { ...source.adjustments },
      resize: { ...source.resize },
      background: { ...source.background },
      portrait: { ...source.portrait },
      effects: { ...source.effects },
    };
  }, []);

  const getCurrentOpsSnapshot = useCallback((): ImageOps => {
    return {
      adjustments: { ...adjustmentsRef.current },
      resize: { ...resizeRef.current },
      background: { ...backgroundRef.current },
      portrait: { ...portraitRef.current },
      effects: { ...effectsRef.current },
    };
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    if (!hasImages) return;

    const snapshot = getCurrentOpsSnapshot();
    setUndoStack((current) => {
      const last = current[current.length - 1];
      const isDuplicate = last && JSON.stringify(last) === JSON.stringify(snapshot);
      if (isDuplicate) return current;

      const next = [...current, cloneOps(snapshot)];
      if (next.length > 250) next.shift();
      return next;
    });
  }, [cloneOps, getCurrentOpsSnapshot, hasImages]);

  const applyOpsSnapshot = useCallback((snapshot: ImageOps) => {
    setAdjustments(snapshot.adjustments);
    setResize(snapshot.resize);
    setBackground(snapshot.background);
    setPortrait(snapshot.portrait);
    setEffects(snapshot.effects);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((current) => {
      if (current.length === 0) return current;
      const previous = current[current.length - 1];
      applyOpsSnapshot(previous);
      return current.slice(0, -1);
    });
  }, [applyOpsSnapshot]);

  const handleAdjustmentsChange = useCallback(
    (next: ImageAdjustments) => {
      pushUndoSnapshot();
      setAdjustments(next);
    },
    [pushUndoSnapshot],
  );

  const handleEffectsChange = useCallback(
    (next: EffectsSettings) => {
      pushUndoSnapshot();
      setEffects(next);
    },
    [pushUndoSnapshot],
  );

  const handleResizeChange = useCallback(
    (next: ResizeSettings) => {
      pushUndoSnapshot();
      setResize(next);
    },
    [pushUndoSnapshot],
  );

  const handleResizePartialChange = useCallback(
    (partial: Partial<ResizeSettings>) => {
      pushUndoSnapshot();
      setResize((current) => ({ ...current, ...partial }));
    },
    [pushUndoSnapshot],
  );

  const handleBackgroundChange = useCallback(
    (next: BackgroundSettings) => {
      pushUndoSnapshot();
      setBackground(next);
    },
    [pushUndoSnapshot],
  );

  const handlePortraitChange = useCallback(
    (next: PortraitSettings) => {
      pushUndoSnapshot();
      setPortrait(next);
    },
    [pushUndoSnapshot],
  );

  /* Close panel with Escape key */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActivePanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /* Lock page scroll when mobile bottom sheet is open */
  useEffect(() => {
    if (!isPanelOpen || isLgUp) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isPanelOpen, isLgUp]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      revokeEditorImages(imagesRef.current);
    };
  }, []);

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  const handleFilesSelect = useCallback(async (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    const results = await Promise.allSettled(
      incomingFiles.map((file) => loadEditorImage(file)),
    );

    const loaded: EditorImage[] = [];
    const failed: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        loaded.push(result.value);
      } else {
        failed.push(result.reason?.message ?? "Unknown file");
      }
    }

    if (loaded.length === 0) {
      toast.error("Failed to load images. Please try other files.");
      return;
    }

    if (failed.length > 0) {
      toast.error(`${failed.length} image(s) failed to load.`);
    }

    setImages((current) => {
      const isFirstBatch = current.length === 0;
      const next = [...current, ...loaded];

      if (isFirstBatch) {
        setActiveImageId(loaded[0].id);
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setResize(DEFAULT_RESIZE);
        setBackground(DEFAULT_BACKGROUND);
        setPortrait(DEFAULT_PORTRAIT);
        setEffects(DEFAULT_EFFECTS);
        setUndoStack([]);
        setPreview(null);
      }

      return next;
    });

    toast.success(
      loaded.length === 1 ? "1 image added." : `${loaded.length} images added.`,
    );
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((current) => {
      const removed = current.find((img) => img.id === id);
      if (removed) revokeEditorImage(removed);

      const next = current.filter((img) => img.id !== id);

      setActiveImageId((cur) => {
        if (cur !== id) return cur;
        return next[0]?.id ?? null;
      });

      if (next.length === 0) {
        setPreview(null);
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setResize(DEFAULT_RESIZE);
        setBackground(DEFAULT_BACKGROUND);
        setPortrait(DEFAULT_PORTRAIT);
        setEffects(DEFAULT_EFFECTS);
        setUndoStack([]);
        setActivePanel(null);
      }

      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    bgCancelRef.current = true;
    setIsBgProcessing(false);
    setPortraitActivating(false);
    setBgProgress("");
    setImages((current) => {
      revokeEditorImages(current);
      return [];
    });
    setActiveImageId(null);
    setPreview(null);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setResize(DEFAULT_RESIZE);
    setBackground(DEFAULT_BACKGROUND);
    setPortrait(DEFAULT_PORTRAIT);
    setEffects(DEFAULT_EFFECTS);
    setUndoStack([]);
    setActivePanel(null);
    toast.success("All images cleared.");
  }, []);

  const handlePresetSelect = useCallback(
    (partial: Partial<ResizeSettings>) => {
      pushUndoSnapshot();
      setResize((current) => ({ ...current, ...partial }));
      const preset = SOCIAL_PRESETS.find(
        (item) =>
          item.width === partial.width && item.height === partial.height,
      );
      toast.success(
        preset
          ? `Applied ${preset.name} to all images`
          : "Preset applied to all images",
      );
    },
    [pushUndoSnapshot],
  );

  const runBackgroundRemoval = useCallback(
    async (targets: EditorImage[], markAsUserRemoval = false) => {
      if (targets.length === 0) return { successCount: 0, failureCount: 0 };
      const { removeBackground } = await import("@/lib/backgroundRemoval");

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < targets.length; i++) {
        if (bgCancelRef.current) break;
        const image = targets[i];
        setBgProgress(`Cutting out ${i + 1}/${targets.length}...`);

        setImages((prev) =>
          prev.map((item) =>
            item.id === image.id ? { ...item, bgStatus: "processing" } : item,
          ),
        );

        try {
          const blob = await removeBackground(image.file, setBgProgress);
          if (bgCancelRef.current) break;

          const cutoutUrl = URL.createObjectURL(blob);
          const cutoutFile = createCutoutFile(image.file, blob);

          setImages((prev) =>
            prev.map((item) => {
              if (item.id !== image.id) return item;
              if (item.cutoutUrl) URL.revokeObjectURL(item.cutoutUrl);
              return {
                ...item,
                cutoutUrl,
                cutoutFile,
                bgStatus: "done" as const,
                bgRemovedByUser: markAsUserRemoval ? true : item.bgRemovedByUser,
              };
            }),
          );
          successCount++;
        } catch (error) {
          failureCount++;
          setImages((prev) =>
            prev.map((item) =>
              item.id === image.id ? { ...item, bgStatus: "error" } : item,
            ),
          );
          console.error(`Background removal failed for ${image.file.name}:`, error);
        }
      }

      return { successCount, failureCount };
    },
    [],
  );

  const handleRemoveBackgrounds = useCallback(async () => {
    const currentImages = imagesRef.current;
    if (currentImages.length === 0) return;

    bgCancelRef.current = false;
    setIsBgProcessing(true);
    setBgProgress("Preparing...");

    const { successCount, failureCount } = await runBackgroundRemoval(
      currentImages,
      true,
    );

    setIsBgProcessing(false);
    setBgProgress("");

    if (bgCancelRef.current) {
      toast.info("Background removal cancelled.");
      setImages((prev) =>
        prev.map((item) =>
          item.bgStatus === "processing" ? { ...item, bgStatus: "none" } : item,
        ),
      );
      return;
    }

    if (successCount > 0 && failureCount === 0) {
      toast.success(
        successCount === 1
          ? "Background removed."
          : `Background removed from ${successCount} images.`,
      );
    } else if (successCount > 0) {
      toast.warning(
        `Background removed from ${successCount} image(s). ${failureCount} failed.`,
      );
    } else {
      toast.error("Background removal failed for all images.");
    }
  }, [runBackgroundRemoval]);

  const handleRestoreOriginals = useCallback(() => {
    setImages((prev) =>
      prev.map((item) => {
        if (item.cutoutUrl) URL.revokeObjectURL(item.cutoutUrl);
        return {
          ...item,
          cutoutUrl: null,
          cutoutFile: null,
          bgStatus: "none" as const,
          bgRemovedByUser: false,
        };
      }),
    );
    toast.success("Restored original images.");
  }, []);

  const handleCancelBackground = useCallback(() => {
    bgCancelRef.current = true;
  }, []);

  const handlePortraitTurnOn = useCallback(async () => {
    if (portrait.enabled || portraitActivating) return;
    const currentImages = imagesRef.current;
    if (currentImages.length === 0) return;

    setPortraitActivating(true);
    const needsCutout = currentImages.some((img) => img.bgStatus !== "done");

    if (needsCutout) {
      bgCancelRef.current = false;
      setIsBgProcessing(true);
      setBgProgress("Turning on Portrait Mode...");

      const toProcess = currentImages.filter((img) => img.bgStatus !== "done");
      const { successCount, failureCount } = await runBackgroundRemoval(toProcess);

      setIsBgProcessing(false);
      setBgProgress("");

      if (bgCancelRef.current) {
        setPortraitActivating(false);
        toast.info("Portrait mode cancelled.");
        return;
      }

      if (successCount === 0) {
        setPortraitActivating(false);
        toast.error("Could not turn on Portrait Mode. Please try again.");
        return;
      }

      if (failureCount > 0) {
        toast.warning(
          `Portrait Mode is on. ${failureCount} image(s) could not be processed.`,
        );
      }
    }

    pushUndoSnapshot();
    setPortrait((p) => ({ ...p, enabled: true }));
    setPortraitActivating(false);
    toast.success("Portrait Mode is on.");
  }, [portrait.enabled, portraitActivating, pushUndoSnapshot, runBackgroundRemoval]);

  const handlePortraitTurnOff = useCallback(() => {
    pushUndoSnapshot();
    setPortrait((p) => ({ ...p, enabled: false }));
    toast.success("Portrait Mode turned off.");
  }, [pushUndoSnapshot]);

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div
      className={cn(
        hasImages && "lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden",
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className={cn(
          "glass-bar sticky top-0 z-30 -mx-3 px-3 py-2.5 sm:-mx-4 sm:px-4 sm:py-3 md:-mx-6 md:px-6",
          hasImages && "lg:static lg:shrink-0 lg:py-2.5",
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <span className="gradient-chip animate-float flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-9">
              <Wand2 className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold tracking-tight sm:text-base">PIXOR</p>
              <p className="text-muted-foreground hidden text-xs md:block">
                Enhance · Resize · Cut out · Portrait
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export button — desktop only; mobile has its own row above the toolbar */}
            {hasImages && (
              <div className="hidden lg:block">
                <ExportBar items={exportItems} ops={ops} disabled={!hasImages} compact />
              </div>
            )}

            {mounted && (
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0 rounded-xl border-border/60 bg-background/60 backdrop-blur-sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-4 sm:py-5 md:px-6",
          hasImages
            ? cn(
                "pb-[calc(10rem+env(safe-area-inset-bottom))] sm:pb-[calc(10.5rem+env(safe-area-inset-bottom))]",
                isPanelOpen &&
                  !isLgUp &&
                  "pb-[calc(min(72dvh,32rem)+10rem+env(safe-area-inset-bottom))]",
                "lg:min-h-0 lg:flex-1 lg:gap-2 lg:overflow-hidden lg:py-2 lg:pb-[5.5rem]",
              )
            : "pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-24 lg:pb-16",
        )}
      >
        {/* Hero — only when no images loaded */}
        {!hasImages && (
          <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-border/50 px-5 py-8 text-center sm:px-8 sm:py-12">
            <div
              className="pointer-events-none absolute inset-0 -z-10 opacity-80"
              aria-hidden
              style={{
                background:
                  "radial-gradient(60% 80% at 50% 0%, oklch(0.6 0.24 300 / 0.18), transparent 70%)",
              }}
            />
            <span className="border-primary/20 bg-primary/5 text-primary mx-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              100% local · free · private
            </span>
            <h1 className="gradient-text mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
              Make every image look its best
            </h1>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
              Upload up to 15 images, remove backgrounds, apply camera-style portrait
              blur, enhance and resize together, then export — all in your browser.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: Sparkles, label: "AI Enhance" },
                { icon: Eraser, label: "Cut Out" },
                { icon: Camera, label: "Portrait" },
                { icon: Layers, label: "Presets" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="border-border/60 bg-background/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
                >
                  <Icon className="text-primary size-3.5" />
                  {label}
                </span>
              ))}
            </div>
            <Button
              type="button"
              className="mt-6 h-12 w-full max-w-sm hover-lift sm:w-auto sm:px-8"
              onClick={() => togglePanel("upload")}
            >
              <Upload className="size-4" />
              Upload images to start
            </Button>
          </section>
        )}

        {/* ── Upload card ─────────────────────────────────────────────── */}
        {/* <Card className="animate-fade-up stagger-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2.5">
              <span className="gradient-chip flex size-8 items-center justify-center rounded-lg">
                <Upload className="size-4" />
              </span>
              <CardTitle className="text-base sm:text-lg">Upload</CardTitle>
            </div>
            <CardDescription>JPG, JPEG, PNG, or WEBP — up to 15 images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <UploadDropzone
              onFilesSelect={handleFilesSelect}
              currentCount={images.length}
            />
            <ImageStrip
              images={images}
              activeId={activeImageId}
              onSelect={setActiveImageId}
              onRemove={handleRemoveImage}
              onClearAll={handleClearAll}
            />
          </CardContent>
        </Card> */}

        {/* ── Before / After — primary focus ──────────────────────────── */}
        <Card
          className={cn(
            "animate-fade-up stagger-2",
            hasImages && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col",
          )}
        >
          <CardHeader
            className={cn(
              "space-y-1.5 pb-2 sm:space-y-2",
              hasImages && "lg:shrink-0 lg:space-y-1 lg:py-3 lg:pb-1",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                <span className="gradient-chip flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-8">
                  <Columns2 className="size-3.5 sm:size-4" />
                </span>
                <CardTitle className="truncate text-sm sm:text-lg">
                  Before & After
                </CardTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0 rounded-lg px-2.5 sm:h-9 sm:px-3"
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo last image edit"
                title="Undo last edit"
              >
                <Undo2 className="size-4" />
                <span className="hidden min-[400px]:inline">Undo</span>
              </Button>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {hasImages && activeImage && outputDimensions.width > 0 ? (
                <DimensionSummary
                  originalWidth={activeImage.originalWidth}
                  originalHeight={activeImage.originalHeight}
                  outputWidth={outputDimensions.width}
                  outputHeight={outputDimensions.height}
                  imageIndex={activeImageIndex}
                  imageCount={images.length}
                  fileName={activeImage.file.name}
                />
              ) : (
                "Drag the slider to compare original vs enhanced output"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent
            className={cn(
              "space-y-3",
              hasImages && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:space-y-2 lg:pb-3",
            )}
          >
            <BeforeAfter
              baselineUrl={preview?.baseline ?? null}
              processedUrl={preview?.processed ?? null}
              outputWidth={preview?.outputWidth ?? outputDimensions.width}
              outputHeight={preview?.outputHeight ?? outputDimensions.height}
              showCheckerboard={showCheckerboard}
              fill={hasImages && isLgUp}
              onUploadClick={!hasImages ? () => togglePanel("upload") : undefined}
              className={cn(
                !hasImages && "min-h-[40vw] sm:min-h-[32vh]",
                hasImages &&
                  !isLgUp &&
                  "max-h-[min(52dvh,28rem)] min-h-[28dvh] sm:max-h-[min(56dvh,32rem)] sm:min-h-[32dvh]",
                hasImages && isLgUp && "lg:min-h-0 lg:max-h-none lg:flex-1 lg:h-full",
              )}
            />
            {!hasImages && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl lg:hidden"
                onClick={() => togglePanel("upload")}
              >
                <Upload className="size-4" />
                Tap to upload images
              </Button>
            )}
            {hasImages && resize.upscaleFactor > 1 && activeImage && (
              <p className="text-muted-foreground shrink-0 text-center text-xs sm:text-sm lg:text-[11px]">
                Preview is capped for performance. Full {resize.upscaleFactor}x
                resolution is applied to all {images.length} image
                {images.length === 1 ? "" : "s"} on download.
              </p>
            )}
          </CardContent>
        </Card>

      </main>

      {/* ── Hidden canvas for processing ────────────────────────────────── */}
      {activeImage && (
        <CanvasPreview
          key={`${activeImage.id}-${activeImage.cutoutUrl ?? "orig"}`}
          hidden
          originalUrl={activeImage.sourceUrl}
          cutoutUrl={activeImage.cutoutUrl}
          originalWidth={activeImage.originalWidth}
          originalHeight={activeImage.originalHeight}
          adjustments={adjustments}
          resize={resize}
          background={background}
          portrait={portrait}
          effects={effects}
          useBackgroundCutout={useBackgroundCutout}
          onPreviewChange={setPreview}
        />
      )}

      {/* Mobile backdrop — tap outside sheet to close */}
      {isPanelOpen && !isLgUp && (
        <button
          type="button"
          className="ctrl-sheet-backdrop fixed inset-0 z-[35] lg:hidden"
          aria-label="Close controls"
          onClick={() => setActivePanel(null)}
        />
      )}

      {/* ── Floating bottom controls ─────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col">
        {/* Animated expandable panel */}
        <div
          id="ctrl-panel"
          className="ctrl-panel-grid pointer-events-auto px-0 pb-2 sm:px-4 lg:px-3"
          data-open={String(isPanelOpen)}
          role="region"
          aria-label={activePanel ? `${PANEL_LABELS[activePanel]} controls` : "Controls"}
          aria-live="polite"
        >
          <div className="ctrl-panel-inner">
            <div
              className="ctrl-panel-content ctrl-panel-float ctrl-panel-scroll mx-auto w-full max-w-2xl lg:rounded-[1.25rem]"
              style={{
                maxHeight: isLgUp ? "min(500px, 55vh)" : "min(72dvh, 32rem)",
                overflowY: "auto",
              }}
            >
              <div className="px-4 py-3 sm:px-6 sm:py-4">
                {/* Mobile sheet handle */}
                <div className="mb-3 flex justify-center lg:hidden">
                  <span className="ctrl-sheet-handle" aria-hidden />
                </div>
                {/* Panel header */}
                <div className="mb-3 flex items-center justify-between sm:mb-4">
                  <div className="flex items-center gap-2">
                    {activePanel && (() => {
                      const tab = CONTROL_TABS.find((t) => t.id === activePanel);
                      const Icon = tab?.icon;
                      return (
                        <>
                          {Icon && <Icon className="text-primary size-4" />}
                          <h2 className="text-sm font-semibold">
                            {activePanel ? PANEL_LABELS[activePanel] : ""}
                          </h2>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => setActivePanel(null)}
                    aria-label="Close panel"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Panel content */}
                {activePanel === "upload" && (
                  <div className="space-y-3">
                    <UploadDropzone
                      onFilesSelect={handleFilesSelect}
                      currentCount={images.length}
                    />
                    <ImageStrip
                      images={images}
                      activeId={activeImageId}
                      onSelect={setActiveImageId}
                      onRemove={handleRemoveImage}
                      onClearAll={handleClearAll}
                    />
                  </div>
                )}
                {activePanel === "enhance" && (
                  <AdjustmentControls
                    adjustments={adjustments}
                    effects={effects}
                    upscaleFactor={resize.upscaleFactor}
                    outputWidth={outputDimensions.width}
                    outputHeight={outputDimensions.height}
                    onChange={handleAdjustmentsChange}
                    onEffectsChange={handleEffectsChange}
                    onUpscaleChange={(factor: UpscaleFactor) =>
                      handleResizePartialChange({ upscaleFactor: factor })
                    }
                    disabled={!hasImages}
                  />
                )}
                {activePanel === "resize" && (
                  <>
                    <ResizeControls
                      resize={resize}
                      originalWidth={activeImage?.originalWidth ?? 0}
                      originalHeight={activeImage?.originalHeight ?? 0}
                      onChange={handleResizeChange}
                      disabled={!hasImages}
                    />
                    {images.length > 1 && (
                      <p className="text-muted-foreground mt-3 text-xs sm:text-sm">
                        Resize values apply to all images. Dimensions shown are
                        for the selected preview image.
                      </p>
                    )}
                  </>
                )}
                {activePanel === "background" && (
                  <BackgroundControls
                    background={background}
                    imageCount={images.length}
                    cutoutCount={cutoutCount}
                    isProcessing={isBgProcessing && !portrait.enabled}
                    progress={bgProgress}
                    onBackgroundChange={handleBackgroundChange}
                    onRemoveBackgrounds={handleRemoveBackgrounds}
                    onRestoreOriginals={handleRestoreOriginals}
                    onCancel={handleCancelBackground}
                    disabled={!hasImages || portrait.enabled}
                  />
                )}
                {activePanel === "portrait" && (
                  <PortraitControls
                    portrait={portrait}
                    resize={resize}
                    originalWidth={activeImage?.originalWidth ?? 0}
                    originalHeight={activeImage?.originalHeight ?? 0}
                    isProcessing={portraitActivating}
                    progress={bgProgress}
                    onPortraitChange={handlePortraitChange}
                    onResizeChange={handleResizeChange}
                    onTurnOn={handlePortraitTurnOn}
                    onTurnOff={handlePortraitTurnOff}
                    disabled={!hasImages}
                  />
                )}
                {activePanel === "presets" && (
                  <PresetGrid
                    resize={resize}
                    onSelect={handlePresetSelect}
                    disabled={!hasImages}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-only export row — shown only on < lg */}
        {hasImages && (
          <div className="pointer-events-auto px-3 pb-1.5 sm:px-4 lg:hidden">
            <div className="ctrl-panel-float mx-auto w-full max-w-2xl px-3 py-2.5 sm:px-4">
              <ExportBar
                items={exportItems}
                ops={ops}
                disabled={!hasImages}
                compact
                mobile
              />
            </div>
          </div>
        )}

        {/* Floating toolbar buttons */}
        <div
          role="toolbar"
          aria-label="Image editing controls"
          className="pointer-events-auto px-2 sm:px-4"
          style={{
            paddingTop: "0.25rem",
            paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="ctrl-toolbar-scroll mx-auto flex max-w-2xl items-stretch gap-1 overflow-x-auto px-0.5 sm:gap-1.5 lg:justify-center lg:overflow-visible">
            {CONTROL_TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activePanel === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isActive}
                  aria-controls="ctrl-panel"
                  aria-expanded={isActive}
                  aria-label={label}
                  className={cn(
                    "flex min-h-11 min-w-[3.4rem] shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-2 text-[10px] font-medium leading-none outline-none sm:min-w-0 sm:flex-1 sm:gap-1 sm:px-2 sm:py-2.5 sm:text-[11px]",
                    "transition-all duration-200 ease-out",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    "active:scale-[0.97]",
                    isActive
                      ? "ctrl-tab-active"
                      : "ctrl-tab-float text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
                  )}
                  onClick={() => {
                    if (id === "upload" || hasImages) togglePanel(id);
                  }}
                  disabled={id !== "upload" && !hasImages}
                >
                  <Icon
                    className={cn(
                      "size-[19px] shrink-0 transition-transform duration-200 sm:size-[18px]",
                      isActive ? "scale-110" : "scale-100",
                    )}
                  />
                  <span className="max-w-full truncate px-0.5">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
