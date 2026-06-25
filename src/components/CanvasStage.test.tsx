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
