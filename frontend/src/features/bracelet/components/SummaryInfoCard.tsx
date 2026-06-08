import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SummaryInfoCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function SummaryInfoCard({ title, children, className }: SummaryInfoCardProps) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card/80 px-3 py-2.5", className)}>
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
