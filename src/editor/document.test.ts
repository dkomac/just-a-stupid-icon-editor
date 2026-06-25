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
