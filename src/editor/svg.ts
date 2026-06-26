import type { LogoDocument, LogoLayer } from "./types";

export interface RenderSvgOptions {
  showMaskLayers?: boolean;
}

export interface LayerRenderOptions {
  clipPathId?: string;
  forceVisible?: boolean;
  forClipPath?: boolean;
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/=/g, "&#61;");
}

function escapeAttribute(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/=/g, "&#61;");
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function safePositiveNumber(value: number, fallback = 0): number {
  const finite = safeNumber(value, fallback);
  return finite < 0 ? fallback : finite;
}

function safeUnitNumber(value: number, fallback = 1): number {
  const finite = safeNumber(value, fallback);
  return Math.max(0, Math.min(1, finite));
}

function point(value: number): string {
  const finite = safeNumber(value);
  return Number.isInteger(finite) ? String(finite) : String(Number(finite.toFixed(3)));
}

function encodedIdSuffix(value: string): string {
  return Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(16).padStart(2, "0") ?? "00")
    .join("-");
}

function svgId(prefix: string, value: string): string {
  return `${prefix}-${encodedIdSuffix(value) || "empty"}`;
}

function clipPathIdFor(layerId: string): string {
  return svgId("clip", layerId);
}

function safePaint(value: string | undefined, fallback: string): string {
  const raw = value?.trim();

  if (!raw) {
    return fallback;
  }

  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
    return raw;
  }

  if (/^(rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/.test(raw)) {
    return raw;
  }

  if (/^[a-zA-Z]+$/.test(raw)) {
    return raw;
  }

  return fallback;
}

function safeFontFamily(value: string): string {
  const raw = value.trim();

  if (/^[a-zA-Z0-9 ,_-]+$/.test(raw)) {
    return raw;
  }

  return "Inter";
}

function shapeTransform(layer: LogoLayer): string {
  const rotation = safeNumber(layer.rotation);

  if (rotation === 0) {
    return "";
  }

  const cx = safeNumber(layer.x) + safePositiveNumber(layer.width) / 2;
  const cy = safeNumber(layer.y) + safePositiveNumber(layer.height) / 2;
  return ` transform="rotate(${point(rotation)} ${point(cx)} ${point(cy)})"`;
}

function paintAttributes(layer: LogoLayer): string {
  const fill = safePaint(layer.fill, "none");
  const stroke = safePaint(layer.stroke, "none");

  return [
    `fill="${escapeAttribute(fill)}"`,
    `stroke="${escapeAttribute(stroke)}"`,
    `stroke-width="${escapeAttribute(safePositiveNumber(layer.strokeWidth))}"`,
  ].join(" ");
}

function layerShapeMarkup(layer: LogoLayer, forClipPath = false): string {
  const paint = forClipPath ? 'fill="black" stroke="none" stroke-width="0"' : paintAttributes(layer);
  const transform = shapeTransform(layer);
  const x = safeNumber(layer.x);
  const y = safeNumber(layer.y);
  const width = safePositiveNumber(layer.width);
  const height = safePositiveNumber(layer.height);

  if (layer.type === "rect") {
    const radius = Math.max(0, Math.min(safePositiveNumber(layer.cornerRadius), width / 2, height / 2));

    return `<rect x="${escapeAttribute(x)}" y="${escapeAttribute(y)}" width="${escapeAttribute(width)}" height="${escapeAttribute(height)}" rx="${escapeAttribute(radius)}" ry="${escapeAttribute(radius)}" ${paint}${transform} />`;
  }

  if (layer.type === "ellipse") {
    const cx = x + width / 2;
    const cy = y + height / 2;

    return `<ellipse cx="${escapeAttribute(point(cx))}" cy="${escapeAttribute(point(cy))}" rx="${escapeAttribute(point(width / 2))}" ry="${escapeAttribute(point(height / 2))}" ${paint}${transform} />`;
  }

  if (layer.type === "text") {
    const fontSize = safePositiveNumber(layer.fontSize, 16);
    const fontWeight = safePositiveNumber(layer.fontWeight, 400);

    return `<text x="${escapeAttribute(x)}" y="${escapeAttribute(y + height / 2)}" dominant-baseline="middle" font-family="${escapeAttribute(safeFontFamily(layer.fontFamily))}" font-size="${escapeAttribute(fontSize)}" font-weight="${escapeAttribute(fontWeight)}" ${paint}${transform}>${escapeText(layer.text)}</text>`;
  }

  return `<path d="${escapeAttribute(layer.path)}" ${paint}${transform} />`;
}

export function layerToSvgMarkup(layer: LogoLayer, options: LayerRenderOptions = {}): string {
  if (!options.forceVisible && !layer.visible) {
    return "";
  }

  const opacityValue = safeUnitNumber(layer.opacity);
  const opacity = opacityValue !== 1 ? ` opacity="${escapeAttribute(opacityValue)}"` : "";
  const clipPath = options.clipPathId ? ` clip-path="url(#${escapeAttribute(options.clipPathId)})"` : "";
  const title = options.forClipPath ? "" : `<title>${escapeText(layer.name)}</title>`;
  const shape = layerShapeMarkup(layer, options.forClipPath);

  if (options.forClipPath) {
    return shape;
  }

  return `<g id="${escapeAttribute(svgId("layer", layer.id))}" data-layer-name="${escapeAttribute(layer.name)}"${opacity}${clipPath}>${title}${shape}</g>`;
}

export function polygonPointsToPath(cx: number, cy: number, radius: number, sides: number): string {
  const safeSides = Math.floor(safePositiveNumber(sides));

  if (safeSides < 3) {
    return "";
  }

  const angleStep = (Math.PI * 2) / safeSides;
  const startAngle = -Math.PI / 2;
  const safeCx = safeNumber(cx);
  const safeCy = safeNumber(cy);
  const safeRadius = safePositiveNumber(radius);
  const points = Array.from({ length: safeSides }, (_, index) => {
    const angle = startAngle + angleStep * index;
    return `${point(safeCx + Math.cos(angle) * safeRadius)} ${point(safeCy + Math.sin(angle) * safeRadius)}`;
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
  const safePoints = Math.floor(safePositiveNumber(points));

  if (safePoints < 2) {
    return "";
  }

  const angleStep = Math.PI / safePoints;
  const startAngle = -Math.PI / 2;
  const safeCx = safeNumber(cx);
  const safeCy = safeNumber(cy);
  const safeOuterRadius = safePositiveNumber(outerRadius);
  const safeInnerRadius = safePositiveNumber(innerRadius);
  const pathPoints = Array.from({ length: safePoints * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? safeOuterRadius : safeInnerRadius;
    const angle = startAngle + angleStep * index;
    return `${point(safeCx + Math.cos(angle) * radius)} ${point(safeCy + Math.sin(angle) * radius)}`;
  });

  return `M ${pathPoints.join(" L ")} Z`;
}

export function renderDocumentSvg(document: LogoDocument, options: RenderSvgOptions = {}): string {
  const width = safePositiveNumber(document.settings.width, 512);
  const height = safePositiveNumber(document.settings.height, 512);
  const background = safePaint(document.settings.background, "#ffffff");
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeAttribute(width)}" height="${escapeAttribute(height)}" viewBox="0 0 ${escapeAttribute(width)} ${escapeAttribute(height)}" role="img" aria-label="${escapeAttribute(document.name)}">`,
    background === "transparent" ? "" : `<rect width="100%" height="100%" fill="${escapeAttribute(background)}" />`,
    clipPaths.length > 0 ? `<defs>${clipPaths.join("")}</defs>` : "",
    ...body,
    "</svg>",
  ].join("");
}

export function svgToBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}
