import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesignAutoSaveController } from "./design-autosave-controller";

describe("DesignAutoSaveController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("explicit mode tracks dirty state without calling the server", async () => {
    const save = vi.fn().mockResolvedValue({ id: "dsn_1" });
    const onStatus = vi.fn();
    const onDraftChange = vi.fn();
    const controller = new DesignAutoSaveController({
      mode: "explicit",
      debounceMs: 500,
      save,
      onStatus,
      onDraftChange,
      getDesignId: () => null,
    });

    const build = vi.fn(() => ({ productType: "bracelet" as const }));
    controller.schedule("fp-1", "vis-1", build);
    expect(onStatus).toHaveBeenCalledWith("pending");
    expect(onDraftChange).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    expect(controller.hasPendingChanges()).toBe(true);

    const saved = await controller.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(saved).toEqual({ id: "dsn_1" });
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("autosave mode debounces saves and skips unchanged fingerprints", async () => {
    const save = vi.fn().mockResolvedValue({ id: "dsn_1" });
    const onStatus = vi.fn();
    const controller = new DesignAutoSaveController({
      mode: "autosave",
      debounceMs: 500,
      save,
      onStatus,
      getDesignId: () => null,
    });

    const build = vi.fn(() => ({ productType: "bracelet" as const, bracelet: { items: [] } }));

    controller.schedule("fp-1", "vis-1", build);
    expect(onStatus).toHaveBeenCalledWith("pending");

    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);

    controller.schedule("fp-1", "vis-1", build);
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("autosave queues the latest state while a save is in flight", async () => {
    let resolveSave: (value: { id: string }) => void = () => {};
    const save = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const controller = new DesignAutoSaveController({
      mode: "autosave",
      debounceMs: 0,
      save,
      onStatus: vi.fn(),
      getDesignId: () => "dsn_existing",
    });

    controller.schedule("fp-1", "vis-1", () => ({ productType: "bracelet" as const }));
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);

    controller.schedule("fp-2", "vis-2", () => ({ productType: "bracelet" as const }));
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);

    resolveSave({ id: "dsn_existing" });
    await Promise.resolve();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("autosave defers debounced save while an interaction hold is active", async () => {
    const save = vi.fn().mockResolvedValue({ id: "dsn_1" });
    const controller = new DesignAutoSaveController({
      mode: "autosave",
      debounceMs: 500,
      save,
      onStatus: vi.fn(),
      getDesignId: () => null,
    });

    controller.setInteractionHold(true);
    controller.schedule("fp-1", "vis-1", () => ({ productType: "bracelet" as const }));
    await vi.advanceTimersByTimeAsync(500);
    expect(save).not.toHaveBeenCalled();

    controller.setInteractionHold(false);
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not retry immediately after a save failure", async () => {
    const save = vi.fn().mockRejectedValue(new Error("404"));
    const onStatus = vi.fn();
    const controller = new DesignAutoSaveController({
      mode: "autosave",
      debounceMs: 0,
      save,
      onStatus,
      getDesignId: () => "dsn_missing",
    });

    controller.schedule("fp-1", "vis-1", () => ({ productType: "bracelet" as const }));
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith("error");
  });

  it("omits thumbnail when visual fingerprint is unchanged", async () => {
    const save = vi.fn().mockResolvedValue({ id: "dsn_1" });
    const controller = new DesignAutoSaveController({
      mode: "explicit",
      debounceMs: 0,
      save,
      onStatus: vi.fn(),
      getDesignId: () => null,
    });

    const build = vi.fn((ctx) => ({
      productType: "bracelet" as const,
      previewThumbnailDataUrl: ctx.includeThumbnail ? "data:image/png;base64,abc" : undefined,
    }));

    controller.schedule("fp-1", "vis-1", build);
    await controller.flush();
    expect(build).toHaveBeenCalledWith({ includeThumbnail: true });

    build.mockClear();
    controller.setBaseline("fp-1", "vis-1");
    controller.schedule("fp-2", "vis-1", build);
    await controller.flush();
    expect(build).toHaveBeenCalledWith({ includeThumbnail: false });
  });

  it("rethrows API errors from flush so callers can show real messages", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Size 8mm is not enabled for bead rose"));
    const onStatus = vi.fn();
    const controller = new DesignAutoSaveController({
      mode: "explicit",
      debounceMs: 0,
      save,
      onStatus,
      getDesignId: () => null,
    });

    controller.schedule("fp-1", "vis-1", () => ({ productType: "bracelet" as const }));
    await expect(controller.flush()).rejects.toThrow(/not enabled/i);
    expect(onStatus).toHaveBeenCalledWith("error");
  });
});
