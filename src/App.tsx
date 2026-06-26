import { useState } from "react";
import { CanvasStage } from "./components/CanvasStage";
import { ExportDialog } from "./components/ExportDialog";
import { Inspector } from "./components/Inspector";
import { LayersPanel } from "./components/LayersPanel";
import { Toolbar, type AddLayerKind, type EditorTool } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { addLayer, applyMask, releaseMask } from "./editor/document";
import { createHistory, pushHistory, redo, undo } from "./editor/history";
import { sampleDocument } from "./editor/sample";
import { polygonPointsToPath, starPointsToPath } from "./editor/svg";
import type { ExportOptions, LogoDocument, NewLayerInput } from "./editor/types";

function createLayerInput(kind: AddLayerKind, document: LogoDocument): NewLayerInput {
  const centerX = document.settings.width / 2;
  const centerY = document.settings.height / 2;
  const base = {
    x: Math.round(centerX - 64),
    y: Math.round(centerY - 64),
    width: 128,
    height: 128,
    fill: "#2ec4b6",
    stroke: "#14213d",
    strokeWidth: 4,
  };

  if (kind === "rect") {
    return { ...base, type: "rect", name: "Rectangle", cornerRadius: 12 };
  }

  if (kind === "ellipse") {
    return { ...base, type: "ellipse", name: "Ellipse" };
  }

  if (kind === "text") {
    return {
      ...base,
      type: "text",
      name: "Text",
      height: 72,
      text: "Logo",
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 800,
      fill: "#14213d",
      strokeWidth: 0,
    };
  }

  if (kind === "polygon") {
    return {
      ...base,
      type: "path",
      name: "Polygon",
      path: polygonPointsToPath(50, 50, 46, 6),
    };
  }

  if (kind === "star") {
    return {
      ...base,
      type: "path",
      name: "Star",
      path: starPointsToPath(50, 50, 48, 22, 5),
      fill: "#ffb703",
    };
  }

  return {
    ...base,
    type: "path",
    name: "Line",
    height: 24,
    fill: "transparent",
    strokeWidth: 8,
    path: "M 0 50 L 100 50",
  };
}

export default function App() {
  const [history, setHistory] = useState(() => createHistory(sampleDocument));
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(sampleDocument.selectedLayerIds);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [exportOpen, setExportOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(sampleDocument.settings.snapToGrid);
  const [selectedMaskLayerId, setSelectedMaskLayerId] = useState<string>();
  const [zoom] = useState(1);
  const document = history.present;
  const selectedLayerId = selectedLayerIds[0];

  function commitDocument(nextDocument: LogoDocument) {
    const availableLayerIds = new Set(nextDocument.layers.map((layer) => layer.id));
    const nextSelectedLayerIds = nextDocument.selectedLayerIds.filter((id) => availableLayerIds.has(id));

    setHistory((current) => pushHistory(current, { ...nextDocument, selectedLayerIds: nextSelectedLayerIds }));
    setSelectedLayerIds(nextSelectedLayerIds);
    setSnapToGrid(nextDocument.settings.snapToGrid);
    setSelectedMaskLayerId((current) => (current && availableLayerIds.has(current) ? current : undefined));
  }

  function replaceSelection(layerIds: string[]) {
    setSelectedLayerIds(layerIds);
    setHistory((current) => ({
      ...current,
      present: {
        ...current.present,
        selectedLayerIds: layerIds,
      },
    }));
  }

  function handleSelectLayer(layerId: string, additive = false) {
    if (!additive) {
      replaceSelection([layerId]);
      return;
    }

    const nextLayerIds = selectedLayerIds.includes(layerId)
      ? selectedLayerIds.filter((id) => id !== layerId)
      : [...selectedLayerIds, layerId];

    replaceSelection(nextLayerIds.length > 0 ? nextLayerIds : [layerId]);
  }

  function handleAddLayer(kind: AddLayerKind) {
    const nextDocument = addLayer(document, createLayerInput(kind, document));
    commitDocument(nextDocument);
  }

  function handleRenameDocument(name: string) {
    commitDocument({ ...document, name });
  }

  function handleToggleSnap() {
    const nextSnap = !snapToGrid;
    commitDocument({
      ...document,
      settings: {
        ...document.settings,
        snapToGrid: nextSnap,
      },
    });
  }

  function handleUndo() {
    setHistory((current) => {
      const next = undo(current);
      setSelectedLayerIds(next.present.selectedLayerIds);
      setSnapToGrid(next.present.settings.snapToGrid);
      return next;
    });
  }

  function handleRedo() {
    setHistory((current) => {
      const next = redo(current);
      setSelectedLayerIds(next.present.selectedLayerIds);
      setSnapToGrid(next.present.settings.snapToGrid);
      return next;
    });
  }

  function handleUseSelectedLayerAsMask(layerId: string) {
    setSelectedMaskLayerId(layerId);
  }

  function handleApplySelectedMask(targetLayerId: string) {
    if (!selectedMaskLayerId || selectedMaskLayerId === targetLayerId) {
      return;
    }

    commitDocument(applyMask(document, selectedMaskLayerId, targetLayerId));
  }

  function handleReleaseSelectedMask(targetLayerId: string) {
    commitDocument(releaseMask(document, targetLayerId));
  }

  async function handleDownload(options: ExportOptions) {
    const { createJpgBlob, createPdfBlob, createSvgBlob, createWebmBlob, downloadBlob } = await import("./editor/exporters");
    const blob =
      options.format === "svg"
        ? createSvgBlob(document, options)
        : options.format === "jpg"
          ? await createJpgBlob(document, options)
          : options.format === "pdf"
            ? await createPdfBlob(document, options)
            : await createWebmBlob(document, options);

    downloadBlob(blob, `${document.name}.${options.format}`);
    setExportOpen(false);
  }

  return (
    <main className="app-shell">
      <TopBar
        documentName={document.name}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        zoom={zoom}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        onRenameDocument={handleRenameDocument}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleGrid={() => setShowGrid((current) => !current)}
        onToggleSnap={handleToggleSnap}
        onOpenExport={() => setExportOpen(true)}
      />
      <section className="editor-grid">
        <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} onAddLayer={handleAddLayer} />
        <section className="canvas-wrap" aria-label="Logo canvas" role="region">
          <CanvasStage
            document={document}
            selectedLayerIds={selectedLayerIds}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            onSelectLayer={handleSelectLayer}
            onChangeDocument={commitDocument}
          />
        </section>
        <LayersPanel
          document={document}
          selectedLayerIds={selectedLayerIds}
          onSelectLayer={handleSelectLayer}
          onChangeDocument={commitDocument}
        />
        <Inspector
          document={document}
          selectedLayerId={selectedLayerId}
          selectedLayerIds={selectedLayerIds}
          maskLayerId={selectedMaskLayerId}
          onUseSelectedLayerAsMask={handleUseSelectedLayerAsMask}
          onApplySelectedMaskToSelectedTarget={handleApplySelectedMask}
          onReleaseMaskFromSelectedTarget={handleReleaseSelectedMask}
          onChangeDocument={commitDocument}
        />
      </section>
      <ExportDialog
        open={exportOpen}
        document={document}
        onClose={() => setExportOpen(false)}
        onDownload={handleDownload}
      />
    </main>
  );
}
