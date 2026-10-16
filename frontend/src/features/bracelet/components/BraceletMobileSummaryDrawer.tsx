import type { ComponentProps } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { BRACELET_COPY } from "../copy";
import { BraceletSummaryPanel } from "./BraceletSummaryPanel";

interface BraceletMobileSummaryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Same props the desktop right-panel receives. */
  summaryProps: ComponentProps<typeof BraceletSummaryPanel>;
}

/**
 * Mobile review sheet — the full "Your design" summary (cost breakdown, Glam it
 * up, How we prepare, Save/Add) in a bottom drawer, since the desktop right
 * panel isn't rendered on small screens.
 */
export function BraceletMobileSummaryDrawer({
  open,
  onOpenChange,
  summaryProps,
}: BraceletMobileSummaryDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[88dvh] gap-0 pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="type-feature text-xl font-normal">
            {BRACELET_COPY.summaryTitle}
          </DrawerTitle>
          <DrawerDescription>{BRACELET_COPY.mobileReviewSubtitle}</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto" data-scroll-isolate="true">
          <BraceletSummaryPanel {...summaryProps} embedded />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
