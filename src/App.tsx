import { useState } from "react";
import { ExportDialog, type ExportDialogOptions } from "./components/ExportDialog";
import { Inspector } from "./components/Inspector";
import { LayersPanel } from "./components/LayersPanel";
import { Toolbar, type AddLayerKind, type EditorTool } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { addLayer } from "./editor/document";
import { createHistory, pushHistory, redo, undo } from "./editor/history";
import { sampleDocument } from "./editor/sample";
import { polygonPointsToPath, renderDocumentSvg, starPointsToPath } from "./editor/svg";
import type { LogoDocument, NewLayerInput } from "./editor/types";

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
      path: polygonPointsToPath(centerX, centerY, 68, 6),
    };
  }

  if (kind === "star") {
    return {
      ...base,
      type: "path",
      name: "Star",
      path: starPointsToPath(centerX, centerY, 74, 34, 5),
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
    path: `M ${Math.round(centerX - 72)} ${Math.round(centerY)} L ${Math.round(centerX + 72)} ${Math.round(centerY)}`,
  };
}

export default function App() {
  const [history, setHistory] = useState(() => createHistory(sampleDocument));
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(sampleDocument.selectedLayerIds);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [exportOpen, setExportOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(sampleDocument.settings.snapToGrid);
  const [zoom] = useState(1);
  const document = history.present;
  const selectedLayerId = selectedLayerIds[0];
  const sampleSvg = renderDocumentSvg(document);

  function commitDocument(nextDocument: LogoDocument) {
    const availableLayerIds = new Set(nextDocument.layers.map((layer) => layer.id));
    const nextSelectedLayerIds = nextDocument.selectedLayerIds.filter((id) => availableLayerIds.has(id));

    setHistory((current) => pushHistory(current, { ...nextDocument, selectedLayerIds: nextSelectedLayerIds }));
    setSelectedLayerIds(nextSelectedLayerIds);
    setSnapToGrid(nextDocument.settings.snapToGrid);
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

  function handleDownload(_options: ExportDialogOptions) {
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
          <div
            className="canvas-stage"
            data-grid={showGrid}
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: sampleSvg }}
          />
        </section>
        <LayersPanel
          document={document}
          selectedLayerIds={selectedLayerIds}
          onSelectLayer={(layerId) => replaceSelection([layerId])}
          onChangeDocument={commitDocument}
        />
        <Inspector document={document} selectedLayerId={selectedLayerId} onChangeDocument={commitDocument} />
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
