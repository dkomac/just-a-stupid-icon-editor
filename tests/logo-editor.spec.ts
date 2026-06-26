import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

test("centers toolbar tools in the rail", async ({ page }) => {
  await page.goto("/");

  const toolbar = page.getByRole("navigation", { name: "Shape tools" });
  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox).toBeTruthy();

  const toolbarCenter = toolbarBox!.x + toolbarBox!.width / 2;
  const toolNames = ["Select", "Rectangle", "Ellipse", "Polygon", "Star", "Line", "Text"];

  for (const toolName of toolNames) {
    const toolBox = await toolbar.getByRole("button", { name: toolName }).boundingBox();
    expect(toolBox).toBeTruthy();
    const toolCenter = toolBox!.x + toolBox!.width / 2;
    expect(Math.abs(toolCenter - toolbarCenter)).toBeLessThanOrEqual(1);
  }
});

test("creates a shape, edits it in the inspector, and exports svg", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Rectangle" }).click();

  const layers = page.getByRole("region", { name: "Layers" });
  await expect(layers.getByRole("article", { name: "Layer Rectangle" })).toBeVisible();
  await expect(layers.getByRole("button", { name: "Select layer Rectangle" })).toHaveAttribute("aria-pressed", "true");

  const inspector = page.getByRole("region", { name: "Inspector" });
  await expect(inspector.getByText("rect")).toBeVisible();

  const width = inspector.getByRole("spinbutton", { name: "Width", exact: true });
  await expect(width).toHaveValue("128");
  await width.fill("160");
  await width.press("Enter");
  await expect(width).toHaveValue("160");

  const fill = inspector.getByLabel("Fill", { exact: true });
  await expect(fill).toHaveValue("#2ec4b6");
  await fill.fill("#abc");
  await fill.press("Enter");
  await expect(fill).toHaveValue("#aabbcc");

  await page.getByRole("button", { name: "Export" }).click();

  const dialog = page.getByRole("dialog", { name: "Export" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Format")).toHaveValue("svg");
  await expect(dialog.getByRole("button", { name: "Download SVG" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download SVG" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toBe("Sample Logo.svg");
  expect(downloadPath).toBeTruthy();

  const svg = await readFile(downloadPath!, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain('aria-label="Sample Logo"');
  expect(svg).toContain('width="160"');
  expect(svg).toContain('fill="#aabbcc"');
});

test("keeps side panels usable on small screens", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 720 });
  await page.goto("/");

  const layersBox = await page.getByRole("region", { name: "Layers" }).boundingBox();
  const inspectorBox = await page.getByRole("region", { name: "Inspector" }).boundingBox();

  expect(layersBox?.width).toBeGreaterThan(300);
  expect(inspectorBox?.width).toBeGreaterThan(300);
});

test("does not horizontally overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const { clientWidth, scrollWidth } = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
