"use client";

import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";

export function ResponsiveToaster() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <Toaster
      richColors
      position={isMobile ? "bottom-center" : "top-right"}
      offset={isMobile ? 80 : 16}
      toastOptions={{
        classNames: {
          toast: "max-w-[calc(100vw-2rem)]",
        },
      }}
    />
  );
}
