import type { LensClipShape } from "@bino-foundry/shared/types";
import type { ResolvedLensClipRender } from "./clip-settings";

/** Blur radius as a fraction of plate width — tuned on the 1920px product plates. */
const BLUR_FRACTION = 26 / 1920;
/** How hard the high pass is amplified before it is blended back. */
const DETAIL_GAIN = 2.6;

/**
 * Lens surface detail taken from the product photograph.
 *
 * The replacement glass is a smooth fill, so a tinted lens loses everything the
 * camera saw through it — the temple arms, the rim shading, the sheen — and
 * reads as flat colour. This puts that back by high-passing the plate: blur it,
 * subtract the blur, and blend only what is left over the tint. Because it
 * keeps the difference from the local average and not the average itself, it is
 * independent of how light or dark that particular lens was photographed, so
 * one strength works for plates shot with dark lenses and with clear ones.
 */
export function LensPhotoDetailElement({
  uid,
  lens,
  plateUrl,
  w,
  h,
  render,
}: {
  uid: string;
  lens: LensClipShape;
  plateUrl: string;
  w: number;
  h: number;
  render: ResolvedLensClipRender;
}) {
  const strength = render.lensDetailStrength;
  if (!(strength > 0.001)) return null;

  const filterId = `${uid}-lens-detail-${lens.id}`;
  const blur = Math.max(1, w * BLUR_FRACTION);

  return (
    <g clipPath={`url(#${uid}-glass-${lens.id})`} data-layer="lens-photo-detail">
      <defs>
        <filter
          id={filterId}
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />
          {/* SourceGraphic - blurred + 0.5 → detail centred on mid grey */}
          <feComposite
            in="SourceGraphic"
            in2="blurred"
            operator="arithmetic"
            k1={0}
            k2={DETAIL_GAIN}
            k3={-DETAIL_GAIN}
            k4={0.5}
            result="highpass"
          />
          {/* Shading only — the plate's own colour must not tint the lens. */}
          <feColorMatrix in="highpass" type="saturate" values="0" />
        </filter>
      </defs>
      <image
        href={plateUrl}
        x={0}
        y={0}
        width={w}
        height={h}
        preserveAspectRatio="none"
        crossOrigin="anonymous"
        filter={`url(#${filterId})`}
        opacity={strength}
        style={{ mixBlendMode: "soft-light" }}
      />
    </g>
  );
}
