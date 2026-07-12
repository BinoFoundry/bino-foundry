import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesignAutoSaveController } from "./design-autosave-controller";

describe("DesignAutoSaveController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces saves and skips unchanged fingerprints", async () => {
    const save = vi.fn().mockResolvedValue({ id: "dsn_1" });
    const onStatus = vi.fn();
    const controller = new DesignAutoSaveController({
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

  it("queues the latest state while a save is in flight", async () => {
    let resolveSave: (value: { id: string }) => void = () => {};
    const save = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const controller = new DesignAutoSaveController({
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

  it("defers debounced save while an interaction hold is active", async () => {
    const save = vi.fn().mockResolvedValue({ id: "dsn_1" });
    const controller = new DesignAutoSaveController({
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

  it("omits thumbnail when visual fingerprint is unchanged", async () => {
    const save = vi.fn().mockResolvedValue({ id: "dsn_1" });
    const controller = new DesignAutoSaveController({
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
    await vi.runAllTimersAsync();
    expect(build).toHaveBeenCalledWith({ includeThumbnail: true });

    build.mockClear();
    controller.setBaseline("fp-1", "vis-1");
    controller.schedule("fp-2", "vis-1", build);
    await vi.runAllTimersAsync();
    expect(build).toHaveBeenCalledWith({ includeThumbnail: false });
  });
});
