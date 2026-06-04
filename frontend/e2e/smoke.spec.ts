import { test, expect } from "@playwright/test";

test.describe("M2 route smoke", () => {
  test("bracelet builder loads", async ({ page }) => {
    await page.goto("/bracelet");
    await expect(page.getByRole("heading", { name: "Bino Foundry" })).toBeVisible();
    await expect(page.getByText(/cm/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("sunglasses customiser loads", async ({ page }) => {
    await page.goto("/sunglasses");
    await expect(page.getByRole("heading", { name: "Bino Foundry" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /choose your frame/i }).or(page.getByText(/loading sunglasses/i)),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("admin dashboard loads", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Bino Foundry" })).toBeVisible();
    await expect(
      page.getByText(/dashboard|frames|bead library/i).first(),
    ).toBeVisible({ timeout: 25_000 });
  });
});
