"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Columns2,
  Download,
  Eraser,
  ImageIcon,
  Layers,
  Moon,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  Wand2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        <span className="text-foreground/80">
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

export default function HomePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [images, setImages] = useState<EditorImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewUrls | null>(null);
  const [adjustments, setAdjustments] =
    useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);
  const [resize, setResize] = useState<ResizeSettings>(DEFAULT_RESIZE);
  const [background, setBackground] =
    useState<BackgroundSettings>(DEFAULT_BACKGROUND);
  const [portrait, setPortrait] = useState<PortraitSettings>(DEFAULT_PORTRAIT);
  const [effects, setEffects] = useState<EffectsSettings>(DEFAULT_EFFECTS);
  const [bgProgress, setBgProgress] = useState("");
  const [isBgProcessing, setIsBgProcessing] = useState(false);
  const [portraitActivating, setPortraitActivating] = useState(false);

  const imagesRef = useRef(images);
  const bgCancelRef = useRef(false);
  imagesRef.current = images;

  const activeImage = useMemo(
    () => images.find((image) => image.id === activeImageId) ?? null,
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

  const activeImageIndex = useMemo(() => {
    if (!activeImage) return -1;
    return images.findIndex((image) => image.id === activeImage.id);
  }, [activeImage, images]);

  const cutoutCount = useMemo(
    () => images.filter((image) => image.bgStatus === "done").length,
    [images],
  );

  const exportItems = useMemo(
    () =>
      images.map((image) => ({
        file: getExportFile(image),
        originalFile: image.file,
        cutoutFile: image.cutoutFile,
      })),
    [images],
  );

  const showCheckerboard =
    !portrait.enabled &&
    background.type === "transparent" &&
    Boolean(activeImage?.cutoutUrl);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      revokeEditorImages(imagesRef.current);
    };
  }, []);

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
        setPreview(null);
      }

      return next;
    });

    toast.success(
      loaded.length === 1
        ? "1 image added."
        : `${loaded.length} images added.`,
    );
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) revokeEditorImage(removed);

      const next = current.filter((image) => image.id !== id);

      setActiveImageId((currentActiveId) => {
        if (currentActiveId !== id) return currentActiveId;
        return next[0]?.id ?? null;
      });

      if (next.length === 0) {
        setPreview(null);
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setResize(DEFAULT_RESIZE);
        setBackground(DEFAULT_BACKGROUND);
        setPortrait(DEFAULT_PORTRAIT);
        setEffects(DEFAULT_EFFECTS);
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
    toast.success("All images cleared.");
  }, []);

  const handlePresetSelect = useCallback(
    (partial: Partial<ResizeSettings>) => {
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
    [],
  );

  const runBackgroundRemoval = useCallback(async (images: EditorImage[]) => {
    if (images.length === 0) return { successCount: 0, failureCount: 0 };
    const { removeBackground } = await import("@/lib/backgroundRemoval");

    let successCount = 0;
    let failureCount = 0;

    for (let index = 0; index < images.length; index++) {
      if (bgCancelRef.current) break;

      const image = images[index];
      setBgProgress(`Cutting out ${index + 1}/${images.length}...`);

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
  }, []);

  const handleRemoveBackgrounds = useCallback(async () => {
    const currentImages = imagesRef.current;
    if (currentImages.length === 0) return;

    bgCancelRef.current = false;
    setIsBgProcessing(true);
    setBgProgress("Preparing...");

    const { successCount, failureCount } = await runBackgroundRemoval(currentImages);

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

    setPortrait((p) => ({ ...p, enabled: true }));
    setPortraitActivating(false);
    toast.success("Portrait Mode is on.");
  }, [portrait.enabled, portraitActivating, runBackgroundRemoval]);

  const handlePortraitTurnOff = useCallback(() => {
    setPortrait((p) => ({ ...p, enabled: false }));
    toast.success("Portrait Mode turned off.");
  }, []);

  const hasImages = images.length > 0;

  return (
    <>
      <header className="glass-bar sticky top-0 z-30 -mx-3 px-3 py-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="gradient-chip animate-float flex size-9 items-center justify-center rounded-xl">
              <Wand2 className="size-4.5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold tracking-tight sm:text-base">
                Smart Image Studio
              </p>
              <p className="text-muted-foreground hidden text-xs sm:block">
                Enhance · Resize · Cut out · Portrait
              </p>
            </div>
          </div>
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
      </header>

      <main
        className={`mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 md:px-6 ${
          hasImages ? "pb-safe-offset lg:pb-6" : "pb-safe lg:pb-6"
        }`}
      >
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
            Upload up to 15 images, remove backgrounds, apply camera-style
            portrait blur, enhance and resize together, then export — all in your
            browser.
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
        </section>

        <div className="flex flex-col gap-4 lg:gap-6">
          <Card className="animate-fade-up stagger-1">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2.5">
                <span className="gradient-chip flex size-8 items-center justify-center rounded-lg">
                  <Upload className="size-4" />
                </span>
                <CardTitle className="text-base sm:text-lg">Upload</CardTitle>
              </div>
              <CardDescription>
                JPG, JPEG, PNG, or WEBP — up to 15 images
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
          </Card>

          <Card className="animate-fade-up stagger-2">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2.5">
                <span className="gradient-chip flex size-8 items-center justify-center rounded-lg">
                  <SlidersHorizontal className="size-4" />
                </span>
                <CardTitle className="text-base sm:text-lg">Controls</CardTitle>
              </div>
              <CardDescription>
                {hasImages
                  ? "Changes apply to all uploaded images"
                  : "Adjust, resize, remove backgrounds, and apply presets"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="adjust">
                <TabsList className="grid h-auto w-full grid-cols-3 sm:grid-cols-5">
                  <TabsTrigger value="adjust">
                    <Sparkles className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Enhance</span>
                  </TabsTrigger>
                  <TabsTrigger value="resize">
                    <ImageIcon className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Resize</span>
                  </TabsTrigger>
                  <TabsTrigger value="background">
                    <Eraser className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Background</span>
                  </TabsTrigger>
                  <TabsTrigger value="portrait">
                    <Camera className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Portrait</span>
                  </TabsTrigger>
                  <TabsTrigger value="presets">
                    <Layers className="size-3.5" />
                    <span className="hidden min-[400px]:inline">Presets</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="adjust" className="mt-4">
                  <AdjustmentControls
                    adjustments={adjustments}
                    effects={effects}
                    upscaleFactor={resize.upscaleFactor}
                    outputWidth={outputDimensions.width}
                    outputHeight={outputDimensions.height}
                    onChange={setAdjustments}
                    onEffectsChange={setEffects}
                    onUpscaleChange={(factor: UpscaleFactor) =>
                      setResize((current) => ({
                        ...current,
                        upscaleFactor: factor,
                      }))
                    }
                    disabled={!hasImages}
                  />
                </TabsContent>
                <TabsContent value="resize" className="mt-4">
                  <ResizeControls
                    resize={resize}
                    originalWidth={activeImage?.originalWidth ?? 0}
                    originalHeight={activeImage?.originalHeight ?? 0}
                    onChange={setResize}
                    disabled={!hasImages}
                  />
                  {images.length > 1 && (
                    <p className="text-muted-foreground mt-3 text-xs sm:text-sm">
                      Resize values apply to all images. Dimensions shown are
                      for the selected preview image.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="background" className="mt-4">
                  <BackgroundControls
                    background={background}
                    imageCount={images.length}
                    cutoutCount={cutoutCount}
                    isProcessing={isBgProcessing && !portrait.enabled}
                    progress={bgProgress}
                    onBackgroundChange={setBackground}
                    onRemoveBackgrounds={handleRemoveBackgrounds}
                    onRestoreOriginals={handleRestoreOriginals}
                    onCancel={handleCancelBackground}
                    disabled={!hasImages || portrait.enabled}
                  />
                </TabsContent>
                <TabsContent value="portrait" className="mt-4">
                  <PortraitControls
                    portrait={portrait}
                    resize={resize}
                    originalWidth={activeImage?.originalWidth ?? 0}
                    originalHeight={activeImage?.originalHeight ?? 0}
                    isProcessing={portraitActivating}
                    progress={bgProgress}
                    onPortraitChange={setPortrait}
                    onResizeChange={setResize}
                    onTurnOn={handlePortraitTurnOn}
                    onTurnOff={handlePortraitTurnOff}
                    disabled={!hasImages}
                  />
                </TabsContent>
                <TabsContent value="presets" className="mt-4">
                  <PresetGrid
                    resize={resize}
                    onSelect={handlePresetSelect}
                    disabled={!hasImages}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="animate-fade-up stagger-3">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2.5">
                <span className="gradient-chip flex size-8 items-center justify-center rounded-lg">
                  <Columns2 className="size-4" />
                </span>
                <CardTitle className="text-base sm:text-lg">
                  Before & After
                </CardTitle>
              </div>
              <CardDescription>
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
            <CardContent className="space-y-3">
              <BeforeAfter
                baselineUrl={preview?.baseline ?? null}
                processedUrl={preview?.processed ?? null}
                outputWidth={preview?.outputWidth ?? outputDimensions.width}
                outputHeight={preview?.outputHeight ?? outputDimensions.height}
                showCheckerboard={showCheckerboard}
                className="min-h-[40vh] sm:min-h-[50vh]"
              />
              {hasImages && resize.upscaleFactor > 1 && activeImage && (
                <p className="text-muted-foreground text-center text-xs sm:text-sm">
                  Preview is capped for performance. Full {resize.upscaleFactor}x
                  resolution is applied to all {images.length} image
                  {images.length === 1 ? "" : "s"} on download.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="animate-fade-up stagger-4 hidden lg:block">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2.5">
                <span className="gradient-chip flex size-8 items-center justify-center rounded-lg">
                  <Download className="size-4" />
                </span>
                <CardTitle className="text-base sm:text-lg">Export</CardTitle>
              </div>
              <CardDescription>
                {hasImages && images.length > 1
                  ? `Download all ${images.length} processed images as ZIP`
                  : "Download the final processed image"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExportBar
                items={exportItems}
                ops={ops}
                disabled={!hasImages}
              />
            </CardContent>
          </Card>
        </div>
      </main>

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
          onPreviewChange={setPreview}
        />
      )}

      {hasImages && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/70 p-3 pb-safe shadow-[0_-4px_24px_oklch(0_0_0/0.08)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/30 before:to-transparent lg:hidden">
          <ExportBar
            items={exportItems}
            ops={ops}
            disabled={!hasImages}
            compact
          />
        </div>
      )}
    </>
  );
}
