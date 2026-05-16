import { LayerView } from "./LayerView";

interface RasterImageLayerProps {
  zIndex: number;
  src: string;
  alt: string;
  objectFit?: "contain" | "cover";
}

export function RasterImageLayer({
  zIndex,
  src,
  alt,
  objectFit = "contain",
}: RasterImageLayerProps) {
  return (
    <LayerView zIndex={zIndex}>
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full ${objectFit === "cover" ? "object-cover" : "object-contain"}`}
        draggable={false}
      />
    </LayerView>
  );
}
