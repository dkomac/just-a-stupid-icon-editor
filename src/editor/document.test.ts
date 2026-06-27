import { describe, expect, it } from "vitest";
import {
  addLayer,
  alignLayers,
  applyMask,
  clearLayers,
  canMergeLayerDown,
  createDocument,
  deleteLayer,
  duplicateLayer,
  mergeLayerDown,
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
    expect(duplicated.layers.map((layer) => layer.name)).toEqual(["Base", "Dot", "Dot - 2"]);
    expect(moved.layers[0].name).toBe("Dot - 2");
    expect(deleted.layers.map((layer) => layer.name)).toEqual(["Dot - 2", "Dot"]);
  });

  it("duplicates layers beside the source with the next numeric suffix", () => {
    const first = addLayer(createDocument(), { type: "rect", name: "Base", x: 0, y: 0, width: 100, height: 100 });
    const second = addLayer(first, { type: "ellipse", name: "Dot", x: 20, y: 20, width: 40, height: 40 });
    const firstDuplicate = duplicateLayer(second, second.layers[0].id);
    const secondDuplicate = duplicateLayer(firstDuplicate, second.layers[0].id);

    expect(firstDuplicate.layers.map((layer) => layer.name)).toEqual(["Base", "Base - 2", "Dot"]);
    expect(firstDuplicate.layers[1]).toMatchObject({ x: 8, y: 8 });
    expect(secondDuplicate.layers.map((layer) => layer.name)).toEqual(["Base", "Base - 3", "Base - 2", "Dot"]);
    expect(secondDuplicate.selectedLayerIds).toEqual([secondDuplicate.layers[1].id]);
  });

  it("merges a layer with the layer below into an editable group", () => {
    const first = addLayer(createDocument(), {
      type: "rect",
      name: "Base",
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      fill: "#ff3366",
      stroke: "#111111",
      strokeWidth: 0,
      cornerRadius: 0,
    });
    const doc = addLayer(first, {
      type: "text",
      name: "Wordmark",
      x: 80,
      y: 60,
      width: 60,
      height: 60,
      fill: "#14213d",
      stroke: "transparent",
      strokeWidth: 0,
      text: "Logo",
      fontFamily: "Georgia",
      fontSize: 24,
      fontWeight: 700,
      rotation: 12,
    });

    expect(canMergeLayerDown(doc, doc.layers[1].id)).toBe(true);

    const merged = mergeLayerDown(doc, doc.layers[1].id);

    expect(merged.layers).toHaveLength(1);
    expect(merged.layers[0]).toMatchObject({
      type: "group",
      name: "Wordmark + Base",
      x: 10,
      y: 20,
      width: 130,
      height: 100,
    });
    expect(merged.layers[0]).toHaveProperty("children", [
      expect.objectContaining({ type: "rect", name: "Base", fill: "#ff3366", x: 0, y: 0 }),
      expect.objectContaining({ type: "text", name: "Wordmark", fill: "#14213d", rotation: 12 }),
    ]);
    expect(merged.selectedLayerIds).toEqual([merged.layers[0].id]);
  });

  it("does not merge layers with mask relationships", () => {
    const first = addLayer(createDocument(), { type: "rect", name: "Base", x: 0, y: 0, width: 100, height: 100, fill: "#111111" });
    const withTarget = addLayer(first, { type: "ellipse", name: "Target", x: 20, y: 20, width: 80, height: 80 });
    const doc = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[1].id);

    expect(canMergeLayerDown(doc, doc.layers[1].id)).toBe(false);
    expect(mergeLayerDown(doc, doc.layers[1].id)).toBe(doc);
  });

  it("clears every layer and selection", () => {
    const first = addLayer(createDocument(), { type: "rect", name: "Base", x: 0, y: 0, width: 100, height: 100 });
    const doc = addLayer(first, { type: "ellipse", name: "Dot", x: 20, y: 20, width: 40, height: 40 });
    const cleared = clearLayers(doc);

    expect(cleared.layers).toEqual([]);
    expect(cleared.selectedLayerIds).toEqual([]);
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

  it("remasks a target by clearing the previous mask relationship", () => {
    const withFirstMask = addLayer(createDocument(), { type: "rect", name: "First mask", x: 0, y: 0, width: 100, height: 100 });
    const withSecondMask = addLayer(withFirstMask, { type: "rect", name: "Second mask", x: 20, y: 20, width: 80, height: 80 });
    const withTarget = addLayer(withSecondMask, { type: "ellipse", name: "Target", x: 10, y: 10, width: 120, height: 120 });
    const firstMasked = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[2].id);
    const remasked = applyMask(firstMasked, withTarget.layers[1].id, withTarget.layers[2].id);

    expect(remasked.layers[0].maskFor ?? []).not.toContain(withTarget.layers[2].id);
    expect(remasked.layers[1].maskFor).toContain(withTarget.layers[2].id);
    expect(remasked.layers[2].maskedBy).toBe(withTarget.layers[1].id);
  });

  it("deleting a mask layer releases its targets", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Mask", x: 0, y: 0, width: 100, height: 100 });
    const withTarget = addLayer(doc, { type: "ellipse", name: "Target", x: 20, y: 20, width: 120, height: 120 });
    const masked = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[1].id);
    const deleted = deleteLayer(masked, withTarget.layers[0].id);

    expect(deleted.layers[0].name).toBe("Target");
    expect(deleted.layers[0].maskedBy).toBeUndefined();
  });

  it("deleting a target clears it from the mask layer", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Mask", x: 0, y: 0, width: 100, height: 100 });
    const withTarget = addLayer(doc, { type: "ellipse", name: "Target", x: 20, y: 20, width: 120, height: 120 });
    const masked = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[1].id);
    const deleted = deleteLayer(masked, withTarget.layers[1].id);

    expect(deleted.layers[0].name).toBe("Mask");
    expect(deleted.layers[0].maskFor).toBeUndefined();
  });
});
