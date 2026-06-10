import { test, expect } from "@playwright/test";

test("header switcher navigates to sunglasses", async ({ page }) => {
  await page.goto("http://localhost:8080/bracelet");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /Sunglasses Builder/i }).click({ force: true });
  await expect(page).toHaveURL(/\/sunglasses$/, { timeout: 10_000 });
});

test("sunglasses config steps respond when opened directly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("http://localhost:8080/sunglasses");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: /Select Frame Style/i })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Lens", exact: true }).click({ force: true });
  await expect(page.getByRole("heading", { name: /Lens options/i })).toBeVisible({
    timeout: 5_000,
  });

  await page.getByRole("tab", { name: "Gradient" }).click({ force: true });
  await expect(page.getByRole("tab", { name: "Gradient" })).toHaveAttribute("data-state", "active");

  expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
});
