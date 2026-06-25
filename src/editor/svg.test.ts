import { describe, expect, it } from "vitest";
import { addLayer, applyMask, createDocument, toggleLayerVisible } from "./document";
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
    const visibleDoc = addLayer(createDocument(), { type: "rect", name: "Hidden", x: 0, y: 0, width: 100, height: 100 });
    const doc = toggleLayerVisible(visibleDoc, visibleDoc.layers[0].id);

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
