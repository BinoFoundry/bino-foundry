import React from "react";

interface CustomizableFrameProps {
  imageSrc: string;
  alt: string;
  vlt: number;
  baseColor: string;
  tintColor: string;
  gradientMode: boolean;
  secondaryColor: string;
  maxWidth?: string;
  transform?: string;
  className?: string;
}

export const CustomizableFrame: React.FC<CustomizableFrameProps> = ({
  imageSrc,
  alt,
  vlt,
  tintColor,
  gradientMode,
  secondaryColor,
  maxWidth = "800px",
  transform,
  className = "",
}) => {
  const getLensOpacity = () => {
    return Math.max(0.4, Math.min(0.95, 1 - vlt / 100));
  };

  return (
    <div
      className={`relative ${className}`}
      style={{
        maxWidth,
        width: '100%',
      }}
    >
      <div
        className="relative overflow-hidden w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg"
        style={{
          height: '0',
          paddingBottom: '56%',
        }}
      >
        <img
          src={imageSrc}
          alt={alt}
          className="absolute w-full h-full object-contain"
          style={{
            transform: transform ? `${transform} scale(1.01)` : 'scale(1.01)',
            top: '0',
            left: '0',
            zIndex: 1,
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{
            background: gradientMode
              ? `linear-gradient(180deg, ${tintColor} 0%, ${secondaryColor} 100%)`
              : tintColor,
            opacity: getLensOpacity(),
            mixBlendMode: 'multiply',
            transform,
            zIndex: 2,
          }}
        />
      </div>
    </div>
  );
};
