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

  it("clears redo when pushing after undo", () => {
    const initial = createDocument();
    const history = createHistory(initial);
    const withBlock = addLayer(initial, { type: "rect", name: "Block", x: 0, y: 0, width: 100, height: 100 });
    const pushed = pushHistory(history, withBlock);
    const undone = undo(pushed);
    const withOrb = addLayer(undone.present, { type: "ellipse", name: "Orb", x: 10, y: 10, width: 40, height: 40 });
    const branched = pushHistory(undone, withOrb);

    expect(branched.future).toHaveLength(0);
    expect(redo(branched).present.layers.map((layer) => layer.name)).toEqual(["Orb"]);
  });
});
