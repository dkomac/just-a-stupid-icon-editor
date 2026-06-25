# Logo Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based logo editor with shapes, layers, colors, masking, precision controls, snapping/alignment, and export to SVG, JPG, PDF, and WebM.

**Architecture:** Use React for the app shell and panels, with an SVG-first document model as the source of truth. Keep editing state, SVG serialization, export generation, and UI components separated so model behavior can be tested without a browser and export/UI behavior can be verified with focused tests and Playwright.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Playwright, lucide-react, jsPDF, browser SVG/canvas APIs, MediaRecorder.

---

## File Structure

- `package.json`: scripts and dependencies for Vite, React, tests, Playwright, icons, and PDF export.
- `index.html`: Vite HTML entry.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`: project build/test configuration.
- `src/main.tsx`: React entry.
- `src/App.tsx`: top-level editor composition.
- `src/styles.css`: global app styling and responsive layout.
- `src/editor/types.ts`: document, layer, geometry, selection, export, and history types.
- `src/editor/document.ts`: document creation, layer mutation, precision updates, masking, alignment, snapping, and layer operations.
- `src/editor/history.ts`: undo/redo state wrapper.
- `src/editor/svg.ts`: SVG serialization, shape path helpers, mask/clip-path output, and SVG blob helpers.
- `src/editor/exporters.ts`: SVG, JPG, PDF, and WebM export helpers.
- `src/editor/sample.ts`: starter document shown on first load.
- `src/components/Toolbar.tsx`: shape and selection tools.
- `src/components/TopBar.tsx`: document commands, undo/redo, zoom, snapping/grid toggles, export button.
- `src/components/CanvasStage.tsx`: SVG artboard, shape rendering, selection handles, drag/resize/rotate interactions, grid, and guides.
- `src/components/LayersPanel.tsx`: reorderable layer list with visibility, lock, duplicate, delete, rename, and mask status.
- `src/components/Inspector.tsx`: precision controls for the selected layer and document settings.
- `src/components/ExportDialog.tsx`: format, dimensions, background, quality/scale options, and download actions.
- `src/components/ui.tsx`: small shared controls such as `IconButton`, `Field`, `NumberField`, `ColorField`, `ToggleButton`, and `SegmentedControl`.
- `src/editor/*.test.ts`: model, SVG, history, and export tests.
- `src/components/*.test.tsx`: UI behavior tests.
- `tests/logo-editor.spec.ts`: Playwright smoke and export flow verification.

---

### Task 1: Scaffold The React App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("opens directly into the logo editor", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Logo Creator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Logo canvas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Layers" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: the command fails because `package.json`, dependencies, and `src/App.tsx` do not exist yet.

- [ ] **Step 3: Add the project scaffold**

Create `package.json`:

```json
{
  "name": "logo-creator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "jspdf": "^3.0.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Logo Creator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Logo Creator</h1>
        <button type="button">Export</button>
      </header>
      <section className="editor-grid">
        <nav className="toolbar" aria-label="Shape tools">
          <button type="button" aria-label="Rectangle">Rect</button>
          <button type="button" aria-label="Ellipse">Oval</button>
          <button type="button" aria-label="Text">Text</button>
        </nav>
        <section className="canvas-wrap" aria-label="Logo canvas">
          <svg role="img" aria-label="Current logo" viewBox="0 0 640 480">
            <rect width="640" height="480" fill="white" />
          </svg>
        </section>
        <aside className="side-panel" aria-label="Layers">
          <h2>Layers</h2>
        </aside>
        <aside className="side-panel" aria-label="Inspector">
          <h2>Inspector</h2>
        </aside>
      </section>
    </main>
  );
}
```

Create `src/styles.css` with the restrained app shell tokens, grid layout, panel styling, focus states, and responsive collapse:

```css
:root {
  color-scheme: light;
  --bg: oklch(0.96 0.006 255);
  --workspace: oklch(0.91 0.01 255);
  --surface: oklch(0.99 0.002 255);
  --ink: oklch(0.18 0.02 255);
  --muted: oklch(0.42 0.025 255);
  --line: oklch(0.82 0.014 255);
  --accent: oklch(0.58 0.18 245);
  --accent-ink: white;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
}

button,
input,
select {
  font: inherit;
}

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 56px 1fr;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.topbar h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0;
}

.editor-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: 64px minmax(360px, 1fr) 240px 280px;
  gap: 1px;
  background: var(--line);
}

.toolbar,
.side-panel,
.canvas-wrap {
  background: var(--surface);
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 8px;
}

.canvas-wrap {
  display: grid;
  place-items: center;
  overflow: auto;
  background: var(--workspace);
  padding: 24px;
}

.canvas-wrap svg {
  width: min(100%, 720px);
  aspect-ratio: 4 / 3;
  background: white;
}

.side-panel {
  padding: 12px;
  overflow: auto;
}

.side-panel h2 {
  margin: 0 0 12px;
  font-size: 13px;
}

@media (max-width: 980px) {
  .editor-grid {
    grid-template-columns: 56px minmax(280px, 1fr);
    grid-template-rows: minmax(420px, 1fr) auto;
  }

  .side-panel {
    min-height: 220px;
  }
}
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.app.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: false,
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
```

- [ ] **Step 4: Run install and verify the smoke test passes**

Run: `npm install`

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.config.ts playwright.config.ts src/test/setup.ts src/main.tsx src/App.tsx src/styles.css src/App.test.tsx
git commit -m "feat: scaffold logo editor app"
```

---

### Task 2: Add The Document Model And History

**Files:**
- Create: `src/editor/types.ts`
- Create: `src/editor/document.ts`
- Create: `src/editor/history.ts`
- Create: `src/editor/document.test.ts`
- Create: `src/editor/history.test.ts`

- [ ] **Step 1: Write failing model tests**

Create `src/editor/document.test.ts` with tests for creating the starter document, adding shapes, precision updates, hide/lock, duplicate, delete, reorder, alignment, snapping, and masking:

```ts
import { describe, expect, it } from "vitest";
import {
  addLayer,
  alignLayers,
  applyMask,
  createDocument,
  deleteLayer,
  duplicateLayer,
  moveLayer,
  releaseMask,
  snapValue,
  toggleLayerLocked,
  toggleLayerVisible,
  updateLayerGeometry,
} from "./document";

describe("document model", () => {
  it("adds editable layers with precise geometry", () => {
    const doc = addLayer(createDocument(), {
      type: "rect",
      name: "Badge",
      x: 80,
      y: 90,
      width: 120,
      height: 80,
      rotation: 0,
      opacity: 1,
      fill: "#2457ff",
      stroke: "#111111",
      strokeWidth: 2,
      cornerRadius: 12,
    });

    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0]).toMatchObject({ name: "Badge", type: "rect", width: 120, fill: "#2457ff" });
  });

  it("updates precise geometry without changing locked layers", () => {
    const doc = addLayer(createDocument(), { type: "ellipse", name: "Orb", x: 10, y: 10, width: 80, height: 80 });
    const locked = toggleLayerLocked(doc, doc.layers[0].id);
    const updated = updateLayerGeometry(locked, doc.layers[0].id, { x: 200 });

    expect(updated.layers[0].x).toBe(10);
    expect(updateLayerGeometry(doc, doc.layers[0].id, { x: 200 }).layers[0].x).toBe(200);
  });

  it("hides, duplicates, deletes, and reorders layers", () => {
    const first = addLayer(createDocument(), { type: "rect", name: "Base", x: 0, y: 0, width: 100, height: 100 });
    const second = addLayer(first, { type: "ellipse", name: "Dot", x: 20, y: 20, width: 40, height: 40 });
    const hidden = toggleLayerVisible(second, second.layers[0].id);
    const duplicated = duplicateLayer(hidden, second.layers[1].id);
    const moved = moveLayer(duplicated, duplicated.layers[2].id, 0);
    const deleted = deleteLayer(moved, moved.layers[1].id);

    expect(hidden.layers[0].visible).toBe(false);
    expect(duplicated.layers[2].name).toBe("Dot copy");
    expect(moved.layers[0].name).toBe("Dot copy");
    expect(deleted.layers.map((layer) => layer.name)).toEqual(["Dot copy", "Dot"]);
  });

  it("aligns layers and snaps values", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "A", x: 13, y: 20, width: 100, height: 50 });
    const withB = addLayer(doc, { type: "rect", name: "B", x: 240, y: 100, width: 80, height: 40 });
    const aligned = alignLayers(withB, [withB.layers[0].id, withB.layers[1].id], "center");

    expect(aligned.layers[0].x + aligned.layers[0].width / 2).toBe(aligned.layers[1].x + aligned.layers[1].width / 2);
    expect(snapValue(13, 8)).toBe(16);
  });

  it("applies and releases masks", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Mask", x: 0, y: 0, width: 100, height: 100 });
    const withTarget = addLayer(doc, { type: "ellipse", name: "Target", x: 20, y: 20, width: 120, height: 120 });
    const masked = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[1].id);
    const released = releaseMask(masked, withTarget.layers[1].id);

    expect(masked.layers[0].maskFor).toContain(withTarget.layers[1].id);
    expect(masked.layers[1].maskedBy).toBe(withTarget.layers[0].id);
    expect(released.layers[1].maskedBy).toBeUndefined();
  });
});
```

Create `src/editor/history.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addLayer, createDocument } from "./document";
import { createHistory, pushHistory, redo, undo } from "./history";

describe("history", () => {
  it("undoes and redoes document changes", () => {
    const initial = createDocument();
    const history = createHistory(initial);
    const next = addLayer(initial, { type: "rect", name: "Block", x: 0, y: 0, width: 100, height: 100 });
    const pushed = pushHistory(history, next);

    expect(pushed.present.layers).toHaveLength(1);
    expect(undo(pushed).present.layers).toHaveLength(0);
    expect(redo(undo(pushed)).present.layers).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/editor/document.test.ts src/editor/history.test.ts`

Expected: FAIL with missing module errors for `./document` and `./history`.

- [ ] **Step 3: Implement types and model functions**

Create `src/editor/types.ts` with discriminated layer types, geometry fields, mask relationship fields, document settings, alignment modes, and export options.

Create `src/editor/document.ts` with pure functions:

```ts
export function createDocument(): LogoDocument;
export function addLayer(document: LogoDocument, input: NewLayerInput): LogoDocument;
export function updateLayerGeometry(document: LogoDocument, layerId: string, patch: Partial<Geometry>): LogoDocument;
export function toggleLayerVisible(document: LogoDocument, layerId: string): LogoDocument;
export function toggleLayerLocked(document: LogoDocument, layerId: string): LogoDocument;
export function duplicateLayer(document: LogoDocument, layerId: string): LogoDocument;
export function deleteLayer(document: LogoDocument, layerId: string): LogoDocument;
export function moveLayer(document: LogoDocument, layerId: string, targetIndex: number): LogoDocument;
export function alignLayers(document: LogoDocument, layerIds: string[], mode: AlignmentMode): LogoDocument;
export function applyMask(document: LogoDocument, maskLayerId: string, targetLayerId: string): LogoDocument;
export function releaseMask(document: LogoDocument, targetLayerId: string): LogoDocument;
export function snapValue(value: number, gridSize: number): number;
```

Rules:

- Layer IDs must be stable strings generated by a local counter or `crypto.randomUUID`.
- Locked layers ignore geometry and style updates.
- Hidden layers remain in the document but are skipped during SVG rendering.
- Deleting a mask layer releases target layers.
- Duplicating a layer copies geometry and style but uses a new ID and appends ` copy` to the name.

Create `src/editor/history.ts` with:

```ts
export function createHistory(initial: LogoDocument): HistoryState;
export function pushHistory(history: HistoryState, next: LogoDocument): HistoryState;
export function undo(history: HistoryState): HistoryState;
export function redo(history: HistoryState): HistoryState;
```

- [ ] **Step 4: Run model tests**

Run: `npm test -- src/editor/document.test.ts src/editor/history.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/types.ts src/editor/document.ts src/editor/history.ts src/editor/document.test.ts src/editor/history.test.ts
git commit -m "feat: add logo document model"
```

---

### Task 3: Serialize Documents To SVG

**Files:**
- Create: `src/editor/svg.ts`
- Create: `src/editor/svg.test.ts`
- Create: `src/editor/sample.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing SVG tests**

Create `src/editor/svg.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addLayer, applyMask, createDocument } from "./document";
import { layerToSvgMarkup, renderDocumentSvg, starPointsToPath } from "./svg";

describe("svg serialization", () => {
  it("serializes visible shapes with transforms and colors", () => {
    const doc = addLayer(createDocument(), {
      type: "rect",
      name: "Block",
      x: 40,
      y: 50,
      width: 120,
      height: 80,
      rotation: 15,
      fill: "#ff3366",
      stroke: "#111111",
      strokeWidth: 4,
      cornerRadius: 10,
    });

    const svg = renderDocumentSvg(doc);

    expect(svg).toContain("<svg");
    expect(svg).toContain('fill="#ff3366"');
    expect(svg).toContain("rotate(15");
    expect(svg).toContain('rx="10"');
  });

  it("skips hidden layers", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Hidden", x: 0, y: 0, width: 100, height: 100, visible: false });

    expect(renderDocumentSvg(doc)).not.toContain("Hidden");
  });

  it("serializes mask relationships as clip paths", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Mask", x: 0, y: 0, width: 100, height: 100 });
    const withTarget = addLayer(doc, { type: "ellipse", name: "Target", x: 20, y: 20, width: 120, height: 120 });
    const masked = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[1].id);

    const svg = renderDocumentSvg(masked);

    expect(svg).toContain("<clipPath");
    expect(svg).toContain("clip-path=");
  });

  it("creates star paths", () => {
    const path = starPointsToPath(100, 100, 50, 24, 5);

    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain("Z");
  });

  it("serializes text layers", () => {
    const markup = layerToSvgMarkup({
      id: "text-1",
      type: "text",
      name: "Wordmark",
      visible: true,
      locked: false,
      x: 20,
      y: 30,
      width: 200,
      height: 60,
      rotation: 0,
      opacity: 1,
      fill: "#111111",
      stroke: "transparent",
      strokeWidth: 0,
      text: "North",
      fontSize: 42,
      fontWeight: 700,
      italic: false,
    });

    expect(markup).toContain("<text");
    expect(markup).toContain("North");
    expect(markup).toContain('font-weight="700"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/editor/svg.test.ts`

Expected: FAIL with missing module errors for `./svg`.

- [ ] **Step 3: Implement SVG serialization**

Create `src/editor/svg.ts`:

```ts
export function renderDocumentSvg(document: LogoDocument, options?: RenderSvgOptions): string;
export function layerToSvgMarkup(layer: LogoLayer, options?: LayerRenderOptions): string;
export function polygonPointsToPath(cx: number, cy: number, radius: number, sides: number): string;
export function starPointsToPath(cx: number, cy: number, outerRadius: number, innerRadius: number, points: number): string;
export function svgToBlob(svg: string): Blob;
```

Implementation requirements:

- Escape text content and layer names.
- Include `viewBox`, `width`, `height`, and `xmlns`.
- Render shapes in layer order.
- Skip hidden layers.
- Use `<clipPath>` for mask layers and apply `clip-path="url(#clip-...)"` to masked targets.
- Keep mask layers visible when not used solely as masks; when used as a mask, render the clip path definition and skip its visible output unless `showMaskLayers` is true.

Create `src/editor/sample.ts` with a starter document containing a rectangle, circle, star, and text layer.

Update `src/App.tsx` to import the sample document and render the serialized SVG inside the canvas region with `dangerouslySetInnerHTML`.

- [ ] **Step 4: Run SVG tests and smoke test**

Run: `npm test -- src/editor/svg.test.ts src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/svg.ts src/editor/svg.test.ts src/editor/sample.ts src/App.tsx
git commit -m "feat: render logo documents as svg"
```

---

### Task 4: Add Export Helpers

**Files:**
- Create: `src/editor/exporters.ts`
- Create: `src/editor/exporters.test.ts`

- [ ] **Step 1: Write failing export tests**

Create `src/editor/exporters.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createDocument } from "./document";
import {
  createPdfBlob,
  createSvgBlob,
  getWebmSupport,
  normalizeExportOptions,
} from "./exporters";

describe("exporters", () => {
  it("normalizes export dimensions and background", () => {
    expect(normalizeExportOptions({ format: "jpg", width: 0, height: -1, background: "transparent" })).toMatchObject({
      format: "jpg",
      width: 1024,
      height: 1024,
      background: "#ffffff",
    });
  });

  it("creates an svg blob from the document", async () => {
    const blob = createSvgBlob(createDocument());

    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toContain("<svg");
  });

  it("reports webm support from MediaRecorder", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });

    expect(getWebmSupport()).toMatchObject({ supported: true, mimeType: "video/webm" });
  });

  it("creates a pdf blob", () => {
    const blob = createPdfBlob(createDocument(), { format: "pdf", width: 512, height: 512, background: "#ffffff", scale: 1 });

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/editor/exporters.test.ts`

Expected: FAIL with missing module errors for `./exporters`.

- [ ] **Step 3: Implement exporters**

Create `src/editor/exporters.ts` with:

```ts
export function normalizeExportOptions(input: Partial<ExportOptions> & { format: ExportFormat }): ExportOptions;
export function createSvgBlob(document: LogoDocument, options?: Partial<ExportOptions>): Blob;
export async function createJpgBlob(document: LogoDocument, options: ExportOptions): Promise<Blob>;
export async function createPdfBlob(document: LogoDocument, options: ExportOptions): Promise<Blob>;
export function getWebmSupport(): { supported: boolean; mimeType: string; reason?: string };
export async function createWebmBlob(document: LogoDocument, options: ExportOptions): Promise<Blob>;
export function downloadBlob(blob: Blob, filename: string): void;
```

Implementation requirements:

- SVG export returns `image/svg+xml`.
- JPG export serializes SVG, draws it into a canvas at requested dimensions, fills a solid background, and returns `image/jpeg`.
- PDF export uses jsPDF with requested dimensions and embeds the rendered SVG by rasterizing it to an image/canvas first.
- WebM export creates a canvas, renders 60 frames over 2 seconds at 30 FPS, captures the stream, records with MediaRecorder, and returns `video/webm`.
- If WebM is unsupported, `getWebmSupport` returns `supported: false` and `createWebmBlob` rejects with a readable error.

- [ ] **Step 4: Run export tests**

Run: `npm test -- src/editor/exporters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor/exporters.ts src/editor/exporters.test.ts
git commit -m "feat: add logo export helpers"
```

---

### Task 5: Build The Editor UI Panels

**Files:**
- Create: `src/components/ui.tsx`
- Create: `src/components/TopBar.tsx`
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/LayersPanel.tsx`
- Create: `src/components/Inspector.tsx`
- Create: `src/components/ExportDialog.tsx`
- Create: `src/components/panels.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing panel tests**

Create `src/components/panels.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addLayer, createDocument } from "../editor/document";
import { Inspector } from "./Inspector";
import { LayersPanel } from "./LayersPanel";
import { Toolbar } from "./Toolbar";

describe("editor panels", () => {
  it("adds shape tools through the toolbar", async () => {
    const onAddLayer = vi.fn();
    render(<Toolbar activeTool="select" onSelectTool={vi.fn()} onAddLayer={onAddLayer} />);

    await userEvent.click(screen.getByRole("button", { name: "Rectangle" }));
    await userEvent.click(screen.getByRole("button", { name: "Star" }));

    expect(onAddLayer).toHaveBeenCalledWith("rect");
    expect(onAddLayer).toHaveBeenCalledWith("star");
  });

  it("shows layer controls", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<LayersPanel document={doc} selectedLayerIds={[doc.layers[0].id]} onSelectLayer={vi.fn()} onChangeDocument={onChange} />);

    expect(screen.getByText("Badge")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hide Badge" }));

    expect(onChange).toHaveBeenCalled();
  });

  it("edits precise layer values in the inspector", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<Inspector document={doc} selectedLayerId={doc.layers[0].id} onChangeDocument={onChange} />);

    const width = screen.getByLabelText("Width");
    await userEvent.clear(width);
    await userEvent.type(width, "160");

    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/panels.test.tsx`

Expected: FAIL with missing component module errors.

- [ ] **Step 3: Implement shared controls and panels**

Implement:

- `Toolbar`: icon buttons for select, rectangle, ellipse, polygon, star, line, text.
- `TopBar`: document name, undo/redo, zoom display, snapping/grid toggles, export button.
- `LayersPanel`: layer rows, selection, rename, visibility, lock, duplicate, delete, move up/down, mask status.
- `Inspector`: document controls when no layer is selected; geometry/style/shape controls when a layer is selected.
- `ExportDialog`: format select, width/height, background, transparent toggle where supported, quality/scale fields, download action.
- `ui.tsx`: accessible reusable fields and icon buttons.

Rules:

- Every icon-only button has an `aria-label` and visible tooltip text through `title`.
- Number fields parse invalid values safely and do not commit `NaN`.
- Hex color fields accept valid `#rgb` and `#rrggbb`, then normalize to `#rrggbb`.
- Locked layers show disabled inspector inputs.

- [ ] **Step 4: Wire panels into `App.tsx`**

Use `useState` for the document, selected layers, active tool, export dialog state, grid, snap, and zoom. Use the history helpers for undo/redo.

- [ ] **Step 5: Run panel and smoke tests**

Run: `npm test -- src/components/panels.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui.tsx src/components/TopBar.tsx src/components/Toolbar.tsx src/components/LayersPanel.tsx src/components/Inspector.tsx src/components/ExportDialog.tsx src/components/panels.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add editor panels and precision controls"
```

---

### Task 6: Add Canvas Interactions, Snapping, And Mask Commands

**Files:**
- Create: `src/components/CanvasStage.tsx`
- Create: `src/components/CanvasStage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing canvas tests**

Create `src/components/CanvasStage.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { addLayer, createDocument } from "../editor/document";
import { CanvasStage } from "./CanvasStage";

describe("CanvasStage", () => {
  it("selects layers from the svg canvas", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const onSelectLayer = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[]} showGrid snapToGrid onSelectLayer={onSelectLayer} onChangeDocument={vi.fn()} />);
    fireEvent.pointerDown(screen.getByTestId(`canvas-layer-${doc.layers[0].id}`), { clientX: 30, clientY: 40, pointerId: 1 });

    expect(onSelectLayer).toHaveBeenCalledWith(doc.layers[0].id);
  });

  it("moves unlocked layers by pointer drag", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const onChangeDocument = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={onChangeDocument} />);
    const layer = screen.getByTestId(`canvas-layer-${doc.layers[0].id}`);
    fireEvent.pointerDown(layer, { clientX: 30, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 48, clientY: 56, pointerId: 1 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(onChangeDocument).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/CanvasStage.test.tsx`

Expected: FAIL with missing `CanvasStage` module.

- [ ] **Step 3: Implement `CanvasStage`**

Implement:

- SVG artboard with optional grid pattern.
- Rendered layer groups with `data-testid="canvas-layer-{id}"`.
- Click/pointer selection.
- Drag to move selected layer.
- Resize handles for width/height.
- Rotation handle updating degrees.
- Selection outline and handles.
- Snap-to-grid by applying `snapValue` to X/Y, width/height, and handle moves.
- Object/canvas center guide lines when moving near centers.

Rules:

- Locked layers can be selected but not moved, resized, or rotated.
- Hidden layers do not render on the canvas.
- Pointer interactions must clean up window listeners on pointer up and component unmount.

- [ ] **Step 4: Add mask commands to panels**

Add buttons for:

- Use selected layer as mask.
- Apply selected mask to selected target.
- Release mask from selected target.

Show mask status in the layer row with text such as `Mask` and `Masked`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/components/CanvasStage.test.tsx src/components/panels.test.tsx src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CanvasStage.tsx src/components/CanvasStage.test.tsx src/components/LayersPanel.tsx src/components/Inspector.tsx src/App.tsx src/styles.css
git commit -m "feat: add canvas editing interactions"
```

---

### Task 7: Connect Export Dialog Downloads

**Files:**
- Modify: `src/components/ExportDialog.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/ExportDialog.test.tsx`

- [ ] **Step 1: Write failing export dialog tests**

Create `src/components/ExportDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createDocument } from "../editor/document";
import { ExportDialog } from "./ExportDialog";

describe("ExportDialog", () => {
  it("exports svg from the dialog", async () => {
    const onClose = vi.fn();
    const onDownload = vi.fn();
    render(<ExportDialog document={createDocument()} onClose={onClose} onDownload={onDownload} />);

    await userEvent.selectOptions(screen.getByLabelText("Format"), "svg");
    await userEvent.click(screen.getByRole("button", { name: "Download SVG" }));

    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ format: "svg" }));
  });

  it("updates export dimensions", async () => {
    const onDownload = vi.fn();
    render(<ExportDialog document={createDocument()} onClose={vi.fn()} onDownload={onDownload} />);

    await userEvent.clear(screen.getByLabelText("Export width"));
    await userEvent.type(screen.getByLabelText("Export width"), "1400");
    await userEvent.click(screen.getByRole("button", { name: /Download/ }));

    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ width: 1400 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ExportDialog.test.tsx`

Expected: FAIL until `ExportDialog` exposes the tested controls and callback behavior.

- [ ] **Step 3: Implement download wiring**

Update `ExportDialog` so it calls `onDownload(normalizeExportOptions(...))`.

Update `App.tsx` with an async `handleDownload` function:

```ts
async function handleDownload(options: ExportOptions) {
  const blob =
    options.format === "svg"
      ? createSvgBlob(document, options)
      : options.format === "jpg"
        ? await createJpgBlob(document, options)
        : options.format === "pdf"
          ? await createPdfBlob(document, options)
          : await createWebmBlob(document, options);

  downloadBlob(blob, `${document.name}.${options.format}`);
}
```

Show a concise export error message in the dialog if an exporter rejects.

- [ ] **Step 4: Run export dialog tests**

Run: `npm test -- src/components/ExportDialog.test.tsx src/editor/exporters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExportDialog.tsx src/components/ExportDialog.test.tsx src/App.tsx
git commit -m "feat: connect logo export downloads"
```

---

### Task 8: Add Responsive Polish And Accessibility States

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/ui.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/LayersPanel.tsx`
- Modify: `src/components/Inspector.tsx`
- Modify: `src/components/CanvasStage.tsx`

- [ ] **Step 1: Add accessibility assertions to existing tests**

Extend `src/App.test.tsx`:

```tsx
it("labels the main editing controls", () => {
  render(<App />);

  expect(screen.getByRole("navigation", { name: "Shape tools" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Logo canvas" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Layers" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails where labels are missing**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL if any required accessible labels are missing.

- [ ] **Step 3: Implement labels, focus states, reduced motion, and responsive layout**

Update CSS and components so:

- All icon buttons have `aria-label` and `title`.
- Focus-visible states are clear.
- Inspector fields have visible labels.
- Panels do not overlap at 1440px, 1024px, 768px, or 390px viewport widths.
- Small viewports stack the layers/inspector panels under the canvas.
- `@media (prefers-reduced-motion: reduce)` disables transitions.
- Text stays within buttons and panel rows.

- [ ] **Step 4: Run unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/components/ui.tsx src/components/TopBar.tsx src/components/Toolbar.tsx src/components/LayersPanel.tsx src/components/Inspector.tsx src/components/CanvasStage.tsx src/App.test.tsx
git commit -m "feat: polish editor accessibility and layout"
```

---

### Task 9: Add Browser Verification

**Files:**
- Create: `tests/logo-editor.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write failing Playwright test**

Create `tests/logo-editor.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("creates a shape and opens export options", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Logo Creator" })).toBeVisible();
  await page.getByRole("button", { name: "Rectangle" }).click();
  await expect(page.getByRole("region", { name: "Layers" })).toContainText("Rectangle");

  await page.getByLabel("Width").fill("180");
  await page.getByLabel("Fill color").fill("#ff3366");
  await page.getByRole("button", { name: "Export" }).click();

  await expect(page.getByRole("dialog", { name: "Export logo" })).toBeVisible();
  await expect(page.getByLabel("Format")).toHaveValue("svg");
});
```

- [ ] **Step 2: Run the test to verify it fails before the dev server wiring is complete**

Run: `npm run e2e -- tests/logo-editor.spec.ts`

Expected: FAIL until Playwright config starts the Vite dev server and the UI behavior is complete.

- [ ] **Step 3: Configure Playwright**

Update `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
```

- [ ] **Step 4: Run browser verification**

Run: `npm run build`

Expected: PASS.

Run: `npm run e2e -- tests/logo-editor.spec.ts`

Expected: PASS in Chromium and mobile projects.

- [ ] **Step 5: Commit**

```bash
git add tests/logo-editor.spec.ts playwright.config.ts
git commit -m "test: verify logo editor in browser"
```

---

### Task 10: Final Verification And Completion Audit

**Files:**
- Modify files only if verification exposes a defect.

- [ ] **Step 1: Run all verification commands**

Run:

```bash
npm test
npm run build
npm run e2e
git status --short
```

Expected:

- Unit tests pass.
- Production build passes.
- Playwright passes on desktop and mobile.
- `git status --short` is clean after the final commit.

- [ ] **Step 2: Manual requirement audit**

Open the running app and confirm:

- Different shapes can be added: rectangle, ellipse, polygon, star, line, text.
- Layers can be selected, renamed, reordered, hidden, locked, duplicated, and deleted.
- Colors can be edited with swatches and hex inputs.
- Masking can be applied and released.
- Precision controls exist for X, Y, width, height, rotation, opacity, colors, stroke width, and shape-specific values.
- Snapping and alignment controls exist.
- SVG export downloads a valid SVG file.
- JPG export downloads a JPG file.
- PDF export downloads a PDF file.
- WebM export downloads a WebM file or shows a clear unsupported-browser message when MediaRecorder is unavailable.

- [ ] **Step 3: Commit fixes if the audit found defects**

If a defect was fixed, run:

```bash
npm test
npm run build
npm run e2e
git add .
git commit -m "fix: complete logo editor verification"
```

- [ ] **Step 4: Report completion evidence**

Final response must include:

- The implemented editor URL if the dev server is running.
- The verification commands that passed.
- Any known browser-specific limitation, especially WebM support.
