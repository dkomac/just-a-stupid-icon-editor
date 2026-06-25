import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import {
  deleteLayer,
  duplicateLayer,
  moveLayer,
  toggleLayerLocked,
  toggleLayerVisible,
} from "../editor/document";
import type { LogoDocument } from "../editor/types";
import { IconButton } from "./ui";

interface LayersPanelProps {
  document: LogoDocument;
  selectedLayerIds: string[];
  onSelectLayer: (layerId: string) => void;
  onChangeDocument: (document: LogoDocument) => void;
}

function renameLayer(document: LogoDocument, layerId: string, name: string): LogoDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? { ...layer, name } : layer)),
  };
}

export function LayersPanel({ document, selectedLayerIds, onSelectLayer, onChangeDocument }: LayersPanelProps) {
  return (
    <aside className="side-panel layers-panel" aria-label="Layers" role="region">
      <div className="panel-heading">
        <h2>Layers</h2>
        <span>{document.layers.length}</span>
      </div>
      <div className="layer-list">
        {document.layers.length === 0 ? (
          <p className="empty-note">Add a shape to start building your logo.</p>
        ) : (
          document.layers.map((layer, index) => {
            const selected = selectedLayerIds.includes(layer.id);
            const maskStatus = layer.maskedBy ? "Masked" : layer.maskFor?.length ? "Mask" : "";

            return (
              <article key={layer.id} className="layer-row" data-selected={selected}>
                <button
                  type="button"
                  className="layer-select"
                  aria-label={`Select layer ${layer.name}`}
                  aria-pressed={selected}
                  onClick={() => onSelectLayer(layer.id)}
                >
                  <span className="layer-kind">{layer.type}</span>
                  <span className="layer-name">{layer.name}</span>
                  {maskStatus ? <span className="mask-badge">{maskStatus}</span> : null}
                </button>
                <input
                  className="layer-rename"
                  aria-label={`Rename ${layer.name}`}
                  value={layer.name}
                  onChange={(event) => onChangeDocument(renameLayer(document, layer.id, event.target.value))}
                />
                <div className="layer-actions">
                  <IconButton
                    label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                    icon={layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    active={layer.visible}
                    onClick={() => onChangeDocument(toggleLayerVisible(document, layer.id))}
                  />
                  <IconButton
                    label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                    icon={layer.locked ? <Lock size={15} /> : <Unlock size={15} />}
                    active={layer.locked}
                    onClick={() => onChangeDocument(toggleLayerLocked(document, layer.id))}
                  />
                  <IconButton
                    label={`Duplicate ${layer.name}`}
                    icon={<Copy size={15} />}
                    onClick={() => onChangeDocument(duplicateLayer(document, layer.id))}
                  />
                  <IconButton
                    label={`Move ${layer.name} up`}
                    icon={<ArrowUp size={15} />}
                    disabled={index === document.layers.length - 1}
                    onClick={() => onChangeDocument(moveLayer(document, layer.id, index + 1))}
                  />
                  <IconButton
                    label={`Move ${layer.name} down`}
                    icon={<ArrowDown size={15} />}
                    disabled={index === 0}
                    onClick={() => onChangeDocument(moveLayer(document, layer.id, index - 1))}
                  />
                  <IconButton
                    label={`Delete ${layer.name}`}
                    icon={<Trash2 size={15} />}
                    variant="danger"
                    onClick={() => onChangeDocument(deleteLayer(document, layer.id))}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
