import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addLayer, createDocument } from "../editor/document";
import type { LogoDocument } from "../editor/types";
import { ExportDialog } from "./ExportDialog";
import { Inspector } from "./Inspector";
import { LayersPanel } from "./LayersPanel";
import { TopBar } from "./TopBar";
import { Toolbar } from "./Toolbar";

afterEach(() => {
  cleanup();
});

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

  it("clears all layers from the layers panel", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();

    render(<LayersPanel document={doc} selectedLayerIds={[doc.layers[0].id]} onSelectLayer={vi.fn()} onChangeDocument={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear all layers" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ layers: [], selectedLayerIds: [] }));
  });

  it("disables clear all layers when the document is empty", () => {
    render(<LayersPanel document={createDocument()} selectedLayerIds={[]} onSelectLayer={vi.fn()} onChangeDocument={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Clear all layers" })).toBeDisabled();
  });

  it("adds layers to the selection with modifier clicks", async () => {
    const first = addLayer(createDocument(), { type: "rect", name: "First", x: 0, y: 0, width: 100, height: 100 });
    const doc = addLayer(first, { type: "ellipse", name: "Second", x: 120, y: 0, width: 80, height: 80 });
    const onSelect = vi.fn();

    render(<LayersPanel document={doc} selectedLayerIds={[doc.layers[0].id]} onSelectLayer={onSelect} onChangeDocument={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select layer Second" }), { shiftKey: true });

    expect(onSelect).toHaveBeenCalledWith(doc.layers[1].id, true);
  });

  it("uses pressed state only for toggle buttons", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });

    render(
      <>
        <TopBar
          documentName="Logo"
          canUndo
          canRedo
          zoom={1}
          showGrid
          snapToGrid
          previewMode={false}
          previewBackground="#ffffff"
          previewBackgrounds={[{ label: "Light", value: "#ffffff" }]}
          onRenameDocument={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onToggleGrid={vi.fn()}
          onToggleSnap={vi.fn()}
          onTogglePreview={vi.fn()}
          onChangePreviewBackground={vi.fn()}
          onOpenExport={vi.fn()}
        />
        <LayersPanel document={doc} selectedLayerIds={[doc.layers[0].id]} onSelectLayer={vi.fn()} onChangeDocument={vi.fn()} />
      </>,
    );

    expect(screen.getByRole("button", { name: "Undo" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Redo" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Hide grid" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Disable snapping" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hide Badge" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Duplicate Badge" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Delete Badge" })).not.toHaveAttribute("aria-pressed");
  });

  it("edits precise layer values in the inspector on blur", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<Inspector document={doc} selectedLayerId={doc.layers[0].id} onChangeDocument={onChange} />);

    const width = screen.getByLabelText("Width");
    await userEvent.clear(width);
    await userEvent.type(width, "160");
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.tab();

    expect(onChange).toHaveBeenCalled();
  });

  it("commits precise number values once when pressing Enter", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<Inspector document={doc} selectedLayerId={doc.layers[0].id} onChangeDocument={onChange} />);

    const width = screen.getByLabelText("Width");
    await userEvent.clear(width);
    await userEvent.type(width, "160");
    await userEvent.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ width: 160 })],
      }),
    );
  });

  it("does not commit invalid numbers", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<Inspector document={doc} selectedLayerId={doc.layers[0].id} onChangeDocument={onChange} />);

    const width = screen.getByLabelText("Width");
    await userEvent.clear(width);
    await userEvent.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(width).toHaveValue(100);
  });

  it("normalizes valid hex colors before committing", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<Inspector document={doc} selectedLayerId={doc.layers[0].id} onChangeDocument={onChange} />);

    const fill = screen.getByLabelText("Fill");
    await userEvent.clear(fill);
    await userEvent.type(fill, "#abc");
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ fill: "#aabbcc" })],
      }),
    );
  });

  it("changes colors from the native color picker", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<Inspector document={doc} selectedLayerId={doc.layers[0].id} onChangeDocument={onChange} />);

    fireEvent.change(screen.getByLabelText("Fill picker"), { target: { value: "#123456" } });

    expect(screen.getByLabelText("Fill")).toHaveValue("#123456");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ fill: "#123456" })],
      }),
    );
  });

  it("disables locked layer inspector inputs", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const lockedDoc: LogoDocument = {
      ...doc,
      layers: [{ ...doc.layers[0], locked: true }],
    };

    render(<Inspector document={lockedDoc} selectedLayerId={lockedDoc.layers[0].id} onChangeDocument={vi.fn()} />);

    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Width")).toBeDisabled();
    expect(screen.getByLabelText("Fill")).toBeDisabled();
  });

  it("aligns multiple selected layers from the inspector", async () => {
    const first = addLayer(createDocument(), { type: "rect", name: "First", x: 10, y: 0, width: 100, height: 100 });
    const doc = addLayer(first, { type: "ellipse", name: "Second", x: 120, y: 0, width: 80, height: 80 });
    const onChange = vi.fn();

    render(<Inspector document={doc} selectedLayerIds={doc.layers.map((layer) => layer.id)} onChangeDocument={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Align left" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: [
          expect.objectContaining({ id: doc.layers[0].id, x: 10 }),
          expect.objectContaining({ id: doc.layers[1].id, x: 10 }),
        ],
      }),
    );
  });

  it("closes the export dialog with Escape and restores focus", async () => {
    const doc = createDocument();
    const user = userEvent.setup();
    const onClose = vi.fn();

    function ExportHarness() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Export launcher
          </button>
          <ExportDialog
            open={open}
            document={doc}
            onClose={() => {
              onClose();
              setOpen(false);
            }}
            onDownload={vi.fn()}
          />
        </>
      );
    }

    render(<ExportHarness />);

    const launcher = screen.getByRole("button", { name: "Export launcher" });
    await user.click(launcher);
    expect(screen.getByRole("button", { name: "Close export dialog" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(launcher).toHaveFocus();
  });

  it("sends normalized export options to the download callback", async () => {
    const doc = createDocument();
    const onDownload = vi.fn();
    render(<ExportDialog open document={doc} onClose={vi.fn()} onDownload={onDownload} />);

    await userEvent.click(screen.getByLabelText("Transparent background"));
    await userEvent.click(screen.getByRole("button", { name: "Download SVG" }));

    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "svg",
        width: 512,
        height: 512,
        background: "transparent",
        transparent: true,
        scale: 1,
      }),
    );
  });
});
