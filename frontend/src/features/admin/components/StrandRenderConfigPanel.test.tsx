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

  it("locks Orientation while Use Parent Calibration is enabled", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward" }}
        inheritTypeDefaults
        onInheritTypeDefaultsChange={vi.fn()}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    const select = screen.getByDisplayValue(/Outward/i);
    expect(select).toBeDisabled();
    fireEvent.change(select, { target: { value: "inward" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Controls are locked/i)).toBeInTheDocument();
  });

  it("allows Orientation changes after unlocking parent calibration", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward" }}
        inheritTypeDefaults={false}
        onInheritTypeDefaultsChange={vi.fn()}
        onChange={onChange}
        showLivePreview={false}
      />,
    );

    const select = screen.getByDisplayValue(/Outward/i);
    expect(select).not.toBeDisabled();
    fireEvent.change(select, { target: { value: "inward" } });
    expect(onChange).toHaveBeenCalledWith({ orientationMode: "inward" });
    expect(select).toHaveValue("inward");
  });
});
