interface LensRendererProps {
  primaryColor: string;
  secondaryColor: string;
  vlt: number;
  gradientMode: boolean;
}

const LensRenderer = ({ primaryColor, secondaryColor, vlt, gradientMode }: LensRendererProps) => {
  const getLensOpacity = () => {
    return Math.max(0.15, Math.min(0.95, 1 - vlt / 100));
  };

  const getGradientColor = () => {
    if (gradientMode) {
      return `linear-gradient(180deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
    }
    return primaryColor;
  };

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 560"
      style={{ zIndex: 1 }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="lensGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={primaryColor} stopOpacity={getLensOpacity()} />
          <stop offset="100%" stopColor={gradientMode ? secondaryColor : primaryColor} stopOpacity={getLensOpacity()} />
        </linearGradient>

        <radialGradient id="glassHighlightLeft" cx="35%" cy="35%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>

        <radialGradient id="glassHighlightRight" cx="35%" cy="35%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>

        <filter id="lensInsetShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="lensGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g id="lens-left" filter="url(#lensInsetShadow)">
        <ellipse
          cx="310"
          cy="280"
          rx="145"
          ry="125"
          fill="url(#lensGradient)"
        />
        <ellipse
          cx="310"
          cy="280"
          rx="145"
          ry="125"
          fill="url(#glassHighlightLeft)"
        />
        <line
          x1="250"
          y1="230"
          x2="340"
          y2="200"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.6"
        />
        <ellipse
          cx="310"
          cy="280"
          rx="145"
          ry="125"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
        />
      </g>

      <g id="lens-right" filter="url(#lensInsetShadow)">
        <ellipse
          cx="690"
          cy="280"
          rx="145"
          ry="125"
          fill="url(#lensGradient)"
        />
        <ellipse
          cx="690"
          cy="280"
          rx="145"
          ry="125"
          fill="url(#glassHighlightRight)"
        />
        <line
          x1="630"
          y1="230"
          x2="720"
          y2="200"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.6"
        />
        <ellipse
          cx="690"
          cy="280"
          rx="145"
          ry="125"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
};

export default LensRenderer;
