"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Sun, Wand2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { AdjustmentControls } from "@/components/editor/AdjustmentControls";
import { BeforeAfter } from "@/components/editor/BeforeAfter";
import { CanvasPreview } from "@/components/editor/CanvasPreview";
import { ExportBar } from "@/components/editor/ExportBar";
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
  DEFAULT_ADJUSTMENTS,
  DEFAULT_OPS,
  DEFAULT_RESIZE,
  type ImageAdjustments,
  type ImageOps,
  type ResizeSettings,
} from "@/lib/imageOps";

export default function HomePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  const [adjustments, setAdjustments] =
    useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);
  const [resize, setResize] = useState<ResizeSettings>(DEFAULT_RESIZE);

  const ops: ImageOps = useMemo(
    () => ({ adjustments, resize }),
    [adjustments, resize],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  const handleFileSelect = (nextFile: File) => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);

    const url = URL.createObjectURL(nextFile);
    const image = new Image();
    image.src = url;
    image.onload = () => {
      setOriginalWidth(image.naturalWidth);
      setOriginalHeight(image.naturalHeight);
      setResize({
        ...DEFAULT_RESIZE,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    setFile(nextFile);
    setSourceUrl(url);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setProcessedUrl(null);
    toast.success("Image uploaded successfully.");
  };

  const hasImage = Boolean(file && sourceUrl);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-primary flex items-center gap-2 text-sm font-medium">
            <Wand2 className="size-4" />
            Smart Image Studio
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Image Enhancement & Resizing
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Upload an image, enhance quality, resize for social platforms, compare
            results, and download optimized exports.
          </p>
        </div>
        {mounted && (
          <Button
            variant="outline"
            size="icon"
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
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload</CardTitle>
              <CardDescription>JPG, JPEG, PNG, or WEBP</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadDropzone onFileSelect={handleFileSelect} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              <CardDescription>
                Adjust, resize, and apply social presets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="adjust">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="adjust">Enhance</TabsTrigger>
                  <TabsTrigger value="resize">Resize</TabsTrigger>
                  <TabsTrigger value="presets">Presets</TabsTrigger>
                </TabsList>
                <TabsContent value="adjust" className="mt-4">
                  <AdjustmentControls
                    adjustments={adjustments}
                    onChange={setAdjustments}
                    disabled={!hasImage}
                  />
                </TabsContent>
                <TabsContent value="resize" className="mt-4">
                  <ResizeControls
                    resize={resize}
                    originalWidth={originalWidth}
                    originalHeight={originalHeight}
                    onChange={setResize}
                    disabled={!hasImage}
                  />
                </TabsContent>
                <TabsContent value="presets" className="mt-4">
                  <PresetGrid
                    onSelect={(partial) =>
                      setResize((current) => ({ ...current, ...partial }))
                    }
                    disabled={!hasImage}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>Download the final processed image</CardDescription>
            </CardHeader>
            <CardContent>
              <ExportBar file={file} ops={ops} disabled={!hasImage} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {hasImage
                  ? `${originalWidth} × ${originalHeight}px`
                  : "Waiting for upload"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CanvasPreview
                sourceUrl={sourceUrl}
                originalWidth={originalWidth}
                originalHeight={originalHeight}
                adjustments={adjustments}
                resize={resize}
                onProcessedUrlChange={setProcessedUrl}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Before & After</CardTitle>
              <CardDescription>
                Drag the slider to compare original and enhanced versions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BeforeAfter
                originalUrl={sourceUrl}
                processedUrl={processedUrl}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
