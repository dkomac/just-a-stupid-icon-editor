import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("opens directly into the logo editor shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Logo Creator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rectangle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ellipse" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Triangle" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Half circle" })).toBeVisible();
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
  const toolNames = [
    "Select",
    "Rectangle",
    "Ellipse",
    "Half circle",
    "Triangle",
    "Diamond",
    "Polygon",
    "Star",
    "Heart",
    "Plus",
    "Arrow",
    "Speech bubble",
    "Line",
    "Text",
  ];

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
  await expect(inspector.getByLabel("Stroke", { exact: true })).toHaveValue("#2ec4b6");
  const strokeWidth = inspector.getByRole("slider", { name: "Stroke width" });
  await expect(strokeWidth).toHaveValue("0");
  await strokeWidth.focus();
  for (let i = 0; i < 12; i += 1) {
    await strokeWidth.press("ArrowRight");
  }
  await expect(strokeWidth).toHaveValue("12");
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
  expect(svg).toContain('stroke-width="12"');
});

test("creates triangle layers from the toolbar", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Triangle" }).click();

  const layers = page.getByRole("region", { name: "Layers" });
  await expect(layers.getByRole("article", { name: "Layer Triangle" })).toBeVisible();
  await expect(layers.getByRole("button", { name: "Select layer Triangle" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Inspector" }).getByText("path")).toBeVisible();
});

test("merges a compatible layer with the layer below", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Rectangle" }).click();
  await page.getByRole("button", { name: "Ellipse" }).click();

  const layers = page.getByRole("region", { name: "Layers" });
  await layers.getByRole("button", { name: "Merge Ellipse with layer below" }).click();

  await expect(layers.getByRole("article", { name: "Layer Ellipse + Rectangle" })).toBeVisible();
  await expect(layers.getByRole("button", { name: "Select layer Ellipse + Rectangle" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Inspector" }).getByText("path")).toBeVisible();
});

test("creates additional shapes and changes text fonts", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Half circle" }).click();
  await page.getByRole("button", { name: "Heart" }).click();

  const layers = page.getByRole("region", { name: "Layers" });
  await expect(layers.getByRole("article", { name: "Layer Half circle" })).toBeVisible();
  await expect(layers.getByRole("article", { name: "Layer Heart" })).toBeVisible();

  await page.getByRole("button", { name: "Text" }).click();
  const inspector = page.getByRole("region", { name: "Inspector" });
  await inspector.getByLabel("Font family").selectOption("Georgia");
  await expect(inspector.getByLabel("Font family")).toHaveValue("Georgia");
});

test("shows top layers first and reorders layers with drag and drop", async ({ page }) => {
  await page.goto("/");

  const layerRows = page.getByRole("region", { name: "Layers" }).getByRole("article");
  await expect(layerRows).toHaveCount(4);
  await expect(layerRows.nth(0)).toHaveAccessibleName("Layer Wordmark");
  await expect(layerRows.nth(3)).toHaveAccessibleName("Layer Badge");

  await page.getByRole("article", { name: "Layer Badge" }).dragTo(page.getByRole("article", { name: "Layer Wordmark" }));

  await expect(layerRows.nth(0)).toHaveAccessibleName("Layer Badge");
  await expect(layerRows.nth(1)).toHaveAccessibleName("Layer Wordmark");
});

test("duplicates layers beside the source and scrolls long layer lists", async ({ page }) => {
  await page.setViewportSize({ width: 1227, height: 720 });
  await page.goto("/");

  const layers = page.getByRole("region", { name: "Layers" });
  const layerRows = layers.getByRole("article");

  await layers.getByRole("button", { name: "Duplicate Badge" }).click();
  await expect(layerRows.nth(2)).toHaveAccessibleName("Layer Orb");
  await expect(layerRows.nth(3)).toHaveAccessibleName("Layer Badge - 2");
  await expect(layerRows.nth(4)).toHaveAccessibleName("Layer Badge");

  const toolbar = page.getByRole("navigation", { name: "Shape tools" });
  for (let i = 0; i < 10; i += 1) {
    await toolbar.getByRole("button", { name: "Rectangle", exact: true }).click();
  }

  const scrollState = await page.locator(".layer-list").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: window.getComputedStyle(element).overflowY,
  }));

  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
  expect(scrollState.overflowY).toBe("auto");
});

test("uses preview mode to swap canvas backgrounds", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Preview" }).click();

  await expect(page.getByRole("navigation", { name: "Shape tools" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Layers" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Inspector" })).toBeHidden();
  await expect(page.getByRole("group", { name: "Preview backgrounds" })).toBeVisible();

  await page.getByRole("button", { name: "Dark background" }).click();
  await expect(page.getByTestId("canvas-background")).toHaveAttribute("fill", "#111827");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

  await page.getByRole("button", { name: "Transparent background" }).click();
  await expect(page.getByTestId("canvas-background")).toHaveAttribute("fill", "transparent");

  await page.getByLabel("Custom preview background").fill("#ff3366");
  await expect(page.getByTestId("canvas-background")).toHaveAttribute("fill", "#ff3366");
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
