import type { GlassMaterialFilterParams } from "./glass-material-filter";

/**
 * One reusable SVG filter that turns a tinted lens fill into optical glass.
 * Every lens references the same filter id; only the primitive parameters change.
 */
export function GlassMaterialFilterDef({
  id,
  params,
}: {
  id: string;
  params: GlassMaterialFilterParams;
}) {
  const {
    absorptionGain,
    diffusionBlurPx,
    centerDensity,
    edgeDensity,
    edgeSoftnessPx,
    reflection,
  } = params;

  // Darken RGB toward glass body density while preserving alpha for compositing.
  const absorb = 1 - absorptionGain * 0.55;
  const centre = 1 - centerDensity * 0.22;
  const rGain = absorb * centre;
  const gGain = absorb * centre;
  const bGain = absorb * (centre * 0.98);

  const edgeErode = Math.max(0.25, edgeSoftnessPx * 0.35);
  const edgeBlur = Math.max(0.4, edgeSoftnessPx);
  const showReflection = reflection.enabled && reflection.opacity > 1e-4;
  const showDiffusion = diffusionBlurPx > 0.05;
  const showEdge = edgeDensity > 1e-4;

  return (
    <filter
      id={id}
      x="-18%"
      y="-18%"
      width="136%"
      height="136%"
      filterUnits="objectBoundingBox"
      primitiveUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
    >
      {/* Transmission + glass density on the tinted SourceGraphic. */}
      <feColorMatrix
        in="SourceGraphic"
        type="matrix"
        values={`${rGain} 0 0 0 0  0 ${gGain} 0 0 0  0 0 ${bGain} 0 0  0 0 0 1 0`}
        result="densityBody"
      />

      {showDiffusion ? (
        <>
          <feGaussianBlur
            in="densityBody"
            stdDeviation={diffusionBlurPx}
            result="diffused"
          />
          <feBlend in="densityBody" in2="diffused" mode="normal" result="softBody" />
        </>
      ) : (
        <feColorMatrix
          in="densityBody"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
          result="softBody"
        />
      )}

      {/* Edge absorption: soft perimeter ring from alpha, never a stroke. */}
      {showEdge ? (
        <>
          <feMorphology
            in="SourceAlpha"
            operator="erode"
            radius={edgeErode}
            result="innerAlpha"
          />
          <feComposite
            in="SourceAlpha"
            in2="innerAlpha"
            operator="out"
            result="edgeRing"
          />
          <feGaussianBlur
            in="edgeRing"
            stdDeviation={edgeBlur}
            result="softEdge"
          />
          <feColorMatrix
            in="softEdge"
            type="matrix"
            values={`0 0 0 0 0.02  0 0 0 0 0.04  0 0 0 0 0.06  0 0 0 ${edgeDensity * 0.85} 0`}
            result="edgeShade"
          />
          <feBlend in="softBody" in2="edgeShade" mode="multiply" result="edgedBody" />
        </>
      ) : (
        <feColorMatrix
          in="softBody"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
          result="edgedBody"
        />
      )}

      {/* Configurable surface reflection module (specular catch light). */}
      {showReflection ? (
        <>
          <feGaussianBlur
            in="SourceAlpha"
            stdDeviation={Math.max(0.4, reflection.softBlurPx * 0.45)}
            result="specMap"
          />
          <feSpecularLighting
            in="specMap"
            surfaceScale={3.2 * (0.7 + reflection.opacity)}
            specularConstant={reflection.specularConstant}
            specularExponent={reflection.specularExponent}
            lightingColor="#e4eef2"
            result="specLight"
          >
            <fePointLight
              x={reflection.lightX}
              y={reflection.lightY}
              z={reflection.lightZ}
            />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            in2="SourceAlpha"
            operator="in"
            result="specClip"
          />
          <feColorMatrix
            in="specClip"
            type="matrix"
            values={`0 0 0 0 0.88  0 0 0 0 0.92  0 0 0 0 0.95  0 0 0 ${reflection.opacity} 0`}
            result="reflection"
          />
          {reflection.softBlurPx > 0.2 ? (
            <feGaussianBlur
              in="reflection"
              stdDeviation={reflection.softBlurPx}
              result="softReflection"
            />
          ) : (
            <feColorMatrix
              in="reflection"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="softReflection"
            />
          )}
          <feMerge>
            <feMergeNode in="edgedBody" />
            <feMergeNode in="softReflection" />
          </feMerge>
        </>
      ) : (
        <feMerge>
          <feMergeNode in="edgedBody" />
        </feMerge>
      )}
    </filter>
  );
}
