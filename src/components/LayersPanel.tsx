import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  clearLayers,
  deleteLayer,
  duplicateLayer,
  moveLayer,
  toggleLayerLocked,
  toggleLayerVisible,
} from "../editor/document";
import type { LogoDocument, LogoLayer } from "../editor/types";
import { IconButton } from "./ui";

interface LayersPanelProps {
  document: LogoDocument;
  selectedLayerIds: string[];
  onSelectLayer: (layerId: string, additive?: boolean) => void;
  onChangeDocument: (document: LogoDocument) => void;
}

function renameLayer(document: LogoDocument, layerId: string, name: string): LogoDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === layerId ? { ...layer, name } : layer)),
  };
}

function LayerRenameField({
  layer,
  onRename,
}: {
  layer: LogoLayer;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(layer.name);
  const skipNextBlurCommit = useRef(false);

  useEffect(() => {
    setName(layer.name);
  }, [layer.name]);

  function commit(nextName = name) {
    if (nextName !== layer.name) {
      onRename(nextName);
    }
  }

  return (
    <input
      className="layer-rename"
      aria-label={`Rename ${layer.name}`}
      title={`Rename ${layer.name}`}
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => {
        if (skipNextBlurCommit.current) {
          skipNextBlurCommit.current = false;
          return;
        }

        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          skipNextBlurCommit.current = true;
          commit(event.currentTarget.value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function LayersPanel({ document, selectedLayerIds, onSelectLayer, onChangeDocument }: LayersPanelProps) {
  const [draggingLayerId, setDraggingLayerId] = useState<string>();
  const visibleLayers = [...document.layers].reverse();

  function reorderLayerBefore(draggedLayerId: string, targetLayerId: string): LogoDocument {
    if (draggedLayerId === targetLayerId) {
      return document;
    }

    const nextVisibleLayers = visibleLayers.filter((layer) => layer.id !== draggedLayerId);
    const draggedLayer = document.layers.find((layer) => layer.id === draggedLayerId);
    const targetVisibleIndex = nextVisibleLayers.findIndex((layer) => layer.id === targetLayerId);

    if (!draggedLayer || targetVisibleIndex === -1) {
      return document;
    }

    nextVisibleLayers.splice(targetVisibleIndex, 0, draggedLayer);

    return {
      ...document,
      layers: [...nextVisibleLayers].reverse(),
    };
  }

  return (
    <aside className="side-panel layers-panel" aria-label="Layers" role="region">
      <div className="panel-heading">
        <h2>Layers</h2>
        <div className="panel-heading-actions">
          <span>{document.layers.length}</span>
          <button
            type="button"
            className="secondary-button clear-layers-button"
            aria-label="Clear all layers"
            title="Clear all layers"
            disabled={document.layers.length === 0}
            onClick={() => onChangeDocument(clearLayers(document))}
          >
            Clear all
          </button>
        </div>
      </div>
      <div className="layer-list" aria-label="Layer list">
        {document.layers.length === 0 ? (
          <p className="empty-note">Add a shape to start building your logo.</p>
        ) : (
          visibleLayers.map((layer) => {
            const selected = selectedLayerIds.includes(layer.id);
            const maskStatus = layer.maskedBy ? "Masked" : layer.maskFor?.length ? "Mask" : "";
            const stackIndex = document.layers.findIndex((candidate) => candidate.id === layer.id);

            return (
              <article
                key={layer.id}
                className="layer-row"
                data-selected={selected}
                data-dragging={draggingLayerId === layer.id}
                draggable
                aria-label={`Layer ${layer.name}`}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", layer.id);
                  setDraggingLayerId(layer.id);
                }}
                onDragEnd={() => setDraggingLayerId(undefined)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedLayerId = event.dataTransfer.getData("text/plain") || draggingLayerId;
                  setDraggingLayerId(undefined);

                  if (draggedLayerId && draggedLayerId !== layer.id) {
                    onChangeDocument(reorderLayerBefore(draggedLayerId, layer.id));
                  }
                }}
              >
                <button
                  type="button"
                  className="layer-select"
                  aria-label={`Select layer ${layer.name}`}
                  aria-pressed={selected}
                  title={`Select layer ${layer.name}`}
                  onClick={(event) => onSelectLayer(layer.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                >
                  <span className="layer-kind">{layer.type}</span>
                  <span className="layer-name">{layer.name}</span>
                  {maskStatus ? <span className="mask-badge">{maskStatus}</span> : null}
                </button>
                <LayerRenameField
                  layer={layer}
                  onRename={(name) => onChangeDocument(renameLayer(document, layer.id, name))}
                />
                <div className="layer-actions">
                  <IconButton
                    label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                    icon={layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    pressed={layer.visible}
                    onClick={() => onChangeDocument(toggleLayerVisible(document, layer.id))}
                  />
                  <IconButton
                    label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                    icon={layer.locked ? <Lock size={15} /> : <Unlock size={15} />}
                    pressed={layer.locked}
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
                    disabled={stackIndex === document.layers.length - 1}
                    onClick={() => onChangeDocument(moveLayer(document, layer.id, stackIndex + 1))}
                  />
                  <IconButton
                    label={`Move ${layer.name} down`}
                    icon={<ArrowDown size={15} />}
                    disabled={stackIndex === 0}
                    onClick={() => onChangeDocument(moveLayer(document, layer.id, stackIndex - 1))}
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
