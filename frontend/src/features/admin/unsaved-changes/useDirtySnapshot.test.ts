import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useDirtySnapshot } from "./useDirtySnapshot";

describe("useDirtySnapshot", () => {
  it("starts clean for the initial value", () => {
    const { result } = renderHook(({ value, key }) => useDirtySnapshot(value, key), {
      initialProps: { value: { name: "A" }, key: "1" },
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("becomes dirty after a real change", () => {
    const { result, rerender } = renderHook(({ value, key }) => useDirtySnapshot(value, key), {
      initialProps: { value: { name: "A" }, key: "1" },
    });
    rerender({ value: { name: "B" }, key: "1" });
    expect(result.current.isDirty).toBe(true);
  });

  it("resets clean when the baseline key changes", () => {
    const { result, rerender } = renderHook(({ value, key }) => useDirtySnapshot(value, key), {
      initialProps: { value: { name: "A" }, key: "1" },
    });
    rerender({ value: { name: "B" }, key: "1" });
    expect(result.current.isDirty).toBe(true);
    rerender({ value: { name: "B" }, key: "2" });
    expect(result.current.isDirty).toBe(false);
  });

  it("markClean adopts the current value", () => {
    const { result, rerender } = renderHook(({ value, key }) => useDirtySnapshot(value, key), {
      initialProps: { value: { name: "A" }, key: "1" },
    });
    rerender({ value: { name: "B" }, key: "1" });
    act(() => {
      result.current.markClean();
    });
    expect(result.current.isDirty).toBe(false);
  });
});
