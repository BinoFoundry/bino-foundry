import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("locks fields without Customize on bead mode", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward" }}
        customizedFields={[]}
        onFieldCustomizeChange={vi.fn()}
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

  it("unlocks Render size when visualScale is customized", () => {
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, visualScale: 0.75 }}
        customizedFields={["visualScale"]}
        onFieldCustomizeChange={vi.fn()}
        onChange={vi.fn()}
        showLivePreview={false}
      />,
    );

    expect(screen.getByLabelText("Render size")).not.toBeDisabled();
    expect(screen.getByDisplayValue(/Outward/i)).toBeDisabled();
  });

  it("allows Orientation and Render size when both groups are customized", () => {
    const onChange = vi.fn();
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward", visualScale: 1 }}
        customizedFields={["visualScale", "orientationMode"]}
        onFieldCustomizeChange={vi.fn()}
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

  it("shows full inheritance chain for partial modes", () => {
    render(
      <StrandRenderConfigPanel
        mode="subBeadType"
        value={DEFAULT_STRAND_RENDER_PROFILE}
        customizedFields={[]}
        onFieldCustomizeChange={vi.fn()}
        onChange={vi.fn()}
        showLivePreview={false}
      />,
    );

    const note = screen.getByRole("note", { name: /how column inheritance works/i });
    expect(within(note).getByText(/Inheritance order/i)).toBeInTheDocument();
    expect(
      within(note).getByText(/Read left to right/i),
    ).toBeInTheDocument();
    expect(
      within(note).getByText(/the bead type for that column, or system defaults if the bead type did not set it/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Inherited/i).length).toBeGreaterThan(0);
  });

  it("shows bead inheritance chain including sub-type tier", () => {
    render(
      <StrandRenderConfigPanel
        mode="bead"
        value={DEFAULT_STRAND_RENDER_PROFILE}
        customizedFields={[]}
        onFieldCustomizeChange={vi.fn()}
        onChange={vi.fn()}
        showLivePreview={false}
      />,
    );

    const note = screen.getByRole("note", { name: /how column inheritance works/i });
    expect(
      within(note).getByText(/the sub-type, then the bead type, then system defaults — whichever is the nearest level above/i),
    ).toBeInTheDocument();
  });

  it("shows orientation field help", () => {
    render(
      <StrandRenderConfigPanel
        mode="beadType"
        value={{ ...DEFAULT_STRAND_RENDER_PROFILE, orientationMode: "outward" }}
        onChange={vi.fn()}
        showLivePreview={false}
      />,
    );

    expect(screen.getByText(/Which way the asset faces on the bracelet/i)).toBeInTheDocument();
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
