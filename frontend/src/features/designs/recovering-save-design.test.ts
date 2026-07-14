import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/services/api/errors";

import { createRecoveringSaveDesign } from "./recovering-save-design";

describe("createRecoveringSaveDesign", () => {
  it("retries once as create when update returns 404", async () => {
    const onStale = vi.fn();
    const saveDesign = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(404, "Saved design not found"))
      .mockResolvedValueOnce({ id: "dsn_new", productType: "sunglasses" });

    const save = createRecoveringSaveDesign(saveDesign, onStale);
    const result = await save(
      { productType: "sunglasses", sunglasses: { frameId: "f1", lensTintId: "t1", selectedOptions: {} } },
      { designId: "dsn_missing", silent: true },
    );

    expect(onStale).toHaveBeenCalledTimes(1);
    expect(saveDesign).toHaveBeenCalledTimes(2);
    expect(saveDesign.mock.calls[1]?.[1]).toEqual({ silent: true, designId: undefined });
    expect(result?.id).toBe("dsn_new");
  });

  it("rethrows non-404 errors", async () => {
    const saveDesign = vi.fn().mockRejectedValue(new ApiError(500, "Server error"));
    const save = createRecoveringSaveDesign(saveDesign, vi.fn());

    await expect(
      save({ productType: "bracelet" }, { designId: "dsn_1", silent: true }),
    ).rejects.toThrow("Server error");
    expect(saveDesign).toHaveBeenCalledTimes(1);
  });
});
