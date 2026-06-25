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
  const source = document.layers.find((layer) => layer.id === layerId);

  if (!source) {
    return document;
  }

  const duplicate = {
    ...source,
    id: createLayerId(),
    name: `${source.name} copy`,
    maskedBy: undefined,
    maskFor: undefined,
  } as LogoLayer;

  return {
    ...document,
    layers: [...document.layers, duplicate],
    selectedLayerIds: [duplicate.id],
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
