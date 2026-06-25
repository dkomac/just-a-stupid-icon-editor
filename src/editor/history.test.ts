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
