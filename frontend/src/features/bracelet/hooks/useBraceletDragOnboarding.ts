import { useCallback, useEffect, useRef, useState } from "react";

import {
  isBraceletDragOnboardingComplete,
  markBraceletDragOnboardingComplete,
} from "../lib/drag-onboarding-storage";

const INITIAL_DELAY_MS = 350;
const INITIAL_VISIBLE_MS = 4000;
const FADE_MS = 450;

export type DragOnboardingHint = "initial" | null;

interface UseBraceletDragOnboardingOptions {
  enabled: boolean;
  placedCount: number;
}

function clearTimer(id: ReturnType<typeof setTimeout> | null) {
  if (id !== null) clearTimeout(id);
}

export function useBraceletDragOnboarding({ enabled, placedCount }: UseBraceletDragOnboardingOptions) {
  const [completed, setCompleted] = useState(() => isBraceletDragOnboardingComplete());
  const [activeHint, setActiveHint] = useState<DragOnboardingHint>(null);
  const [hintVisible, setHintVisible] = useState(false);

  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryDropPendingRef = useRef(false);
  const placedCountRef = useRef(placedCount);
  placedCountRef.current = placedCount;

  const clearAllTimers = useCallback(() => {
    clearTimer(initialTimerRef.current);
    initialTimerRef.current = null;
    clearTimer(fadeTimerRef.current);
    fadeTimerRef.current = null;
  }, []);

  const markComplete = useCallback(() => {
    markBraceletDragOnboardingComplete();
    setCompleted(true);
    clearAllTimers();
    setHintVisible(false);
    setActiveHint(null);
  }, [clearAllTimers]);

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    fadeTimerRef.current = setTimeout(() => {
      setActiveHint(null);
      fadeTimerRef.current = null;
      markComplete();
    }, FADE_MS);
  }, [markComplete]);

  const showHint = useCallback(() => {
    clearTimer(fadeTimerRef.current);
    fadeTimerRef.current = null;
    setActiveHint("initial");
    setHintVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setHintVisible(true));
    });
  }, []);

  const notifyLibraryDropAttempt = useCallback(() => {
    libraryDropPendingRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!libraryDropPendingRef.current) return;
        if (placedCountRef.current > 0) {
          libraryDropPendingRef.current = false;
          markComplete();
        } else {
          libraryDropPendingRef.current = false;
        }
      });
    });
  }, [markComplete]);

  useEffect(() => {
    if (placedCount <= 0) return;

    clearAllTimers();
    setHintVisible(false);
    setActiveHint(null);
    markComplete();
  }, [placedCount, clearAllTimers, markComplete]);

  useEffect(() => {
    if (!enabled || completed || placedCount > 0) {
      clearAllTimers();
      return;
    }

    initialTimerRef.current = setTimeout(() => {
      initialTimerRef.current = null;
      showHint();
      fadeTimerRef.current = setTimeout(() => {
        dismissHint();
        fadeTimerRef.current = null;
      }, INITIAL_VISIBLE_MS);
    }, INITIAL_DELAY_MS);

    return clearAllTimers;
  }, [enabled, completed, placedCount, clearAllTimers, showHint, dismissHint]);

  return {
    activeHint,
    hintVisible,
    completed,
    notifyLibraryDropAttempt,
  };
}
