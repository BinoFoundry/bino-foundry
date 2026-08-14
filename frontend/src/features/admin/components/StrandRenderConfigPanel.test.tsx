import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_STRAND_RENDER_PROFILE } from "@bino-foundry/shared/types";

import { StrandRenderConfigPanel } from "./StrandRenderConfigPanel";

describe("StrandRenderConfigPanel interactivity", () => {
  it("updates Orientation in local draft immediately when editable", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="beadType"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward" }}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    const select = screen.getByDisplayValue(/Outward/i);
    expect(select).toHaveValue("outward");
    fireEvent.change(select, { target: { value: "inward" } });
    expect(onChange).toHaveBeenCalledWith({ orientationMode: "inward" });
    expect(select).toHaveValue("inward");
  });

  it("keeps Render size locked while Parent Calibration is on without customize", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward" }}
        inheritTypeDefaults
        customizeRenderSize={false}
        onInheritTypeDefaultsChange={vi.fn()}
        onCustomizeRenderSizeChange={vi.fn()}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    const select = screen.getByDisplayValue(/Outward/i);
    expect(select).toBeDisabled();
    fireEvent.change(select, { target: { value: "inward" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Render size")).toBeDisabled();
  });

  it("unlocks Render size when Customize render size is on with Parent", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, visualScale: 0.75 }}
        inheritTypeDefaults
        customizeRenderSize
        onInheritTypeDefaultsChange={vi.fn()}
        onCustomizeRenderSizeChange={vi.fn()}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    expect(screen.getByLabelText("Render size")).not.toBeDisabled();
    expect(screen.getByDisplayValue(/Outward/i)).toBeDisabled();
  });

  it("allows Orientation and Render size after unlocking parent calibration", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward", visualScale: 1 }}
        inheritTypeDefaults={false}
        onInheritTypeDefaultsChange={vi.fn()}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    expect(screen.getByLabelText("Render size")).not.toBeDisabled();
    const select = screen.getByDisplayValue(/Outward/i);
    expect(select).not.toBeDisabled();
    fireEvent.change(select, { target: { value: "inward" } });
    expect(onChange).toHaveBeenCalledWith({ orientationMode: "inward" });
    expect(select).toHaveValue("inward");
  });

  it("shows range error for Render size below allowed minimum", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="beadType"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, visualScale: 1 }}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    const input = screen.getByLabelText("Render size");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0.05" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Must be between/i);
    expect(input).toHaveValue("0.05");
  });
});
