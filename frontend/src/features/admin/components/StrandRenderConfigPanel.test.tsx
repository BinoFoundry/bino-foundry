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

  it("keeps Render size locked (visible) while Use Parent Calibration is enabled", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward" }}
        inheritTypeDefaults
        onInheritTypeDefaultsChange={vi.fn()}
        customizeRenderSize={false}
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
    expect(screen.getByRole("checkbox", { name: /Customize image size/i })).not.toBeChecked();
  });

  it("keeps Render size locked and shows Image size adjust when Customize is on", () => {
    const onChange = vi.fn();
    const onImageSizeAdjustChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, visualScale: 1 }}
        inheritTypeDefaults
        onInheritTypeDefaultsChange={vi.fn()}
        customizeRenderSize
        onCustomizeRenderSizeChange={vi.fn()}
        imageSizeAdjust={1.1}
        onImageSizeAdjustChange={onImageSizeAdjustChange}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    expect(screen.getByLabelText("Render size")).toBeDisabled();
    expect(screen.getByDisplayValue(/Outward/i)).toBeDisabled();
    expect(screen.getByLabelText("Image size adjust")).not.toBeDisabled();
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
});
