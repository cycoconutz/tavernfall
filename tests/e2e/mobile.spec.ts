import { expect, test } from "@playwright/test";

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("hero grid collapses to a single column on narrow screens", async ({ page }) => {
  await page.goto("/");
  const cols = await page
    .locator(".grid")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(cols.trim().split(/\s+/).length).toBe(1);
});

test("core run flow works on touch", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start run" }).first().tap();
  await expect(page.getByText(/HP/)).toBeVisible();
  await page.getByRole("button", { name: /Buy/ }).first().tap();
  await expect(page.getByText("Your board (1/7)")).toBeVisible();
});
