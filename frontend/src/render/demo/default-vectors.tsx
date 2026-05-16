/**
 * Vector paths from the Phase 1 `customizer.html` prototype.
 * Kept isolated so production assets can replace them incrementally.
 */

export const FRONT_FRAME_PATHS = {
  main: "M100,100 Q100,140 140,140 L160,140 Q180,140 190,120 L210,120 Q220,140 240,140 L260,140 Q300,140 300,100",
  bridge: "M190,120 Q200,110 210,120",
  temples: "M40,100 L100,100 M300,100 L360,100",
} as const;

export const FRONT_LENS_PATH =
  "M104,104 Q104,136 140,136 L160,136 Q175,136 185,120 L215,120 Q225,136 240,136 L260,136 Q296,136 296,104 Z";

export const FRONT_SHADOW_PATH =
  "M100,100 Q100,140 140,140 L160,140 Q180,140 190,120 L210,120 Q220,140 240,140 L260,140 Q300,140 300,100";

export const FRONT_HIGHLIGHT_PATHS = [
  "M115,110 Q120,115 140,115",
  "M250,110 Q255,115 275,115",
] as const;

export const SIDE_FRAME_PATHS = {
  profile: "M50,100 L300,100 C320,100 340,110 350,130",
  hinge: { x: 40, y: 80, width: 20, height: 40, rx: 4 },
} as const;
