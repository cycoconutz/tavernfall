import { expect, test } from "@playwright/test";

test("starts a run and persists after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Tavernfall/);
  await page.getByRole("button", { name: "Start run" }).first().click();
  await expect(page.getByText("HP 30/30")).toBeVisible();
  await page.reload();
  await expect(page.getByText("HP 30/30")).toBeVisible();
});

test("can buy and fight", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start run" }).first().click();
  await page.getByRole("button", { name: /Buy/ }).first().click();
  await expect(page.getByText(/HP/)).toBeVisible();
  await page.getByRole("button", { name: "Fight" }).click();
  await expect(page.getByText(/Last fight/)).toBeVisible();
});
