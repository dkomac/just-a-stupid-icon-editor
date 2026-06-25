import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { addLayer, createDocument } from "../editor/document";
import { CanvasStage } from "./CanvasStage";

function dispatchPointerEvent(target: Document | Element | Window, type: string, options: { clientX?: number; clientY?: number; pointerId?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: options.clientX ?? 0 },
    clientY: { value: options.clientY ?? 0 },
    pointerId: { value: options.pointerId ?? 1 },
  });

  fireEvent(target, event);
}

describe("CanvasStage", () => {
  it("selects layers from the svg canvas", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const onSelectLayer = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[]} showGrid snapToGrid onSelectLayer={onSelectLayer} onChangeDocument={vi.fn()} />);
    dispatchPointerEvent(screen.getByTestId(`canvas-layer-${doc.layers[0].id}`), "pointerdown", { clientX: 30, clientY: 40 });

    expect(onSelectLayer).toHaveBeenCalledWith(doc.layers[0].id);
  });

  it("moves unlocked layers by pointer drag", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const onChangeDocument = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={onChangeDocument} />);
    const layer = screen.getByTestId(`canvas-layer-${doc.layers[0].id}`);
    dispatchPointerEvent(layer, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointerEvent(window, "pointermove", { clientX: 48, clientY: 56 });
    dispatchPointerEvent(window, "pointerup", {});

    expect(onChangeDocument).toHaveBeenCalled();
    expect(onChangeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ id: doc.layers[0].id, x: 40, y: 48 })],
      }),
    );
  });

  it("shows center guides when moving near another visible layer center", () => {
    const sourceDoc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const doc = addLayer(sourceDoc, { type: "rect", name: "Target", x: 220, y: 180, width: 80, height: 60 });
    const onChangeDocument = vi.fn();

    const { container } = render(
      <CanvasStage
        document={doc}
        selectedLayerIds={[doc.layers[0].id]}
        showGrid
        snapToGrid={false}
        onSelectLayer={vi.fn()}
        onChangeDocument={onChangeDocument}
      />,
    );
    const layer = screen.getByTestId(`canvas-layer-${doc.layers[0].id}`);
    dispatchPointerEvent(layer, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointerEvent(window, "pointermove", { clientX: 210, clientY: 180 });

    expect(container.querySelectorAll(".canvas-guide")).toHaveLength(2);

    dispatchPointerEvent(window, "pointerup", {});
  });
});
