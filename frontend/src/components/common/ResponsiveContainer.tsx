import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  /** Constrain builder canvas on large screens */
  maxWidth?: "full" | "builder" | "content";
}

const maxWidthClass = {
  full: "max-w-none",
  builder: "max-w-[1600px]",
  content: "max-w-5xl",
} as const;

export function ResponsiveContainer({
  children,
  className,
  maxWidth = "full",
}: ResponsiveContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", maxWidthClass[maxWidth], className)}>
      {children}
    </div>
  );
}
