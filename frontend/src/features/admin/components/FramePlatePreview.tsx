import { useEffect, useState } from "react";

import type { BeadCropConfig } from "@bino-foundry/shared/types";
import { isBeadCropConfigValid } from "@bino-foundry/shared/types";

import { plateCropClipStyles } from "@/render/frame-plate/crop";
import type { MaskConfig } from "@/render/mask";
import { hasAnyLensMask } from "@/render/mask";

import { FrameLensMaskOverlay } from "./FrameLensMaskOverlay";

interface FramePlatePreviewProps {
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  cropConfig?: BeadCropConfig | null;
  committedPlateUrl?: string;
  committedWidth?: number;
  committedHeight?: number;
  mask?: MaskConfig | null;
  maxHeight?: number;
  label: string;
  resolveWorkingPlate?: () => Promise<{ url: string; width: number; height: number }>;
}

/**
 * Plate preview with lens overlays sized to match the image (not object-contain drift).
 */
export function FramePlatePreview({
  originalUrl,
  originalWidth,
  originalHeight,
  cropConfig,
  committedPlateUrl,
  committedWidth,
  committedHeight,
  mask,
  maxHeight = 224,
  label,
  resolveWorkingPlate,
}: FramePlatePreviewProps) {
  const [working, setWorking] = useState<{
    url: string;
    width: number;
    height: number;
    mode: "committed" | "cropped-blob" | "clip" | "full";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (mask && resolveWorkingPlate) {
        const plate = await resolveWorkingPlate();
        if (!cancelled) {
          setWorking({
            url: plate.url,
            width: plate.width,
            height: plate.height,
            mode: "cropped-blob",
          });
        }
        return;
      }

      if (committedPlateUrl && committedWidth && committedHeight) {
        if (!cancelled) {
          setWorking({
            url: committedPlateUrl,
            width: committedWidth,
            height: committedHeight,
            mode: "committed",
          });
        }
        return;
      }

      if (cropConfig && isBeadCropConfigValid(cropConfig)) {
        if (!cancelled) {
          setWorking({
            url: originalUrl,
            width: originalWidth,
            height: originalHeight,
            mode: "clip",
          });
        }
        return;
      }

      if (!cancelled) {
        setWorking({
          url: originalUrl,
          width: originalWidth,
          height: originalHeight,
          mode: "full",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    resolveWorkingPlate,
    committedPlateUrl,
    committedWidth,
    committedHeight,
    originalUrl,
    originalWidth,
    originalHeight,
    cropConfig,
    mask,
  ]);

  if (!working?.url) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        Loading preview…
      </div>
    );
  }

  const aspect = working.width / working.height;
  const displayHeight = Math.min(maxHeight, working.height);
  const displayWidth = displayHeight * aspect;
  const clipStyles =
    working.mode === "clip" && cropConfig ? plateCropClipStyles(cropConfig) : undefined;
  const showMask = mask && hasAnyLensMask(mask);
  const maskW = mask?.imageWidth ?? working.width;
  const maskH = mask?.imageHeight ?? working.height;

  return (
    <div className="mx-auto w-fit max-w-full">
      <div
        className="relative overflow-hidden rounded-lg border border-border bg-muted/20"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <img
          src={working.url}
          alt={label}
          className="block h-full w-full"
          style={{
            objectFit: "fill",
            ...(clipStyles ?? {}),
          }}
          crossOrigin="anonymous"
        />
        {showMask ? (
          <FrameLensMaskOverlay mask={mask} width={maskW} height={maskH} />
        ) : null}
      </div>
      {showMask ? (
        <p className="mt-2 text-center text-[10px] text-status-success">
          Left lens · Right lens overlays active
        </p>
      ) : null}
    </div>
  );
}
