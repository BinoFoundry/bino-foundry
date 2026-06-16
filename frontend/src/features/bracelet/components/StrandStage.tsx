import type { CSSProperties, ReactNode } from "react";

interface StrandStageProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Layout wrapper for a single strand canvas (view scaling is applied by StrandViewport). */
export function StrandStage({ children, className, style }: StrandStageProps) {
  return (
    <div className={`flex flex-col items-center ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}
