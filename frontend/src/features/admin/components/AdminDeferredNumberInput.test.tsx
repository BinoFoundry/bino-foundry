import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AdminDeferredNumberInput } from "./AdminDeferredNumberInput";

describe("AdminDeferredNumberInput", () => {
  it("keeps a newly typed value after blur and commits it", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <AdminDeferredNumberInput
        value={1.1}
        onCommit={onCommit}
        min={0.1}
        max={5}
        clampOnCommit={false}
        aria-label="Layout scale"
      />,
    );

    const input = screen.getByLabelText("Layout scale");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { value: "2" } });
    expect(input).toHaveValue("2");
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(2);
    rerender(
      <AdminDeferredNumberInput
        value={2}
        onCommit={onCommit}
        min={0.1}
        max={5}
        clampOnCommit={false}
        aria-label="Layout scale"
      />,
    );
    expect(input).toHaveValue("2");
  });

  it("does not restore the previous value while the field is emptied during editing", () => {
    render(
      <AdminDeferredNumberInput
        value={1.1}
        onCommit={vi.fn()}
        min={0.1}
        max={5}
        clampOnCommit={false}
        aria-label="Layout scale"
      />,
    );
    const input = screen.getByLabelText("Layout scale");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
  });

  it("keeps out-of-range draft visible when clampOnCommit is false", () => {
    const onCommit = vi.fn();
    const onRangeError = vi.fn();
    render(
      <AdminDeferredNumberInput
        value={1}
        onCommit={onCommit}
        onRangeError={onRangeError}
        min={0.1}
        max={5}
        clampOnCommit={false}
        aria-label="Layout scale"
      />,
    );
    const input = screen.getByLabelText("Layout scale");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onRangeError).toHaveBeenCalled();
    expect(input).toHaveValue("9");
  });
});
