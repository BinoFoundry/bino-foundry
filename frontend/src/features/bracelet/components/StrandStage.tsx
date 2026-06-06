import type { ReactNode } from "react";

interface StrandStageProps {
  children: ReactNode;
  className?: string;
}

/** Layout wrapper for a single strand canvas (view scaling is applied by StrandViewport). */
export function StrandStage({ children, className }: StrandStageProps) {
  return <div className={`flex flex-col items-center ${className ?? ""}`}>{children}</div>;
}
