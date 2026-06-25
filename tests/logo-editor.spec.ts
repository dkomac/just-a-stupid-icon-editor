import { expect, test } from "@playwright/test";

test("opens directly into the logo editor shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Logo Creator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rectangle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ellipse" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Text" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Logo canvas" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Layers" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Inspector" })).toBeVisible();
});

test("keeps side panels usable on small screens", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 720 });
  await page.goto("/");

  const layersBox = await page.getByRole("region", { name: "Layers" }).boundingBox();
  const inspectorBox = await page.getByRole("region", { name: "Inspector" }).boundingBox();

  expect(layersBox?.width).toBeGreaterThan(300);
  expect(inspectorBox?.width).toBeGreaterThan(300);
});
