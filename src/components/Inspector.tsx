import type { LogoDocument, LogoLayer } from "../editor/types";
import { ColorField, NumberField, PanelSection, TextField } from "./ui";

interface InspectorProps {
  document: LogoDocument;
  selectedLayerId?: string;
  maskLayerId?: string;
  onUseSelectedLayerAsMask?: (layerId: string) => void;
  onApplySelectedMaskToSelectedTarget?: (targetLayerId: string) => void;
  onReleaseMaskFromSelectedTarget?: (targetLayerId: string) => void;
  onChangeDocument: (document: LogoDocument) => void;
}

function updateDocumentSettings(document: LogoDocument, patch: Partial<LogoDocument["settings"]>): LogoDocument {
  return {
    ...document,
    settings: {
      ...document.settings,
      ...patch,
    },
  };
}

function updateLayer(document: LogoDocument, layerId: string, patch: Partial<LogoLayer>): LogoDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? ({ ...layer, ...patch } as LogoLayer) : layer)),
  };
}

export function Inspector({
  document,
  selectedLayerId,
  maskLayerId,
  onUseSelectedLayerAsMask,
  onApplySelectedMaskToSelectedTarget,
  onReleaseMaskFromSelectedTarget,
  onChangeDocument,
}: InspectorProps) {
  const selectedLayer = document.layers.find((layer) => layer.id === selectedLayerId);
  const maskLayer = document.layers.find((layer) => layer.id === maskLayerId);

  if (!selectedLayer) {
    return (
      <aside className="side-panel inspector-panel" aria-label="Inspector" role="region">
        <div className="panel-heading">
          <h2>Inspector</h2>
          <span>Document</span>
        </div>
        <PanelSection title="Document">
          <TextField label="Name" value={document.name} onChange={(name) => onChangeDocument({ ...document, name })} />
          <NumberField
            label="Canvas width"
            value={document.settings.width}
            min={1}
            onChange={(width) => onChangeDocument(updateDocumentSettings(document, { width }))}
          />
          <NumberField
            label="Canvas height"
            value={document.settings.height}
            min={1}
            onChange={(height) => onChangeDocument(updateDocumentSettings(document, { height }))}
          />
          <ColorField
            label="Background"
            value={document.settings.background}
            onChange={(background) => onChangeDocument(updateDocumentSettings(document, { background }))}
          />
          <NumberField
            label="Grid size"
            value={document.settings.gridSize}
            min={1}
            onChange={(gridSize) => onChangeDocument(updateDocumentSettings(document, { gridSize }))}
          />
        </PanelSection>
      </aside>
    );
  }

  const disabled = selectedLayer.locked;

  return (
    <aside className="side-panel inspector-panel" aria-label="Inspector" role="region">
      <div className="panel-heading">
        <h2>Inspector</h2>
        <span>{selectedLayer.locked ? "Locked" : selectedLayer.type}</span>
      </div>
      <PanelSection title="Layer">
        <TextField
          label="Name"
          value={selectedLayer.name}
          disabled={disabled}
          onChange={(name) => onChangeDocument(updateLayer(document, selectedLayer.id, { name }))}
        />
      </PanelSection>
      <PanelSection title="Geometry">
        <div className="field-grid">
          <NumberField
            label="X"
            value={selectedLayer.x}
            disabled={disabled}
            onChange={(x) => onChangeDocument(updateLayer(document, selectedLayer.id, { x }))}
          />
          <NumberField
            label="Y"
            value={selectedLayer.y}
            disabled={disabled}
            onChange={(y) => onChangeDocument(updateLayer(document, selectedLayer.id, { y }))}
          />
          <NumberField
            label="Width"
            value={selectedLayer.width}
            disabled={disabled}
            min={1}
            onChange={(width) => onChangeDocument(updateLayer(document, selectedLayer.id, { width }))}
          />
          <NumberField
            label="Height"
            value={selectedLayer.height}
            disabled={disabled}
            min={1}
            onChange={(height) => onChangeDocument(updateLayer(document, selectedLayer.id, { height }))}
          />
        </div>
        <NumberField
          label="Rotation"
          value={selectedLayer.rotation}
          disabled={disabled}
          step={1}
          onChange={(rotation) => onChangeDocument(updateLayer(document, selectedLayer.id, { rotation }))}
        />
      </PanelSection>
      <PanelSection title="Style">
        <ColorField
          label="Fill"
          value={selectedLayer.fill}
          disabled={disabled}
          onChange={(fill) => onChangeDocument(updateLayer(document, selectedLayer.id, { fill }))}
        />
        <ColorField
          label="Stroke"
          value={selectedLayer.stroke ?? "#000000"}
          disabled={disabled}
          onChange={(stroke) => onChangeDocument(updateLayer(document, selectedLayer.id, { stroke }))}
        />
        <NumberField
          label="Stroke width"
          value={selectedLayer.strokeWidth}
          disabled={disabled}
          min={0}
          onChange={(strokeWidth) => onChangeDocument(updateLayer(document, selectedLayer.id, { strokeWidth }))}
        />
        <NumberField
          label="Opacity"
          value={selectedLayer.opacity}
          disabled={disabled}
          min={0}
          max={1}
          step={0.05}
          onChange={(opacity) => onChangeDocument(updateLayer(document, selectedLayer.id, { opacity }))}
        />
      </PanelSection>
      {selectedLayer.type === "rect" ? (
        <PanelSection title="Shape">
          <NumberField
            label="Corner radius"
            value={selectedLayer.cornerRadius}
            disabled={disabled}
            min={0}
            onChange={(cornerRadius) => onChangeDocument(updateLayer(document, selectedLayer.id, { cornerRadius }))}
          />
        </PanelSection>
      ) : null}
      {selectedLayer.type === "text" ? (
        <PanelSection title="Text">
          <TextField
            label="Text"
            value={selectedLayer.text}
            disabled={disabled}
            onChange={(text) => onChangeDocument(updateLayer(document, selectedLayer.id, { text }))}
          />
          <TextField
            label="Font family"
            value={selectedLayer.fontFamily}
            disabled={disabled}
            onChange={(fontFamily) => onChangeDocument(updateLayer(document, selectedLayer.id, { fontFamily }))}
          />
          <NumberField
            label="Font size"
            value={selectedLayer.fontSize}
            disabled={disabled}
            min={1}
            onChange={(fontSize) => onChangeDocument(updateLayer(document, selectedLayer.id, { fontSize }))}
          />
          <NumberField
            label="Font weight"
            value={selectedLayer.fontWeight}
            disabled={disabled}
            min={100}
            max={900}
            step={100}
            onChange={(fontWeight) => onChangeDocument(updateLayer(document, selectedLayer.id, { fontWeight }))}
          />
        </PanelSection>
      ) : null}
      <PanelSection title="Masking">
        <div className="mask-actions">
          <button
            type="button"
            className="secondary-button"
            title="Use selected layer as mask"
            onClick={() => onUseSelectedLayerAsMask?.(selectedLayer.id)}
          >
            Use selected layer as mask
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!maskLayer || maskLayer.id === selectedLayer.id}
            title="Apply selected mask to selected target"
            onClick={() => onApplySelectedMaskToSelectedTarget?.(selectedLayer.id)}
          >
            Apply selected mask to selected target
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!selectedLayer.maskedBy}
            title="Release mask from selected target"
            onClick={() => onReleaseMaskFromSelectedTarget?.(selectedLayer.id)}
          >
            Release mask from selected target
          </button>
        </div>
        {maskLayer ? <p className="panel-note">Selected mask: {maskLayer.name}</p> : null}
        {selectedLayer.maskedBy || selectedLayer.maskFor?.length ? (
          <p className="panel-note">
            {selectedLayer.maskedBy ? "This layer is clipped by another layer." : "This layer is used as a mask."}
          </p>
        ) : null}
      </PanelSection>
    </aside>
  );
}
