import { useCallback, useEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 350;
const VISIBLE_MS = 4000;
const FADE_MS = 450;

interface UseBraceletDragOnboardingOptions {
  /** Builder is ready (wrist confirmed, design hydration finished). */
  enabled: boolean;
  placedCount: number;
}

function clearTimer(id: ReturnType<typeof setTimeout> | null) {
  if (id !== null) clearTimeout(id);
}

export function useBraceletDragOnboarding({ enabled, placedCount }: UseBraceletDragOnboardingOptions) {
  const [hintActive, setHintActive] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const showDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideAfterVisibleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeCompleteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPlacedCountRef = useRef(placedCount);
  const primedRef = useRef(false);

  const clearTimers = useCallback(() => {
    clearTimer(showDelayRef.current);
    showDelayRef.current = null;
    clearTimer(hideAfterVisibleRef.current);
    hideAfterVisibleRef.current = null;
    clearTimer(fadeCompleteRef.current);
    fadeCompleteRef.current = null;
  }, []);

  const hideImmediately = useCallback(() => {
    clearTimers();
    setHintVisible(false);
    setHintActive(false);
  }, [clearTimers]);

  const beginShow = useCallback(() => {
    clearTimers();
    showDelayRef.current = setTimeout(() => {
      showDelayRef.current = null;
      setHintActive(true);
      setHintVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHintVisible(true));
      });

      hideAfterVisibleRef.current = setTimeout(() => {
        hideAfterVisibleRef.current = null;
        setHintVisible(false);
        fadeCompleteRef.current = setTimeout(() => {
          fadeCompleteRef.current = null;
          setHintActive(false);
        }, FADE_MS);
      }, VISIBLE_MS);
    }, SHOW_DELAY_MS);
  }, [clearTimers]);

  const dismissHint = useCallback(() => {
    clearTimers();
    setHintVisible(false);
    fadeCompleteRef.current = setTimeout(() => {
      fadeCompleteRef.current = null;
      setHintActive(false);
    }, FADE_MS);
  }, [clearTimers]);

  const replayTips = useCallback(() => {
    hideImmediately();
    beginShow();
  }, [hideImmediately, beginShow]);

  useEffect(() => {
    const prevPlaced = prevPlacedCountRef.current;
    prevPlacedCountRef.current = placedCount;

    if (!enabled) {
      hideImmediately();
      return;
    }

    if (placedCount > 0) {
      hideImmediately();
      primedRef.current = true;
      return;
    }

    const becameEmpty = prevPlaced > 0 && placedCount === 0;
    const initialEmpty = !primedRef.current;

    if (initialEmpty || becameEmpty) {
      primedRef.current = true;
      beginShow();
    }
  }, [enabled, placedCount, hideImmediately, beginShow]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    hintActive,
    hintVisible,
    replayTips,
    dismissHint,
  };
}
