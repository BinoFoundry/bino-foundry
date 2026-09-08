import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CustomiserStep } from "../constants";
import { useCustomiserFlow } from "./useCustomiserFlow";

describe("useCustomiserFlow", () => {
  it("walks every step when none are hidden", () => {
    const { result } = renderHook(() => useCustomiserFlow());
    expect(result.current.steps.map((s) => s.id)).toEqual([
      "frame",
      "lens",
      "rx",
      "extras",
      "preview",
    ]);
  });

  it("drops a hidden step from the stepper", () => {
    const hidden: CustomiserStep[] = ["extras"];
    const { result } = renderHook(() => useCustomiserFlow("frame", hidden));
    expect(result.current.steps.map((s) => s.id)).toEqual(["frame", "lens", "rx", "preview"]);
  });

  it("steps over a hidden step on Continue", () => {
    const hidden: CustomiserStep[] = ["extras"];
    const { result } = renderHook(() => useCustomiserFlow("rx", hidden));
    act(() => result.current.goNext());
    expect(result.current.step).toBe("preview");
  });

  it("steps over a hidden step on Back", () => {
    const hidden: CustomiserStep[] = ["extras"];
    const { result } = renderHook(() => useCustomiserFlow("preview", hidden));
    act(() => result.current.goBack());
    expect(result.current.step).toBe("rx");
  });

  it("reports the last visible step as last", () => {
    const hidden: CustomiserStep[] = ["extras"];
    const { result } = renderHook(() => useCustomiserFlow("preview", hidden));
    expect(result.current.isLast).toBe(true);
  });

  it("moves off a step that becomes hidden while it is open", () => {
    const { result, rerender } = renderHook(
      ({ hidden }: { hidden: CustomiserStep[] }) => useCustomiserFlow("frame", hidden),
      { initialProps: { hidden: [] as CustomiserStep[] } },
    );
    act(() => result.current.goTo("extras"));
    expect(result.current.step).toBe("extras");
    rerender({ hidden: ["extras"] });
    expect(result.current.step).toBe("preview");
  });
});
