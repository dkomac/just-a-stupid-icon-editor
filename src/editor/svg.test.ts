import { describe, expect, it } from "vitest";
import { addLayer, applyMask, createDocument, toggleLayerVisible } from "./document";
import type { LogoDocument, LogoLayer } from "./types";
import { layerToSvgMarkup, polygonPointsToPath, renderDocumentSvg, starPointsToPath } from "./svg";

function parserErrorCount(svg: string): number {
  return new DOMParser().parseFromString(svg, "image/svg+xml").querySelectorAll("parsererror").length;
}

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

  it("uses collision-proof clip path ids for distinct mask layer ids", () => {
    const document: LogoDocument = {
      ...createDocument(),
      layers: [
        {
          id: "a b",
          type: "rect",
          name: "First mask",
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          fill: "#111111",
          strokeWidth: 0,
          cornerRadius: 0,
          maskFor: ["target-1"],
        },
        {
          id: "target-1",
          type: "ellipse",
          name: "First target",
          visible: true,
          locked: false,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          fill: "#ff3366",
          strokeWidth: 0,
          maskedBy: "a b",
        },
        {
          id: "a-b",
          type: "rect",
          name: "Second mask",
          visible: true,
          locked: false,
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          fill: "#111111",
          strokeWidth: 0,
          cornerRadius: 0,
          maskFor: ["target-2"],
        },
        {
          id: "target-2",
          type: "ellipse",
          name: "Second target",
          visible: true,
          locked: false,
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          fill: "#3366ff",
          strokeWidth: 0,
          maskedBy: "a-b",
        },
      ],
    };

    const svg = renderDocumentSvg(document);
    const clipIds = Array.from(svg.matchAll(/<clipPath id="([^"]+)"/g), (match) => match[1]);
    const clipRefs = Array.from(svg.matchAll(/clip-path="url\(#([^"]+)\)"/g), (match) => match[1]);

    expect(clipIds).toHaveLength(2);
    expect(new Set(clipIds).size).toBe(2);
    expect(new Set(clipRefs)).toEqual(new Set(clipIds));
  });

  it("omits mask layers from visible output unless requested", () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Mask", x: 0, y: 0, width: 100, height: 100 });
    const withTarget = addLayer(doc, { type: "ellipse", name: "Target", x: 20, y: 20, width: 120, height: 120 });
    const masked = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[1].id);

    const hiddenMaskSvg = renderDocumentSvg(masked);
    const visibleMaskSvg = renderDocumentSvg(masked, { showMaskLayers: true });

    expect(hiddenMaskSvg).not.toContain('data-layer-name="Mask"');
    expect(visibleMaskSvg).toContain('data-layer-name="Mask"');
  });

  it("escapes and validates adversarial document and layer values", () => {
    const hostileLayer: LogoLayer = {
      id: 'id" onload="alert(1)',
      type: "text",
      name: 'Layer"><script>alert(1)</script>',
      visible: true,
      locked: false,
      x: Number.NaN,
      y: Number.POSITIVE_INFINITY,
      width: Number.NEGATIVE_INFINITY,
      height: 60,
      rotation: Number.NaN,
      opacity: Number.POSITIVE_INFINITY,
      fill: 'url(javascript:alert(1))" onload="alert(1)',
      stroke: '#fff" onload="alert(1)',
      strokeWidth: Number.NaN,
      text: 'North <script>alert(1)</script> " onload="alert(1)',
      fontFamily: 'Inter" onload="alert(1)',
      fontSize: Number.NaN,
      fontWeight: Number.POSITIVE_INFINITY,
    };
    const document: LogoDocument = {
      ...createDocument(),
      name: 'Doc"><script>alert(1)</script>',
      settings: {
        ...createDocument().settings,
        width: Number.NaN,
        height: Number.POSITIVE_INFINITY,
        background: '#fff" onload="alert(1)',
      },
      layers: [hostileLayer],
    };

    const svg = renderDocumentSvg(document);

    expect(svg.toLowerCase()).not.toContain("<script");
    expect(svg.toLowerCase()).not.toContain("onload=");
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
    expect(svg).not.toContain('fill="url(javascript:alert(1))');
    expect(svg).not.toContain('stroke="#fff&quot; onload=&quot;alert(1)"');
    expect(svg).not.toContain('font-family="Inter&quot; onload=&quot;alert(1)"');
    expect(parserErrorCount(svg)).toBe(0);
  });

  it("creates star paths", () => {
    const path = starPointsToPath(100, 100, 50, 24, 5);

    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain("Z");
  });

  it("normalizes invalid numeric path helper inputs", () => {
    expect(polygonPointsToPath(Number.NaN, 100, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe("");
    expect(starPointsToPath(100, Number.NaN, Number.POSITIVE_INFINITY, 24, Number.POSITIVE_INFINITY)).toBe("");
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
      fontFamily: "Inter",
      fontSize: 42,
      fontWeight: 700,
    });

    expect(markup).toContain("<text");
    expect(markup).toContain("North");
    expect(markup).toContain('font-weight="700"');
  });
});
