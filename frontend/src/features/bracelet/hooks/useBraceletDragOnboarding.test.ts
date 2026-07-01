import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useBraceletDragOnboarding } from "./useBraceletDragOnboarding";

describe("useBraceletDragOnboarding", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the hint when the bracelet starts empty", () => {
    const { result } = renderHook(() =>
      useBraceletDragOnboarding({ enabled: true, placedCount: 0 }),
    );

    expect(result.current.hintActive).toBe(false);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.hintActive).toBe(true);
    expect(result.current.hintVisible).toBe(true);
  });

  it("hides immediately when the first bead is placed", () => {
    const { result, rerender } = renderHook(
      ({ placedCount }) => useBraceletDragOnboarding({ enabled: true, placedCount }),
      { initialProps: { placedCount: 0 } },
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    rerender({ placedCount: 1 });

    expect(result.current.hintActive).toBe(false);
    expect(result.current.hintVisible).toBe(false);
  });

  it("shows the hint again when all beads are removed", () => {
    const { result, rerender } = renderHook(
      ({ placedCount }) => useBraceletDragOnboarding({ enabled: true, placedCount }),
      { initialProps: { placedCount: 0 } },
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    rerender({ placedCount: 2 });
    rerender({ placedCount: 0 });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.hintActive).toBe(true);
    expect(result.current.hintVisible).toBe(true);
  });

  it("does not show while disabled", () => {
    const { result, rerender } = renderHook(
      ({ enabled, placedCount }) => useBraceletDragOnboarding({ enabled, placedCount }),
      { initialProps: { enabled: false, placedCount: 0 } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.hintActive).toBe(false);

    rerender({ enabled: true, placedCount: 0 });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.hintActive).toBe(true);
  });

  it("replays tips on demand even with beads on the strand", () => {
    const { result } = renderHook(() =>
      useBraceletDragOnboarding({ enabled: true, placedCount: 3 }),
    );

    act(() => {
      result.current.replayTips();
      vi.advanceTimersByTime(400);
    });

    expect(result.current.hintActive).toBe(true);
    expect(result.current.hintVisible).toBe(true);
  });

  it("dismisses early when the user closes the hint", () => {
    const { result } = renderHook(() =>
      useBraceletDragOnboarding({ enabled: true, placedCount: 0 }),
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.hintVisible).toBe(true);

    act(() => {
      result.current.dismissHint();
    });

    expect(result.current.hintVisible).toBe(false);
    expect(result.current.hintActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(result.current.hintActive).toBe(false);
  });
});
