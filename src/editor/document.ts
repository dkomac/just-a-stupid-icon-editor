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

  if (input.type === "group") {
    return { ...base, type: "group", children: input.children ?? [] };
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

function hasMergeSafeState(layer: LogoLayer): boolean {
  return (
    !layer.locked &&
    !layer.maskedBy &&
    (layer.maskFor?.length ?? 0) === 0
  );
}

function mergePartnerLayers(document: LogoDocument, layerId: string): [LogoLayer, LogoLayer] | undefined {
  const upperIndex = document.layers.findIndex((layer) => layer.id === layerId);

  if (upperIndex <= 0) {
    return undefined;
  }

  return [document.layers[upperIndex], document.layers[upperIndex - 1]];
}

function layerBounds(layers: LogoLayer[]): Geometry {
  const left = Math.min(...layers.map((layer) => layer.x));
  const top = Math.min(...layers.map((layer) => layer.y));
  const right = Math.max(...layers.map((layer) => layer.x + layer.width));
  const bottom = Math.max(...layers.map((layer) => layer.y + layer.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    rotation: 0,
  };
}

function withoutLayerRelations(layer: LogoLayer): LogoLayer {
  return {
    ...layer,
    maskedBy: undefined,
    maskFor: undefined,
  } as LogoLayer;
}

function childLayerToDocumentLayer(child: LogoLayer, parent: LogoLayer): LogoLayer {
  return {
    ...child,
    x: parent.x + (child.x / 100) * parent.width,
    y: parent.y + (child.y / 100) * parent.height,
    width: (child.width / 100) * parent.width,
    height: (child.height / 100) * parent.height,
  } as LogoLayer;
}

function layersForMerge(layer: LogoLayer): LogoLayer[] {
  if (layer.type !== "group") {
    return [withoutLayerRelations(layer)];
  }

  if (layer.rotation !== 0) {
    return [withoutLayerRelations(layer)];
  }

  return layer.children.map((child) => withoutLayerRelations(childLayerToDocumentLayer(child, layer)));
}

function toGroupChild(layer: LogoLayer, bounds: Geometry): LogoLayer {
  return {
    ...withoutLayerRelations(layer),
    x: bounds.width === 0 ? 0 : ((layer.x - bounds.x) / bounds.width) * 100,
    y: bounds.height === 0 ? 0 : ((layer.y - bounds.y) / bounds.height) * 100,
    width: bounds.width === 0 ? 100 : (layer.width / bounds.width) * 100,
    height: bounds.height === 0 ? 100 : (layer.height / bounds.height) * 100,
  } as LogoLayer;
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

  return (
    hasMergeSafeState(upperLayer) &&
    hasMergeSafeState(lowerLayer)
  );
}

export function mergeLayerDown(document: LogoDocument, layerId: string): LogoDocument {
  if (!canMergeLayerDown(document, layerId)) {
    return document;
  }

  const upperIndex = document.layers.findIndex((layer) => layer.id === layerId);
  const upperLayer = document.layers[upperIndex];
  const lowerLayer = document.layers[upperIndex - 1];
  const mergedChildren = [...layersForMerge(lowerLayer), ...layersForMerge(upperLayer)];
  const bounds = layerBounds(mergedChildren);

  if (bounds.width <= 0 || bounds.height <= 0) {
    return document;
  }

  const mergedLayer: LogoLayer = {
    id: createLayerId(),
    type: "group",
    name: `${upperLayer.name} + ${lowerLayer.name}`,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    opacity: upperLayer.opacity,
    fill: "transparent",
    stroke: "transparent",
    strokeWidth: 0,
    visible: upperLayer.visible || lowerLayer.visible,
    locked: false,
    children: mergedChildren.map((layer) => toGroupChild(layer, bounds)),
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
