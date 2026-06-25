import type { LogoDocument, LogoLayer, TextLayer } from "./types";

export interface RenderSvgOptions {
  showMaskLayers?: boolean;
}

export interface LayerRenderOptions {
  clipPathId?: string;
  forceVisible?: boolean;
  forClipPath?: boolean;
}

type SerializableTextLayer = Omit<TextLayer, "fontFamily"> & {
  fontFamily?: string;
  italic?: boolean;
};

type SerializableLogoLayer = LogoLayer | SerializableTextLayer;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function point(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function clipPathIdFor(layerId: string): string {
  return `clip-${layerId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function shapeTransform(layer: SerializableLogoLayer): string {
  if (layer.rotation === 0) {
    return "";
  }

  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  return ` transform="rotate(${point(layer.rotation)} ${point(cx)} ${point(cy)})"`;
}

function paintAttributes(layer: SerializableLogoLayer): string {
  const stroke = layer.stroke ?? "none";

  return [
    `fill="${escapeAttribute(layer.fill)}"`,
    `stroke="${escapeAttribute(stroke)}"`,
    `stroke-width="${escapeAttribute(layer.strokeWidth)}"`,
  ].join(" ");
}

function layerShapeMarkup(layer: SerializableLogoLayer, forClipPath = false): string {
  const paint = forClipPath ? 'fill="black" stroke="none" stroke-width="0"' : paintAttributes(layer);
  const transform = shapeTransform(layer);

  if (layer.type === "rect") {
    const radius = Math.max(0, Math.min(layer.cornerRadius, layer.width / 2, layer.height / 2));

    return `<rect x="${escapeAttribute(layer.x)}" y="${escapeAttribute(layer.y)}" width="${escapeAttribute(layer.width)}" height="${escapeAttribute(layer.height)}" rx="${escapeAttribute(radius)}" ry="${escapeAttribute(radius)}" ${paint}${transform} />`;
  }

  if (layer.type === "ellipse") {
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;

    return `<ellipse cx="${escapeAttribute(point(cx))}" cy="${escapeAttribute(point(cy))}" rx="${escapeAttribute(point(layer.width / 2))}" ry="${escapeAttribute(point(layer.height / 2))}" ${paint}${transform} />`;
  }

  if (layer.type === "text") {
    const textLayer = layer as SerializableTextLayer;
    const fontStyle = textLayer.italic ? ' font-style="italic"' : "";

    return `<text x="${escapeAttribute(layer.x)}" y="${escapeAttribute(layer.y + layer.height / 2)}" dominant-baseline="middle" font-family="${escapeAttribute(textLayer.fontFamily ?? "Inter")}" font-size="${escapeAttribute(textLayer.fontSize)}" font-weight="${escapeAttribute(textLayer.fontWeight)}"${fontStyle} ${paint}${transform}>${escapeText(textLayer.text)}</text>`;
  }

  return `<path d="${escapeAttribute(layer.path)}" ${paint}${transform} />`;
}

export function layerToSvgMarkup(layer: SerializableLogoLayer, options: LayerRenderOptions = {}): string {
  if (!options.forceVisible && !layer.visible) {
    return "";
  }

  const opacity = layer.opacity !== 1 ? ` opacity="${escapeAttribute(layer.opacity)}"` : "";
  const clipPath = options.clipPathId ? ` clip-path="url(#${escapeAttribute(options.clipPathId)})"` : "";
  const title = options.forClipPath ? "" : `<title>${escapeText(layer.name)}</title>`;
  const shape = layerShapeMarkup(layer, options.forClipPath);

  if (options.forClipPath) {
    return shape;
  }

  return `<g id="layer-${escapeAttribute(layer.id)}" data-layer-name="${escapeAttribute(layer.name)}"${opacity}${clipPath}>${title}${shape}</g>`;
}

export function polygonPointsToPath(cx: number, cy: number, radius: number, sides: number): string {
  if (sides < 3) {
    return "";
  }

  const angleStep = (Math.PI * 2) / sides;
  const startAngle = -Math.PI / 2;
  const points = Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + angleStep * index;
    return `${point(cx + Math.cos(angle) * radius)} ${point(cy + Math.sin(angle) * radius)}`;
  });

  return `M ${points.join(" L ")} Z`;
}

export function starPointsToPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number,
): string {
  if (points < 2) {
    return "";
  }

  const angleStep = Math.PI / points;
  const startAngle = -Math.PI / 2;
  const pathPoints = Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = startAngle + angleStep * index;
    return `${point(cx + Math.cos(angle) * radius)} ${point(cy + Math.sin(angle) * radius)}`;
  });

  return `M ${pathPoints.join(" L ")} Z`;
}

export function renderDocumentSvg(document: LogoDocument, options: RenderSvgOptions = {}): string {
  const maskLayerIds = new Set(
    document.layers
      .filter((layer) => (layer.maskFor?.length ?? 0) > 0)
      .map((layer) => layer.id),
  );
  const clipPathIdsByLayerId = new Map(
    document.layers
      .filter((layer) => layer.visible && maskLayerIds.has(layer.id))
      .map((layer) => [layer.id, clipPathIdFor(layer.id)]),
  );
  const clipPaths = document.layers
    .filter((layer) => clipPathIdsByLayerId.has(layer.id))
    .map((layer) => {
      const clipId = clipPathIdsByLayerId.get(layer.id)!;
      return `<clipPath id="${escapeAttribute(clipId)}" clipPathUnits="userSpaceOnUse">${layerToSvgMarkup(layer, {
        forceVisible: true,
        forClipPath: true,
      })}</clipPath>`;
    });
  const body = document.layers
    .filter((layer) => {
      if (!layer.visible) {
        return false;
      }

      return options.showMaskLayers || !maskLayerIds.has(layer.id);
    })
    .map((layer) => {
      const clipId = layer.maskedBy ? clipPathIdsByLayerId.get(layer.maskedBy) : undefined;
      return layerToSvgMarkup(layer, { clipPathId: clipId });
    })
    .filter(Boolean);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeAttribute(document.settings.width)}" height="${escapeAttribute(document.settings.height)}" viewBox="0 0 ${escapeAttribute(document.settings.width)} ${escapeAttribute(document.settings.height)}" role="img" aria-label="${escapeAttribute(document.name)}">`,
    `<rect width="100%" height="100%" fill="${escapeAttribute(document.settings.background)}" />`,
    clipPaths.length > 0 ? `<defs>${clipPaths.join("")}</defs>` : "",
    ...body,
    "</svg>",
  ].join("");
}

export function svgToBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}
