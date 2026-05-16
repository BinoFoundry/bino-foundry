import { useEffect, useState } from "react";

/** Tailwind default breakpoints (px). */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

function resolveBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS["2xl"]) return "2xl";
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  return "sm";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    typeof window !== "undefined" ? resolveBreakpoint(window.innerWidth) : "md",
  );

  useEffect(() => {
    const onResize = () => setBp(resolveBreakpoint(window.innerWidth));
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return bp;
}

export function useIsMobile(breakpoint: Breakpoint = "md"): boolean {
  const current = useBreakpoint();
  const order: Breakpoint[] = ["sm", "md", "lg", "xl", "2xl"];
  return order.indexOf(current) < order.indexOf(breakpoint);
}
