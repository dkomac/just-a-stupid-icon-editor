import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addLayer, applyMask, createDocument } from "../editor/document";
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
    expect(onChangeDocument).not.toHaveBeenCalled();
    expect(layer.querySelector("rect")).toHaveAttribute("x", "40");
    expect(layer.querySelector("rect")).toHaveAttribute("y", "48");

    dispatchPointerEvent(window, "pointerup", {});

    expect(onChangeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ id: doc.layers[0].id, x: 40, y: 48 })],
      }),
    );
    expect(onChangeDocument).toHaveBeenCalledTimes(1);
  });

  it("commits only the final drag document after multiple pointer moves", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const onChangeDocument = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={onChangeDocument} />);
    const layer = screen.getByTestId(`canvas-layer-${doc.layers[0].id}`);
    dispatchPointerEvent(layer, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointerEvent(window, "pointermove", { clientX: 38, clientY: 48 });
    dispatchPointerEvent(window, "pointermove", { clientX: 54, clientY: 64 });
    dispatchPointerEvent(window, "pointerup", {});

    expect(onChangeDocument).toHaveBeenCalledTimes(1);
    expect(onChangeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ id: doc.layers[0].id, x: 48, y: 56 })],
      }),
    );
  });

  it("resizes selected layers and commits the final size on pointer up", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const onChangeDocument = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={onChangeDocument} />);
    dispatchPointerEvent(screen.getByRole("button", { name: "Resize se" }), "pointerdown", { clientX: 140, clientY: 110 });
    dispatchPointerEvent(window, "pointermove", { clientX: 158, clientY: 126 });
    expect(onChangeDocument).not.toHaveBeenCalled();

    dispatchPointerEvent(window, "pointerup", {});

    expect(onChangeDocument).toHaveBeenCalledTimes(1);
    expect(onChangeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ id: doc.layers[0].id, width: 136, height: 96 })],
      }),
    );
  });

  it("does not snap resized layers below the minimum size", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 10, height: 10 });
    const onChangeDocument = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={onChangeDocument} />);
    dispatchPointerEvent(screen.getByRole("button", { name: "Resize se" }), "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointerEvent(window, "pointermove", { clientX: 21, clientY: 31 });
    dispatchPointerEvent(window, "pointerup", {});

    expect(onChangeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ id: doc.layers[0].id, width: 8, height: 8 })],
      }),
    );
  });

  it("rotates selected layers and commits on pointer up", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const onChangeDocument = vi.fn();

    render(<CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={onChangeDocument} />);
    dispatchPointerEvent(screen.getByRole("button", { name: "Rotate layer" }), "pointerdown", { clientX: 80, clientY: -4 });
    dispatchPointerEvent(window, "pointermove", { clientX: 180, clientY: 70 });
    expect(onChangeDocument).not.toHaveBeenCalled();

    dispatchPointerEvent(window, "pointerup", {});

    expect(onChangeDocument).toHaveBeenCalledTimes(1);
    expect(onChangeDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({
        layers: [expect.objectContaining({ id: doc.layers[0].id, rotation: 90 })],
      }),
    );
  });

  it("selects locked layers but does not move them", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const lockedDoc = { ...doc, layers: [{ ...doc.layers[0], locked: true }] };
    const onSelectLayer = vi.fn();
    const onChangeDocument = vi.fn();

    render(<CanvasStage document={lockedDoc} selectedLayerIds={[]} showGrid snapToGrid onSelectLayer={onSelectLayer} onChangeDocument={onChangeDocument} />);
    const layer = screen.getByTestId(`canvas-layer-${doc.layers[0].id}`);
    dispatchPointerEvent(layer, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointerEvent(window, "pointermove", { clientX: 54, clientY: 64 });
    dispatchPointerEvent(window, "pointerup", {});

    expect(onSelectLayer).toHaveBeenCalledWith(doc.layers[0].id);
    expect(onChangeDocument).not.toHaveBeenCalled();
  });

  it("does not render hidden layers on the canvas", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const hiddenDoc = { ...doc, layers: [{ ...doc.layers[0], visible: false }] };

    render(<CanvasStage document={hiddenDoc} selectedLayerIds={[]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={vi.fn()} />);

    expect(screen.queryByTestId(`canvas-layer-${doc.layers[0].id}`)).not.toBeInTheDocument();
  });

  it("does not visibly render layers used as masks", () => {
    const sourceDoc = addLayer(createDocument(), { type: "rect", name: "Mask", x: 20, y: 30, width: 120, height: 80 });
    const targetDoc = addLayer(sourceDoc, { type: "ellipse", name: "Target", x: 40, y: 50, width: 80, height: 80 });
    const doc = applyMask(targetDoc, targetDoc.layers[0].id, targetDoc.layers[1].id);

    render(<CanvasStage document={doc} selectedLayerIds={[]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={vi.fn()} />);

    expect(screen.queryByTestId(`canvas-layer-${doc.layers[0].id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`canvas-layer-${doc.layers[1].id}`)).toBeInTheDocument();
  });

  it("removes window pointer listeners after pointer up and unmount", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 });
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(
      <CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={vi.fn()} />,
    );
    const layer = screen.getByTestId(`canvas-layer-${doc.layers[0].id}`);
    dispatchPointerEvent(layer, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointerEvent(window, "pointerup", {});
    unmount();

    expect(addListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(addListener).toHaveBeenCalledWith("pointerup", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("pointerup", expect.any(Function));

    addListener.mockRestore();
    removeListener.mockRestore();
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

  it("shows guides only when snapped placement remains near the target center", () => {
    const baseDocument = createDocument();
    const sourceDoc = addLayer(
      {
        ...baseDocument,
        settings: { ...baseDocument.settings, gridSize: 16 },
      },
      { type: "rect", name: "Badge", x: 20, y: 30, width: 120, height: 80 },
    );
    const doc = addLayer(sourceDoc, { type: "rect", name: "Target", x: 221, y: 177, width: 80, height: 60 });

    const { container } = render(
      <CanvasStage document={doc} selectedLayerIds={[doc.layers[0].id]} showGrid snapToGrid onSelectLayer={vi.fn()} onChangeDocument={vi.fn()} />,
    );
    const layer = screen.getByTestId(`canvas-layer-${doc.layers[0].id}`);
    dispatchPointerEvent(layer, "pointerdown", { clientX: 30, clientY: 40 });
    dispatchPointerEvent(window, "pointermove", { clientX: 211, clientY: 177 });

    expect(container.querySelectorAll(".canvas-guide")).toHaveLength(0);

    dispatchPointerEvent(window, "pointerup", {});
  });
});
