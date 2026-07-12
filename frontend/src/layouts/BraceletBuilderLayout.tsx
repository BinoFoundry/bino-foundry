import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Gem, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BRACELET_COPY } from "@/features/bracelet/copy";
import {
  BEAD_LIBRARY_DRAWER_CLASS,
  beadLibrarySidebarWidthClass,
} from "@/features/bracelet/builder-layout";
import { useLibraryPanelWheelScroll } from "@/features/bracelet/hooks/use-library-panel-wheel-scroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export interface BraceletBuilderLayoutProps {
  leftPanel?: ReactNode;
  /** Replaces the default left sidebar title (e.g. bracelet name input). */
  leftPanelHeader?: ReactNode;
  /** Accessible label for left drawer / collapse controls. */
  leftPanelLabel?: string;
  centerPanel: ReactNode;
  rightPanel?: ReactNode;
  mobileFooter?: ReactNode;
  className?: string;
}

function ScrollPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      data-scroll-isolate="true"
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

/** Left library panel — single vertical scroll for context, search, categories, and beads. */
function LibraryScrollPanel({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useLibraryPanelWheelScroll(scrollRef);

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
      data-scroll-isolate="true"
      data-library-scroll-panel="true"
    >
      {children}
    </div>
  );
}

function SidebarHeader({
  title,
  headerContent,
  side,
  onClose,
}: {
  title?: string;
  headerContent?: ReactNode;
  side: "left" | "right";
  onClose: () => void;
}) {
  const Icon = side === "left" ? PanelLeftClose : PanelRightClose;
  const closeLabel = title ?? "panel";
  return (
    <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        {headerContent ?? (
          <h2 className="type-h3 truncate text-xs text-foreground/90">{title}</h2>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onClose}
        aria-label={`Close ${closeLabel.toLowerCase()}`}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CollapseRail({
  side,
  label,
  onOpen,
}: {
  side: "left" | "right";
  label: string;
  onOpen: () => void;
}) {
  const Icon = side === "left" ? PanelLeft : PanelRight;
  return (
    <div
      className={cn(
        "flex h-full w-11 shrink-0 flex-col items-center border-border/60 bg-background py-3",
        side === "left" ? "border-r" : "border-l",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={onOpen}
        aria-label={label}
        title={label}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EdgeDrawerTrigger({
  side,
  label,
  onOpen,
}: {
  side: "left" | "right";
  label: string;
  onOpen: () => void;
}) {
  const Icon = side === "left" ? Gem : PanelRight;
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className={cn(
        "pointer-events-auto absolute top-1/2 z-40 h-10 w-10 -translate-y-1/2 border border-border/50 bg-background/90 shadow-sm backdrop-blur-sm",
        side === "left" ? "left-0 rounded-l-none rounded-r-lg" : "right-0 rounded-l-lg rounded-r-none",
      )}
      onClick={onOpen}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

/**
 * Bracelet 3-column workspace — canvas-first on tablet/laptop with collapsible sidebars.
 * Mobile: stacked canvas + collapsible footer. Tablet: slide-over drawers. Laptop+: docked panels.
 */
export function BraceletBuilderLayout({
  leftPanel,
  leftPanelHeader,
  leftPanelLabel,
  centerPanel,
  rightPanel,
  mobileFooter,
  className,
}: BraceletBuilderLayoutProps) {
  const isMobile = useIsMobile();
  const isDrawerMode = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isWideDesktop = useMediaQuery("(min-width: 1280px)");

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const syncLayoutForViewport = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setLeftOpen(false);
      setRightOpen(false);
      return;
    }
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setLeftOpen(false);
      setRightOpen(false);
      return;
    }
    setLeftOpen(true);
    setRightOpen(true);
  }, []);

  useEffect(() => {
    syncLayoutForViewport();
    window.addEventListener("resize", syncLayoutForViewport);
    return () => window.removeEventListener("resize", syncLayoutForViewport);
  }, [syncLayoutForViewport]);

  const leftTitle = leftPanelLabel ?? BRACELET_COPY.braceletNameLabel;
  const rightTitle = BRACELET_COPY.summaryTitle;

  const dockedLeftWidth = beadLibrarySidebarWidthClass(isWideDesktop);
  const dockedRightWidth = isWideDesktop ? "w-[min(232px,20vw)]" : "w-[min(200px,22vw)]";

  if (isMobile) {
    return (
      <div className={cn("flex h-full min-h-0 w-full flex-1 flex-col", className)}>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{centerPanel}</section>
        {mobileFooter ? <div className="shrink-0">{mobileFooter}</div> : null}
      </div>
    );
  }

  if (isDrawerMode) {
    return (
      <div className={cn("flex h-full min-h-0 w-full flex-1 flex-col", className)}>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <section className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden">
            {centerPanel}
          </section>

          {leftPanel && !leftOpen ? (
            <EdgeDrawerTrigger
              side="left"
              label={leftTitle}
              onOpen={() => setLeftOpen(true)}
            />
          ) : null}
          {rightPanel && !rightOpen ? (
            <EdgeDrawerTrigger
              side="right"
              label={rightTitle}
              onOpen={() => setRightOpen(true)}
            />
          ) : null}

          {leftPanel ? (
            <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
              <SheetContent
                side="left"
                className={cn(
                  "flex h-full max-h-full flex-col gap-0 overflow-hidden p-0 [&>button.absolute]:hidden",
                  BEAD_LIBRARY_DRAWER_CLASS,
                )}
              >
                <SheetTitle className="sr-only">{leftTitle}</SheetTitle>
                <SidebarHeader
                  headerContent={leftPanelHeader}
                  title={leftPanelHeader ? undefined : leftTitle}
                  side="left"
                  onClose={() => setLeftOpen(false)}
                />
                <LibraryScrollPanel>{leftPanel}</LibraryScrollPanel>
              </SheetContent>
            </Sheet>
          ) : null}

          {rightPanel ? (
            <Sheet open={rightOpen} onOpenChange={setRightOpen}>
              <SheetContent
                side="right"
                className="flex h-full max-h-full w-[min(300px,88vw)] max-w-[320px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[320px] [&>button.absolute]:hidden"
              >
                <SheetTitle className="sr-only">{rightTitle}</SheetTitle>
                <SidebarHeader title={rightTitle} side="right" onClose={() => setRightOpen(false)} />
                <ScrollPanel>{rightPanel}</ScrollPanel>
              </SheetContent>
            </Sheet>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-1", className)}>
      {leftPanel ? (
        <aside
          className={cn(
            "hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-background transition-[width] duration-200 ease-out lg:flex",
            leftOpen ? dockedLeftWidth : "w-11",
          )}
        >
          {leftOpen ? (
            <>
              <SidebarHeader
                headerContent={leftPanelHeader}
                title={leftPanelHeader ? undefined : leftTitle}
                side="left"
                onClose={() => setLeftOpen(false)}
              />
              <LibraryScrollPanel>{leftPanel}</LibraryScrollPanel>
            </>
          ) : (
            <CollapseRail side="left" label={leftTitle} onOpen={() => setLeftOpen(true)} />
          )}
        </aside>
      ) : null}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{centerPanel}</section>

      {rightPanel ? (
        <aside
          className={cn(
            "hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border/60 bg-background transition-[width] duration-200 ease-out lg:flex",
            rightOpen ? dockedRightWidth : "w-11",
          )}
        >
          {rightOpen ? (
            <>
              <SidebarHeader title={rightTitle} side="right" onClose={() => setRightOpen(false)} />
              <ScrollPanel>{rightPanel}</ScrollPanel>
            </>
          ) : (
            <CollapseRail side="right" label={rightTitle} onOpen={() => setRightOpen(true)} />
          )}
        </aside>
      ) : null}
    </div>
  );
}
