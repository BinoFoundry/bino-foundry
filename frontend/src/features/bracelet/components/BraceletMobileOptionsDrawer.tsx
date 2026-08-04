import { useState } from "react";
import { Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import type { WristSizeEntry } from "@/types/wrist-sizes";

import { BRACELET_COPY } from "../copy";
import type { BraceletBuilderActionsProps } from "./BraceletBuilderActions";
import { BraceletNameField } from "./BraceletNameField";
import { MatchingPairControls } from "./MatchingPairControls";
import { WristSizeSlider } from "./WristSizeSlider";

interface BraceletMobileOptionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  braceletName: string;
  onBraceletNameChange: (value: string) => void;
  wristSizes: WristSizeEntry[];
  wristSizeIdA: string | null;
  wristSizeIdB?: string | null;
  twinning: boolean;
  braceletBMatched: boolean;
  onSelectWristA: (entry: WristSizeEntry) => void;
  onSelectWristB?: (entry: WristSizeEntry) => void;
  onMeasureWrist: () => void;
  onLoadDesignCode: (code: string) => void;
  builderActions: BraceletBuilderActionsProps;
}

/** Mobile Options bottom sheet — name, wrist, matching pair, load design. */
export function BraceletMobileOptionsDrawer({
  open,
  onOpenChange,
  braceletName,
  onBraceletNameChange,
  wristSizes,
  wristSizeIdA,
  wristSizeIdB,
  twinning,
  braceletBMatched,
  onSelectWristA,
  onSelectWristB,
  onMeasureWrist,
  onLoadDesignCode,
  builderActions,
}: BraceletMobileOptionsDrawerProps) {
  const [designCode, setDesignCode] = useState("");

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[85dvh] gap-0 pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="type-feature text-xl font-normal">
            {BRACELET_COPY.mobileOptionsTitle}
          </DrawerTitle>
          <DrawerDescription>{BRACELET_COPY.mobileOptionsSubtitle}</DrawerDescription>
        </DrawerHeader>

        <div
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-2"
          data-scroll-isolate="true"
        >
          <BraceletNameField
            id="bracelet-name-mobile-options"
            value={braceletName}
            onChange={onBraceletNameChange}
          />

          <div className="space-y-2">
            <WristSizeSlider
              sizes={wristSizes}
              selectedId={wristSizeIdA}
              onSelect={onSelectWristA}
              label={BRACELET_COPY.wristSizeLabel}
            />
            {twinning && onSelectWristB ? (
              <WristSizeSlider
                sizes={wristSizes}
                selectedId={wristSizeIdB ?? null}
                onSelect={onSelectWristB}
                label={BRACELET_COPY.wristTwinB}
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={onMeasureWrist}
            >
              <Ruler className="h-3.5 w-3.5" aria-hidden />
              {BRACELET_COPY.mobileMeasureWrist}
            </Button>
          </div>

          <MatchingPairControls
            twinning={twinning}
            braceletBMatched={braceletBMatched}
            builderActions={builderActions}
            touchFriendly
            className="rounded-xl border border-border/60 bg-muted/20 p-3"
          />

          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {BRACELET_COPY.mobileLoadDesignCode}
            </p>
            <div className="flex gap-2">
              <Input
                value={designCode}
                onChange={(e) => setDesignCode(e.target.value)}
                placeholder={BRACELET_COPY.mobileLoadDesignPlaceholder}
                className="h-10"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-10 shrink-0"
                disabled={!designCode.trim()}
                onClick={() => {
                  onLoadDesignCode(designCode.trim());
                  setDesignCode("");
                }}
              >
                {BRACELET_COPY.mobileLoad}
              </Button>
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button type="button" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
            {BRACELET_COPY.mobileOptionsDone}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
