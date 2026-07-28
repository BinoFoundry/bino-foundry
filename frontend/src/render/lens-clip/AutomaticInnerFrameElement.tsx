import type { LensClipShape } from "@bino-foundry/shared/types";
import type { ResolvedLensClipRender } from "./clip-settings";
import { innerFrameRingPathD } from "./inset-path";

const BLEND_CSS: Record<
  NonNullable<ResolvedLensClipRender["innerFrameBlendMode"]>,
  string | undefined
> = {
  normal: undefined,
  multiply: "multiply",
  overlay: "overlay",
  screen: "screen",
};

/**
 * Automatic Inner Frame — plate-masked inset ring derived from the lens polygon.
 * No manual polygon required; regenerates whenever thickness/settings change.
 */
export function AutomaticInnerFrameElement({
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
  if (!render.innerFrameEnabled) return null;
  const thickness = render.innerFrameThickness;
  if (!(thickness > 0)) return null;

  const ringD = innerFrameRingPathD(lens.pathD, thickness);
  if (!ringD) return null;

  const opacity = Math.max(0, Math.min(1, render.innerFrameOpacity / 100));
  if (opacity <= 1e-4) return null;

  const feather = Math.max(0, Math.min(1, render.innerFrameFeather / 100));
  const blurStd = feather * Math.max(0.35, thickness * 0.55);
  const maskId = `${uid}-inner-frame-${lens.id}`;
  const blurId = `${uid}-inner-frame-blur-${lens.id}`;
  const blend = BLEND_CSS[render.innerFrameBlendMode] ?? undefined;

  return (
    <g data-layer="automatic-inner-frame" clipPath={`url(#${uid}-glass-${lens.id})`}>
      <defs>
        {blurStd > 0.05 ? (
          <filter
            id={blurId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={blurStd} />
          </filter>
        ) : null}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
          <rect x={0} y={0} width={w} height={h} fill="#000" />
          <path
            d={ringD}
            fill="#fff"
            fillRule="evenodd"
            filter={blurStd > 0.05 ? `url(#${blurId})` : undefined}
          />
        </mask>
      </defs>
      <image
        href={plateUrl}
        x={0}
        y={0}
        width={w}
        height={h}
        preserveAspectRatio="none"
        crossOrigin="anonymous"
        mask={`url(#${maskId})`}
        opacity={opacity}
        style={blend ? { mixBlendMode: blend } : undefined}
      />
    </g>
  );
}
