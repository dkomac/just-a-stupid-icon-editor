import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { snapValue } from "../editor/document";
import type { LogoDocument, LogoLayer } from "../editor/types";

interface CanvasStageProps {
  document: LogoDocument;
  selectedLayerIds: string[];
  showGrid: boolean;
  snapToGrid: boolean;
  readOnly?: boolean;
  previewBackground?: string;
  zoom?: number;
  onSelectLayer: (layerId: string) => void;
  onZoom?: (deltaY: number) => void;
  onChangeDocument: (document: LogoDocument) => void;
}

type ResizeHandle = "nw" | "ne" | "se" | "sw";
type InteractionKind = "move" | "resize" | "rotate";
type ArrowKey = "ArrowUp" | "ArrowRight" | "ArrowDown" | "ArrowLeft";

interface Point {
  x: number;
  y: number;
}

interface CenterGuides {
  horizontal?: number;
  vertical?: number;
}

interface InteractionState {
  kind: InteractionKind;
  pointerId: number;
  startPoint: Point;
  startDocument: LogoDocument;
  layerIds: string[];
  handle?: ResizeHandle;
}

const GUIDE_THRESHOLD = 6;
const MIN_LAYER_SIZE = 8;
const KEYBOARD_ROTATION_STEP = 1;
const KEYBOARD_ROTATION_LARGE_STEP = 15;

function isArrowKey(key: string): key is ArrowKey {
  return key === "ArrowUp" || key === "ArrowRight" || key === "ArrowDown" || key === "ArrowLeft";
}

function snapGeometryValue(value: number, gridSize: number, enabled: boolean): number {
  return enabled ? snapValue(value, gridSize) : value;
}

function snapSizeValue(value: number, gridSize: number, enabled: boolean): number {
  const minimumSize = Math.max(MIN_LAYER_SIZE, value);
  return Math.max(MIN_LAYER_SIZE, snapGeometryValue(minimumSize, gridSize, enabled));
}

function selectedEditableLayers(document: LogoDocument, layerIds: string[]): LogoLayer[] {
  return document.layers.filter((layer) => layerIds.includes(layer.id) && !layer.locked);
}

function canvasPoint(svg: SVGSVGElement | null, event: PointerEvent | React.PointerEvent): Point {
  const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
  const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;

  if (!svg) {
    return { x: clientX, y: clientY };
  }

  const rect = svg.getBoundingClientRect();

  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
    return { x: clientX, y: clientY };
  }

  return {
    x: ((clientX - rect.left) / rect.width) * Number(svg.getAttribute("width")),
    y: ((clientY - rect.top) / rect.height) * Number(svg.getAttribute("height")),
  };
}

function centerOf(layer: LogoLayer): Point {
  return {
    x: layer.x + layer.width / 2,
    y: layer.y + layer.height / 2,
  };
}

function renderLayerShape(layer: LogoLayer, forClipPath = false) {
  const paint = forClipPath
    ? { fill: "black", stroke: "none", strokeWidth: 0 }
    : { fill: layer.fill, stroke: layer.stroke ?? "none", strokeWidth: layer.strokeWidth };

  if (layer.type === "rect") {
    const radius = Math.max(0, Math.min(layer.cornerRadius, layer.width / 2, layer.height / 2));
    return <rect x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={radius} ry={radius} {...paint} />;
  }

  if (layer.type === "ellipse") {
    return (
      <ellipse
        cx={layer.x + layer.width / 2}
        cy={layer.y + layer.height / 2}
        rx={layer.width / 2}
        ry={layer.height / 2}
        {...paint}
      />
    );
  }

  if (layer.type === "text") {
    return (
      <text
        x={layer.x}
        y={layer.y + layer.height / 2}
        dominantBaseline="middle"
        fontFamily={layer.fontFamily}
        fontSize={layer.fontSize}
        fontWeight={layer.fontWeight}
        {...paint}
      >
        {layer.text}
      </text>
    );
  }

  return (
    <g transform={`translate(${layer.x} ${layer.y})`}>
      <g transform={`scale(${layer.width / 100} ${layer.height / 100})`}>
        <path d={layer.path} {...paint} />
      </g>
    </g>
  );
}

function layerTransform(layer: LogoLayer): string | undefined {
  if (layer.rotation === 0) {
    return undefined;
  }

  const center = centerOf(layer);
  return `rotate(${layer.rotation} ${center.x} ${center.y})`;
}

function clipPathId(documentId: string, layerId: string): string {
  return `canvas-clip-${documentId}-${layerId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function guideTargets(document: LogoDocument, movingLayerIds: string[]): Point[] {
  return [
    {
      x: document.settings.width / 2,
      y: document.settings.height / 2,
    },
    ...document.layers.filter((layer) => layer.visible && !movingLayerIds.includes(layer.id)).map(centerOf),
  ];
}

export function CanvasStage({
  document,
  selectedLayerIds,
  showGrid,
  snapToGrid,
  readOnly = false,
  previewBackground,
  zoom = 1,
  onSelectLayer,
  onZoom,
  onChangeDocument,
}: CanvasStageProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const pointerMoveHandlerRef = useRef<(event: PointerEvent) => void>(() => {});
  const pointerUpHandlerRef = useRef<(event: PointerEvent) => void>(() => {});
  const stablePointerMoveHandler = useRef((event: PointerEvent) => pointerMoveHandlerRef.current(event));
  const stablePointerUpHandler = useRef((event: PointerEvent) => pointerUpHandlerRef.current(event));
  const previewDocumentRef = useRef<LogoDocument | undefined>(undefined);
  const [previewDocument, setPreviewDocument] = useState<LogoDocument>();
  const [guides, setGuides] = useState<CenterGuides>({});
  const activeDocument = previewDocument ?? document;
  const renderDocument =
    previewBackground === undefined
      ? activeDocument
      : {
          ...activeDocument,
          settings: {
            ...activeDocument.settings,
            background: previewBackground,
          },
        };
  const activeLayerIds = readOnly ? [] : selectedLayerIds;
  const selectedLayer = renderDocument.layers.find((layer) => activeLayerIds.includes(layer.id) && layer.visible);
  const gridId = `canvas-grid-${activeDocument.id}`;
  const maskLayerIds = new Set(renderDocument.layers.filter((layer) => (layer.maskFor?.length ?? 0) > 0).map((layer) => layer.id));
  const visibleMaskLayers = renderDocument.layers.filter((layer) => layer.visible && maskLayerIds.has(layer.id));
  const clipPathIdsByLayerId = new Map(visibleMaskLayers.map((layer) => [layer.id, clipPathId(renderDocument.id, layer.id)]));

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", stablePointerMoveHandler.current);
      window.removeEventListener("pointerup", stablePointerUpHandler.current);
    };
  }, []);

  function withActiveSelection(nextDocument: LogoDocument, activeLayerIds: string[]) {
    return {
      ...nextDocument,
      selectedLayerIds: activeLayerIds,
    };
  }

  function previewInteraction(nextDocument: LogoDocument, activeLayerIds: string[]) {
    const nextPreviewDocument = withActiveSelection(nextDocument, activeLayerIds);

    previewDocumentRef.current = nextPreviewDocument;
    setPreviewDocument(nextPreviewDocument);
  }

  function updateMove(state: InteractionState, point: Point) {
    const deltaX = point.x - state.startPoint.x;
    const deltaY = point.y - state.startPoint.y;
    const editableLayers = selectedEditableLayers(state.startDocument, state.layerIds);
    const nextGuides: CenterGuides = {};
    const gridSize = state.startDocument.settings.gridSize;
    const targets = guideTargets(state.startDocument, state.layerIds);

    if (editableLayers.length === 0) {
      return;
    }

    const movedById = new Map(
      editableLayers.map((layer) => {
        let x = snapGeometryValue(layer.x + deltaX, gridSize, snapToGrid);
        let y = snapGeometryValue(layer.y + deltaY, gridSize, snapToGrid);
        const centerX = x + layer.width / 2;
        const centerY = y + layer.height / 2;
        const verticalTarget = targets.find((target) => Math.abs(centerX - target.x) <= GUIDE_THRESHOLD);
        const horizontalTarget = targets.find((target) => Math.abs(centerY - target.y) <= GUIDE_THRESHOLD);

        if (verticalTarget) {
          x = verticalTarget.x - layer.width / 2;
          nextGuides.vertical = verticalTarget.x;
        }

        if (horizontalTarget) {
          y = horizontalTarget.y - layer.height / 2;
          nextGuides.horizontal = horizontalTarget.y;
        }

        return [
          layer.id,
          {
            ...layer,
            x,
            y,
          } as LogoLayer,
        ];
      }),
    );

    setGuides(nextGuides);
    previewInteraction(
      {
        ...state.startDocument,
        layers: state.startDocument.layers.map((layer) => movedById.get(layer.id) ?? layer),
      },
      state.layerIds,
    );
  }

  function updateResize(state: InteractionState, point: Point) {
    const layer = state.startDocument.layers.find((candidate) => candidate.id === state.layerIds[0]);

    if (!layer || layer.locked || !state.handle) {
      return;
    }

    const deltaX = point.x - state.startPoint.x;
    const deltaY = point.y - state.startPoint.y;
    const gridSize = state.startDocument.settings.gridSize;
    let x = layer.x;
    let y = layer.y;
    let width = layer.width;
    let height = layer.height;

    if (state.handle.includes("e")) {
      width = Math.max(MIN_LAYER_SIZE, layer.width + deltaX);
    }

    if (state.handle.includes("s")) {
      height = Math.max(MIN_LAYER_SIZE, layer.height + deltaY);
    }

    if (state.handle.includes("w")) {
      width = Math.max(MIN_LAYER_SIZE, layer.width - deltaX);
      x = layer.x + layer.width - width;
    }

    if (state.handle.includes("n")) {
      height = Math.max(MIN_LAYER_SIZE, layer.height - deltaY);
      y = layer.y + layer.height - height;
    }

    const nextPatch = {
      x: snapGeometryValue(x, gridSize, snapToGrid),
      y: snapGeometryValue(y, gridSize, snapToGrid),
      width: snapSizeValue(width, gridSize, snapToGrid),
      height: snapSizeValue(height, gridSize, snapToGrid),
    };

    previewInteraction(
      {
        ...state.startDocument,
        layers: state.startDocument.layers.map((candidate) =>
          candidate.id === layer.id ? ({ ...candidate, ...nextPatch } as LogoLayer) : candidate,
        ),
      },
      state.layerIds,
    );
  }

  function updateRotate(state: InteractionState, point: Point) {
    const layer = state.startDocument.layers.find((candidate) => candidate.id === state.layerIds[0]);

    if (!layer || layer.locked) {
      return;
    }

    const center = centerOf(layer);
    const angle = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI + 90;
    const rotation = Math.round((angle + 360) % 360);

    previewInteraction(
      {
        ...state.startDocument,
        layers: state.startDocument.layers.map((candidate) =>
          candidate.id === layer.id ? ({ ...candidate, rotation } as LogoLayer) : candidate,
        ),
      },
      state.layerIds,
    );
  }

  function handleWindowPointerMove(event: PointerEvent) {
    const state = interactionRef.current;

    if (!state || event.pointerId !== state.pointerId) {
      return;
    }

    const point = canvasPoint(svgRef.current, event);

    if (state.kind === "move") {
      updateMove(state, point);
      return;
    }

    if (state.kind === "resize") {
      updateResize(state, point);
      return;
    }

    updateRotate(state, point);
  }

  function handleWindowPointerUp(event: PointerEvent) {
    const state = interactionRef.current;

    if (state && event.pointerId !== state.pointerId) {
      return;
    }

    interactionRef.current = null;
    if (previewDocumentRef.current) {
      onChangeDocument(previewDocumentRef.current);
    }
    previewDocumentRef.current = undefined;
    setPreviewDocument(undefined);
    setGuides({});
    window.removeEventListener("pointermove", stablePointerMoveHandler.current);
    window.removeEventListener("pointerup", stablePointerUpHandler.current);
  }

  pointerMoveHandlerRef.current = handleWindowPointerMove;
  pointerUpHandlerRef.current = handleWindowPointerUp;

  function beginInteraction(event: React.PointerEvent, state: InteractionState) {
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = state;
    window.addEventListener("pointermove", stablePointerMoveHandler.current);
    window.addEventListener("pointerup", stablePointerUpHandler.current);
  }

  function handleLayerPointerDown(event: React.PointerEvent, layer: LogoLayer) {
    if (readOnly) {
      return;
    }

    onSelectLayer(layer.id);

    if (layer.locked) {
      return;
    }

    const layerIds = selectedLayerIds.includes(layer.id) ? selectedLayerIds : [layer.id];
    beginInteraction(event, {
      kind: "move",
      pointerId: event.pointerId,
      startPoint: canvasPoint(svgRef.current, event),
      startDocument: activeDocument,
      layerIds,
    });
  }

  function handleLayerKeyDown(event: React.KeyboardEvent<SVGGElement>, layer: LogoLayer) {
    if (readOnly) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelectLayer(layer.id);
  }

  function handleResizePointerDown(event: React.PointerEvent, handle: ResizeHandle) {
    if (!selectedLayer || selectedLayer.locked) {
      return;
    }

    beginInteraction(event, {
      kind: "resize",
      pointerId: event.pointerId,
      startPoint: canvasPoint(svgRef.current, event),
      startDocument: activeDocument,
      layerIds: [selectedLayer.id],
      handle,
    });
  }

  function commitKeyboardResize(event: React.KeyboardEvent, handle: ResizeHandle) {
    if (!selectedLayer || selectedLayer.locked || !isArrowKey(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const baseStep = snapToGrid ? activeDocument.settings.gridSize : 1;
    const step = event.shiftKey ? baseStep * 4 : baseStep;
    let x = selectedLayer.x;
    let y = selectedLayer.y;
    let width = selectedLayer.width;
    let height = selectedLayer.height;

    if (event.key === "ArrowRight") {
      if (handle.includes("e")) {
        width += step;
      }

      if (handle.includes("w")) {
        width = Math.max(MIN_LAYER_SIZE, width - step);
        x = selectedLayer.x + selectedLayer.width - width;
      }
    }

    if (event.key === "ArrowLeft") {
      if (handle.includes("e")) {
        width = Math.max(MIN_LAYER_SIZE, width - step);
      }

      if (handle.includes("w")) {
        width += step;
        x -= step;
      }
    }

    if (event.key === "ArrowDown") {
      if (handle.includes("s")) {
        height += step;
      }

      if (handle.includes("n")) {
        height = Math.max(MIN_LAYER_SIZE, height - step);
        y = selectedLayer.y + selectedLayer.height - height;
      }
    }

    if (event.key === "ArrowUp") {
      if (handle.includes("s")) {
        height = Math.max(MIN_LAYER_SIZE, height - step);
      }

      if (handle.includes("n")) {
        height += step;
        y -= step;
      }
    }

    const nextLayer = {
      ...selectedLayer,
      x: snapGeometryValue(x, activeDocument.settings.gridSize, snapToGrid),
      y: snapGeometryValue(y, activeDocument.settings.gridSize, snapToGrid),
      width: snapSizeValue(width, activeDocument.settings.gridSize, snapToGrid),
      height: snapSizeValue(height, activeDocument.settings.gridSize, snapToGrid),
    } as LogoLayer;

    onChangeDocument(
      withActiveSelection(
        {
          ...activeDocument,
          layers: activeDocument.layers.map((layer) => (layer.id === selectedLayer.id ? nextLayer : layer)),
        },
        [selectedLayer.id],
      ),
    );
  }

  function handleRotatePointerDown(event: React.PointerEvent) {
    if (!selectedLayer || selectedLayer.locked) {
      return;
    }

    beginInteraction(event, {
      kind: "rotate",
      pointerId: event.pointerId,
      startPoint: canvasPoint(svgRef.current, event),
      startDocument: activeDocument,
      layerIds: [selectedLayer.id],
    });
  }

  function commitKeyboardRotation(event: React.KeyboardEvent) {
    if (!selectedLayer || selectedLayer.locked || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const step = event.shiftKey ? KEYBOARD_ROTATION_LARGE_STEP : KEYBOARD_ROTATION_STEP;
    const delta = event.key === "ArrowRight" ? step : -step;
    const rotation = (selectedLayer.rotation + delta + 360) % 360;
    const nextLayer = { ...selectedLayer, rotation } as LogoLayer;

    onChangeDocument(
      withActiveSelection(
        {
          ...activeDocument,
          layers: activeDocument.layers.map((layer) => (layer.id === selectedLayer.id ? nextLayer : layer)),
        },
        [selectedLayer.id],
      ),
    );
  }

  return (
    <div
      className="canvas-stage"
      data-grid={showGrid}
      data-preview={readOnly}
      data-preview-background={previewBackground}
      style={{ "--canvas-zoom": String(zoom) } as CSSProperties}
      onWheel={(event) => {
        if (!onZoom) {
          return;
        }

        event.preventDefault();
        onZoom(event.deltaY);
      }}
    >
      <svg
        ref={svgRef}
        className="canvas-svg"
        width={renderDocument.settings.width}
        height={renderDocument.settings.height}
        viewBox={`0 0 ${renderDocument.settings.width} ${renderDocument.settings.height}`}
        role="img"
        aria-label={renderDocument.name}
      >
        <defs>
          {showGrid ? (
            <pattern id={gridId} width={renderDocument.settings.gridSize} height={renderDocument.settings.gridSize} patternUnits="userSpaceOnUse">
              <path d={`M ${renderDocument.settings.gridSize} 0 L 0 0 0 ${renderDocument.settings.gridSize}`} className="canvas-grid-line" />
            </pattern>
          ) : null}
          {visibleMaskLayers.map((layer) => (
            <clipPath key={layer.id} id={clipPathIdsByLayerId.get(layer.id)} clipPathUnits="userSpaceOnUse">
              <g transform={layerTransform(layer)}>{renderLayerShape(layer, true)}</g>
            </clipPath>
          ))}
        </defs>
        <rect data-testid="canvas-background" width="100%" height="100%" fill={renderDocument.settings.background} />
        {showGrid ? <rect width="100%" height="100%" fill={`url(#${gridId})`} className="canvas-grid-fill" /> : null}
        {renderDocument.layers
          .filter((layer) => layer.visible && !maskLayerIds.has(layer.id))
          .map((layer) => {
            const clipId = layer.maskedBy ? clipPathIdsByLayerId.get(layer.maskedBy) : undefined;

            return (
              <g
                key={layer.id}
                data-testid={`canvas-layer-${layer.id}`}
                className="canvas-layer"
                data-selected={activeLayerIds.includes(layer.id)}
                data-locked={layer.locked}
                role={readOnly ? undefined : "button"}
                tabIndex={readOnly ? undefined : 0}
                aria-label={`Canvas layer ${layer.name}`}
                opacity={layer.opacity}
                transform={layerTransform(layer)}
                clipPath={clipId ? `url(#${clipId})` : undefined}
                onPointerDown={(event) => handleLayerPointerDown(event, layer)}
                onKeyDown={(event) => handleLayerKeyDown(event, layer)}
              >
                <title>{layer.name}</title>
                {renderLayerShape(layer)}
              </g>
            );
          })}
        {guides.vertical !== undefined ? <line className="canvas-guide" x1={guides.vertical} x2={guides.vertical} y1={0} y2={renderDocument.settings.height} /> : null}
        {guides.horizontal !== undefined ? <line className="canvas-guide" x1={0} x2={renderDocument.settings.width} y1={guides.horizontal} y2={guides.horizontal} /> : null}
        {selectedLayer ? (
          <g className="canvas-selection" transform={layerTransform(selectedLayer)}>
            <rect
              className="canvas-selection-outline"
              x={selectedLayer.x}
              y={selectedLayer.y}
              width={selectedLayer.width}
              height={selectedLayer.height}
            />
            {!selectedLayer.locked ? (
              <>
                {(["nw", "ne", "se", "sw"] as ResizeHandle[]).map((handle) => {
                  const x = handle.includes("w") ? selectedLayer.x : selectedLayer.x + selectedLayer.width;
                  const y = handle.includes("n") ? selectedLayer.y : selectedLayer.y + selectedLayer.height;

                  return (
                    <rect
                      key={handle}
                      className="canvas-resize-handle"
                      aria-label={`Resize ${handle}`}
                      x={x - 5}
                      y={y - 5}
                      width={10}
                      height={10}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(event) => handleResizePointerDown(event, handle)}
                      onKeyDown={(event) => commitKeyboardResize(event, handle)}
                    >
                      <title>{`Resize ${handle}`}</title>
                    </rect>
                  );
                })}
                <line
                  className="canvas-rotate-arm"
                  x1={selectedLayer.x + selectedLayer.width / 2}
                  y1={selectedLayer.y}
                  x2={selectedLayer.x + selectedLayer.width / 2}
                  y2={selectedLayer.y - 28}
                />
                <circle
                  className="canvas-rotate-handle"
                  aria-label="Rotate layer"
                  cx={selectedLayer.x + selectedLayer.width / 2}
                  cy={selectedLayer.y - 34}
                  r={7}
                  role="button"
                  tabIndex={0}
                  onPointerDown={handleRotatePointerDown}
                  onKeyDown={commitKeyboardRotation}
                >
                  <title>Rotate layer</title>
                </circle>
              </>
            ) : null}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
