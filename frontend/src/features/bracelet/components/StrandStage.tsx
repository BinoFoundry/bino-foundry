import type { ReactNode } from "react";

interface StrandStageProps {
  children: ReactNode;
  className?: string;
}

/** Layout wrapper for strand canvas (zoom is applied via render size, not CSS scale). */
export function StrandStage({ children, className }: StrandStageProps) {
  return <div className={`flex flex-col items-center ${className ?? ""}`}>{children}</div>;
}
