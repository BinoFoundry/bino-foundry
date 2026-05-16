import { X } from "lucide-react";

interface SunglassesAccessoriesLibraryProps {
  onSelectLensColor: (lensColor: { id: string; name: string; image: string }) => void;
  onSelectSecondaryColor: (lensColor: { id: string; name: string; image: string }) => void;
  currentLensColorId?: string;
  currentSecondaryColorId?: string;
  gradientMode: boolean;
  availableLensColors?: { id: string; name: string; image: string }[];
  open: boolean;
  onClose: () => void;
}

const SunglassesAccessoriesLibrary = ({
  onSelectLensColor,
  onSelectSecondaryColor,
  currentLensColorId,
  currentSecondaryColorId,
  gradientMode,
  availableLensColors = [],
  open,
  onClose
}: SunglassesAccessoriesLibraryProps) => {

  if (!open) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 glass-panel rounded-lg z-20 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-display text-sm font-semibold">Lens Tint</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {gradientMode ? 'Top Color' : 'Base Material'}
          </h4>
          <div className="space-y-1">
            {availableLensColors.length === 0 && (
              <p className="text-xs text-muted-foreground italic px-3 py-2">No custom colors configured for this frame.</p>
            )}
            {availableLensColors.map((lensColor) => (
              <button
                key={lensColor.id}
                onClick={() => onSelectLensColor(lensColor)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left group ${currentLensColorId === lensColor.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/60'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full border flex-shrink-0 flex items-center justify-center overflow-hidden ${currentLensColorId === lensColor.id ? 'border-primary' : 'border-border/50'} ${!lensColor.image ? 'bg-gradient-to-br from-white to-gray-200' : ''}`}
                >
                  {lensColor.image && (<img 
                    src={lensColor.image} 
                    alt={lensColor.name} 
                    className="w-full h-full object-cover scale-[1.35]" 
                      />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${currentLensColorId === lensColor.id ? 'text-primary' : 'text-foreground'}`}>{lensColor.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {gradientMode && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Bottom Color
            </h4>
            <div className="space-y-1">
              {availableLensColors.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-3 py-2">No custom colors configured for this frame.</p>
              )}
              {availableLensColors.map((lensColor) => (
                <button
                  key={`secondary-${lensColor.id}`}
                  onClick={() => onSelectSecondaryColor(lensColor)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left group ${currentSecondaryColorId === lensColor.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/60'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border flex-shrink-0 flex items-center justify-center overflow-hidden ${currentSecondaryColorId === lensColor.id ? 'border-primary' : 'border-border/50'} ${!lensColor.image ? 'bg-gradient-to-br from-white to-gray-200' : ''}`}
                  >
                    {lensColor.image && (
                      <img 
                        src={lensColor.image} 
                        alt={lensColor.name} 
                        className="w-full h-full object-cover scale-[1.35]" 
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${currentSecondaryColorId === lensColor.id ? 'text-primary' : 'text-foreground'}`}>{lensColor.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SunglassesAccessoriesLibrary;
