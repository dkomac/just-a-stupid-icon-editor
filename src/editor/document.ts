import type {
  AlignmentMode,
  Geometry,
  LogoDocument,
  LogoLayer,
  NewLayerInput,
} from "./types";

let nextLayerNumber = 1;

function createLayerId(): string {
  return `layer-${nextLayerNumber++}`;
}

function createDocumentId(): string {
  return "logo-document";
}

function withDefaults(input: NewLayerInput, id: string): LogoLayer {
  const base = {
    id,
    name: input.name,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    fill: input.fill ?? "#111111",
    stroke: input.stroke,
    strokeWidth: input.strokeWidth ?? 0,
    visible: true,
    locked: false,
  };

  if (input.type === "rect") {
    return { ...base, type: "rect", cornerRadius: input.cornerRadius ?? 0 };
  }

  if (input.type === "ellipse") {
    return { ...base, type: "ellipse" };
  }

  if (input.type === "text") {
    return {
      ...base,
      type: "text",
      text: input.text ?? "Text",
      fontFamily: input.fontFamily ?? "Inter",
      fontSize: input.fontSize ?? 48,
      fontWeight: input.fontWeight ?? 700,
    };
  }

  return { ...base, type: "path", path: input.path ?? "" };
}

function withoutMaskTarget(maskFor: string[] | undefined, targetLayerId: string): string[] | undefined {
  const nextMaskFor = maskFor?.filter((id) => id !== targetLayerId);
  return nextMaskFor && nextMaskFor.length > 0 ? nextMaskFor : undefined;
}

function updateLayer(document: LogoDocument, layerId: string, update: (layer: LogoLayer) => LogoLayer): LogoDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? update(layer) : layer)),
  };
}

function baseDuplicateName(name: string): string {
  return name.replace(/\s-\s\d+$/, "");
}

function nextDuplicateName(document: LogoDocument, sourceName: string): string {
  const baseName = baseDuplicateName(sourceName);
  const existingNames = new Set(document.layers.map((layer) => layer.name));
  let suffix = 2;

  while (existingNames.has(`${baseName} - ${suffix}`)) {
    suffix += 1;
  }

  return `${baseName} - ${suffix}`;
}

function point(value: number): string {
  const finite = Number.isFinite(value) ? value : 0;
  return Number.isInteger(finite) ? String(finite) : String(Number(finite.toFixed(3)));
}

function rectPath(width = 100, height = 100, radiusX = 0, radiusY = radiusX): string {
  const safeRadiusX = Math.max(0, Math.min(radiusX, width / 2));
  const safeRadiusY = Math.max(0, Math.min(radiusY, height / 2));

  if (safeRadiusX === 0 || safeRadiusY === 0) {
    return `M 0 0 H ${point(width)} V ${point(height)} H 0 Z`;
  }

  return [
    `M ${point(safeRadiusX)} 0`,
    `H ${point(width - safeRadiusX)}`,
    `Q ${point(width)} 0 ${point(width)} ${point(safeRadiusY)}`,
    `V ${point(height - safeRadiusY)}`,
    `Q ${point(width)} ${point(height)} ${point(width - safeRadiusX)} ${point(height)}`,
    `H ${point(safeRadiusX)}`,
    `Q 0 ${point(height)} 0 ${point(height - safeRadiusY)}`,
    `V ${point(safeRadiusY)}`,
    `Q 0 0 ${point(safeRadiusX)} 0`,
    "Z",
  ].join(" ");
}

function ellipsePath(): string {
  return "M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z";
}

function normalizedPathForLayer(layer: LogoLayer): string | undefined {
  if (layer.type === "rect") {
    const safeRadius = Math.max(0, Math.min(layer.cornerRadius, layer.width / 2, layer.height / 2));
    const radiusX = layer.width > 0 ? (safeRadius / layer.width) * 100 : 0;
    const radiusY = layer.height > 0 ? (safeRadius / layer.height) * 100 : 0;

    return rectPath(100, 100, radiusX, radiusY);
  }

  if (layer.type === "ellipse") {
    return ellipsePath();
  }

  if (layer.type === "path") {
    return layer.path;
  }

  return undefined;
}

function pathToMergedCoordinates(layer: LogoLayer, bounds: Geometry): string | undefined {
  const path = normalizedPathForLayer(layer);

  if (!path || bounds.width <= 0 || bounds.height <= 0) {
    return undefined;
  }

  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const parts: string[] = [];
  let index = 0;

  function isCommand(value: string | undefined): boolean {
    return Boolean(value && /^[a-zA-Z]$/.test(value));
  }

  function readNumber(): number {
    const value = Number(tokens[index]);
    index += 1;
    return Number.isFinite(value) ? value : 0;
  }

  function mapX(value: number): number {
    const documentX = layer.x + (value / 100) * layer.width;
    return ((documentX - bounds.x) / bounds.width) * 100;
  }

  function mapY(value: number): number {
    const documentY = layer.y + (value / 100) * layer.height;
    return ((documentY - bounds.y) / bounds.height) * 100;
  }

  function mapRadiusX(value: number): number {
    return ((value / 100) * layer.width / bounds.width) * 100;
  }

  function mapRadiusY(value: number): number {
    return ((value / 100) * layer.height / bounds.height) * 100;
  }

  function append(command: string, values: Array<string | number>) {
    parts.push(`${command} ${values.map((value) => (typeof value === "number" ? point(value) : value)).join(" ")}`.trim());
  }

  while (index < tokens.length) {
    const command = tokens[index++];

    if (!command || !isCommand(command)) {
      return undefined;
    }

    if (command === "Z" || command === "z") {
      parts.push("Z");
      continue;
    }

    if (!/^[MLHVCQA]$/.test(command)) {
      return undefined;
    }

    while (index < tokens.length && !isCommand(tokens[index])) {
      if (command === "M" || command === "L") {
        append(command, [mapX(readNumber()), mapY(readNumber())]);
      } else if (command === "H") {
        append(command, [mapX(readNumber())]);
      } else if (command === "V") {
        append(command, [mapY(readNumber())]);
      } else if (command === "C") {
        append(command, [
          mapX(readNumber()),
          mapY(readNumber()),
          mapX(readNumber()),
          mapY(readNumber()),
          mapX(readNumber()),
          mapY(readNumber()),
        ]);
      } else if (command === "Q") {
        append(command, [mapX(readNumber()), mapY(readNumber()), mapX(readNumber()), mapY(readNumber())]);
      } else if (command === "A") {
        append(command, [
          mapRadiusX(readNumber()),
          mapRadiusY(readNumber()),
          readNumber(),
          readNumber(),
          readNumber(),
          mapX(readNumber()),
          mapY(readNumber()),
        ]);
      }
    }
  }

  return parts.join(" ");
}

function isMergeableShapeLayer(layer: LogoLayer): layer is Exclude<LogoLayer, { type: "text" }> {
  return layer.type === "rect" || layer.type === "ellipse" || layer.type === "path";
}

function hasMergeSafeState(layer: LogoLayer): boolean {
  return (
    !layer.locked &&
    layer.visible &&
    layer.rotation === 0 &&
    !layer.maskedBy &&
    (layer.maskFor?.length ?? 0) === 0
  );
}

function hasMatchingMergeStyle(a: LogoLayer, b: LogoLayer): boolean {
  return a.fill === b.fill && (a.stroke ?? "") === (b.stroke ?? "") && a.strokeWidth === b.strokeWidth && a.opacity === b.opacity;
}

function mergePartnerLayers(document: LogoDocument, layerId: string): [LogoLayer, LogoLayer] | undefined {
  const upperIndex = document.layers.findIndex((layer) => layer.id === layerId);

  if (upperIndex <= 0) {
    return undefined;
  }

  return [document.layers[upperIndex], document.layers[upperIndex - 1]];
}

function mergedLayerBounds(upperLayer: LogoLayer, lowerLayer: LogoLayer): Geometry {
  const left = Math.min(lowerLayer.x, upperLayer.x);
  const top = Math.min(lowerLayer.y, upperLayer.y);
  const right = Math.max(lowerLayer.x + lowerLayer.width, upperLayer.x + upperLayer.width);
  const bottom = Math.max(lowerLayer.y + lowerLayer.height, upperLayer.y + upperLayer.height);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    rotation: 0,
  };
}

export function createDocument(): LogoDocument {
  return {
    id: createDocumentId(),
    name: "Untitled Logo",
    version: 1,
    settings: {
      width: 512,
      height: 512,
      gridSize: 8,
      snapToGrid: true,
      background: "#ffffff",
    },
    layers: [],
    selectedLayerIds: [],
  };
}

export function addLayer(document: LogoDocument, input: NewLayerInput): LogoDocument {
  const layer = withDefaults(input, createLayerId());

  return {
    ...document,
    layers: [...document.layers, layer],
    selectedLayerIds: [layer.id],
  };
}

export function updateLayerGeometry(
  document: LogoDocument,
  layerId: string,
  patch: Partial<Geometry>,
): LogoDocument {
  return updateLayer(document, layerId, (layer) => (layer.locked ? layer : { ...layer, ...patch }));
}

export function toggleLayerVisible(document: LogoDocument, layerId: string): LogoDocument {
  return updateLayer(document, layerId, (layer) => ({ ...layer, visible: !layer.visible }));
}

export function toggleLayerLocked(document: LogoDocument, layerId: string): LogoDocument {
  return updateLayer(document, layerId, (layer) => ({ ...layer, locked: !layer.locked }));
}

export function duplicateLayer(document: LogoDocument, layerId: string): LogoDocument {
  const sourceIndex = document.layers.findIndex((layer) => layer.id === layerId);
  const source = document.layers[sourceIndex];

  if (!source) {
    return document;
  }

  const duplicate = {
    ...source,
    id: createLayerId(),
    name: nextDuplicateName(document, source.name),
    x: source.x + document.settings.gridSize,
    y: source.y + document.settings.gridSize,
    maskedBy: undefined,
    maskFor: undefined,
  } as LogoLayer;
  const layers = [...document.layers];
  layers.splice(sourceIndex + 1, 0, duplicate);

  return {
    ...document,
    layers,
    selectedLayerIds: [duplicate.id],
  };
}

export function canMergeLayerDown(document: LogoDocument, layerId: string): boolean {
  const partners = mergePartnerLayers(document, layerId);

  if (!partners) {
    return false;
  }

  const [upperLayer, lowerLayer] = partners;
  const bounds = mergedLayerBounds(upperLayer, lowerLayer);

  return (
    isMergeableShapeLayer(upperLayer) &&
    isMergeableShapeLayer(lowerLayer) &&
    hasMergeSafeState(upperLayer) &&
    hasMergeSafeState(lowerLayer) &&
    hasMatchingMergeStyle(upperLayer, lowerLayer) &&
    Boolean(pathToMergedCoordinates(upperLayer, bounds)) &&
    Boolean(pathToMergedCoordinates(lowerLayer, bounds))
  );
}

export function mergeLayerDown(document: LogoDocument, layerId: string): LogoDocument {
  if (!canMergeLayerDown(document, layerId)) {
    return document;
  }

  const upperIndex = document.layers.findIndex((layer) => layer.id === layerId);
  const upperLayer = document.layers[upperIndex];
  const lowerLayer = document.layers[upperIndex - 1];
  const bounds = mergedLayerBounds(upperLayer, lowerLayer);
  const lowerPath = pathToMergedCoordinates(lowerLayer, bounds);
  const upperPath = pathToMergedCoordinates(upperLayer, bounds);

  if (!lowerPath || !upperPath) {
    return document;
  }

  const mergedLayer: LogoLayer = {
    id: createLayerId(),
    type: "path",
    name: `${upperLayer.name} + ${lowerLayer.name}`,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    opacity: upperLayer.opacity,
    fill: upperLayer.fill,
    stroke: upperLayer.stroke,
    strokeWidth: upperLayer.strokeWidth,
    visible: true,
    locked: false,
    path: `${lowerPath} ${upperPath}`,
  };
  const layers = [...document.layers];
  layers.splice(upperIndex - 1, 2, mergedLayer);

  return {
    ...document,
    layers,
    selectedLayerIds: [mergedLayer.id],
  };
}

export function deleteLayer(document: LogoDocument, layerId: string): LogoDocument {
  const layers = document.layers
    .filter((layer) => layer.id !== layerId)
    .map((layer) => ({
      ...layer,
      maskedBy: layer.maskedBy === layerId ? undefined : layer.maskedBy,
      maskFor: withoutMaskTarget(layer.maskFor, layerId),
    })) as LogoLayer[];

  return {
    ...document,
    layers,
    selectedLayerIds: document.selectedLayerIds.filter((id) => id !== layerId),
  };
}

export function clearLayers(document: LogoDocument): LogoDocument {
  return {
    ...document,
    layers: [],
    selectedLayerIds: [],
  };
}

export function moveLayer(document: LogoDocument, layerId: string, targetIndex: number): LogoDocument {
  const currentIndex = document.layers.findIndex((layer) => layer.id === layerId);

  if (currentIndex === -1) {
    return document;
  }

  const layers = [...document.layers];
  const [layer] = layers.splice(currentIndex, 1);
  layers.splice(Math.max(0, Math.min(targetIndex, layers.length)), 0, layer);

  return { ...document, layers };
}

export function alignLayers(document: LogoDocument, layerIds: string[], mode: AlignmentMode): LogoDocument {
  const selectedLayers = document.layers.filter((layer) => layerIds.includes(layer.id));

  if (selectedLayers.length < 2) {
    return document;
  }

  const left = Math.min(...selectedLayers.map((layer) => layer.x));
  const right = Math.max(...selectedLayers.map((layer) => layer.x + layer.width));
  const top = Math.min(...selectedLayers.map((layer) => layer.y));
  const bottom = Math.max(...selectedLayers.map((layer) => layer.y + layer.height));
  const center = left + (right - left) / 2;
  const middle = top + (bottom - top) / 2;

  return {
    ...document,
    layers: document.layers.map((layer) => {
      if (!layerIds.includes(layer.id) || layer.locked) {
        return layer;
      }

      if (mode === "left") {
        return { ...layer, x: left };
      }

      if (mode === "center") {
        return { ...layer, x: center - layer.width / 2 };
      }

      if (mode === "right") {
        return { ...layer, x: right - layer.width };
      }

      if (mode === "top") {
        return { ...layer, y: top };
      }

      if (mode === "middle") {
        return { ...layer, y: middle - layer.height / 2 };
      }

      return { ...layer, y: bottom - layer.height };
    }),
  };
}

export function applyMask(document: LogoDocument, maskLayerId: string, targetLayerId: string): LogoDocument {
  if (maskLayerId === targetLayerId) {
    return document;
  }

  const hasMask = document.layers.some((layer) => layer.id === maskLayerId);
  const hasTarget = document.layers.some((layer) => layer.id === targetLayerId);

  if (!hasMask || !hasTarget) {
    return document;
  }

  return {
    ...document,
    layers: document.layers.map((layer) => {
      if (layer.id === maskLayerId) {
        const maskFor = withoutMaskTarget(layer.maskFor, targetLayerId) ?? [];
        return { ...layer, maskFor: Array.from(new Set([...maskFor, targetLayerId])) };
      }

      if (layer.id === targetLayerId) {
        return { ...layer, maskedBy: maskLayerId };
      }

      if (layer.maskFor?.includes(targetLayerId)) {
        return { ...layer, maskFor: withoutMaskTarget(layer.maskFor, targetLayerId) };
      }

      return layer;
    }),
  };
}

export function releaseMask(document: LogoDocument, targetLayerId: string): LogoDocument {
  const target = document.layers.find((layer) => layer.id === targetLayerId);

  if (!target?.maskedBy) {
    return document;
  }

  return {
    ...document,
    layers: document.layers.map((layer) => {
      if (layer.id === targetLayerId) {
        return { ...layer, maskedBy: undefined };
      }

      if (layer.id === target.maskedBy) {
        return { ...layer, maskFor: withoutMaskTarget(layer.maskFor, targetLayerId) };
      }

      return layer;
    }),
  };
}

export function snapValue(value: number, gridSize: number): number {
  if (gridSize <= 0) {
    return value;
  }

  return Math.round(value / gridSize) * gridSize;
}
