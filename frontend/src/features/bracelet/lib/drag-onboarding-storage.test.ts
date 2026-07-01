import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";

import {
  isBraceletDragOnboardingComplete,
  markBraceletDragOnboardingComplete,
} from "./drag-onboarding-storage";

describe("drag-onboarding-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts incomplete", () => {
    expect(isBraceletDragOnboardingComplete()).toBe(false);
  });

  it("persists completion", () => {
    markBraceletDragOnboardingComplete();
    expect(isBraceletDragOnboardingComplete()).toBe(true);
  });
});

describe("useBraceletDragOnboarding", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the initial hint once then marks complete", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useBraceletDragOnboarding } = await import("../hooks/useBraceletDragOnboarding");

    const { result } = renderHook(() =>
      useBraceletDragOnboarding({ enabled: true, placedCount: 0 }),
    );

    expect(result.current.activeHint).toBeNull();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.activeHint).toBe("initial");
    expect(result.current.hintVisible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(result.current.activeHint).toBeNull();
    expect(result.current.completed).toBe(true);
    expect(isBraceletDragOnboardingComplete()).toBe(true);
  });

  it("marks complete after successful library drop", async () => {
    const { renderHook, act } = await import("@testing-library/react");
    const { useBraceletDragOnboarding } = await import("../hooks/useBraceletDragOnboarding");

    const { result, rerender } = renderHook(
      ({ placedCount }) => useBraceletDragOnboarding({ enabled: true, placedCount }),
      { initialProps: { placedCount: 0 } },
    );

    act(() => {
      result.current.notifyLibraryDropAttempt();
    });

    rerender({ placedCount: 1 });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.completed).toBe(true);
    expect(isBraceletDragOnboardingComplete()).toBe(true);
  });
});
