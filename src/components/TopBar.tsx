import type { CSSProperties } from "react";
import { Download, Eye, Grid2X2, Magnet, Redo2, Undo2 } from "lucide-react";
import { IconButton, TextField } from "./ui";

export interface PreviewBackgroundOption {
  label: string;
  value: string;
}

interface TopBarProps {
  documentName: string;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  previewMode: boolean;
  previewBackground: string;
  previewBackgrounds: PreviewBackgroundOption[];
  onRenameDocument: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onTogglePreview: () => void;
  onChangePreviewBackground: (background: string) => void;
  onOpenExport: () => void;
}

function colorPickerValue(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
}

export function TopBar({
  documentName,
  canUndo,
  canRedo,
  zoom,
  showGrid,
  snapToGrid,
  previewMode,
  previewBackground,
  previewBackgrounds,
  onRenameDocument,
  onUndo,
  onRedo,
  onToggleGrid,
  onToggleSnap,
  onTogglePreview,
  onChangePreviewBackground,
  onOpenExport,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>Logo Creator</h1>
        <TextField label="Document name" value={documentName} onChange={onRenameDocument} />
      </div>
      <div className="topbar-actions">
        <IconButton label="Undo" icon={<Undo2 size={17} strokeWidth={2} />} disabled={!canUndo} onClick={onUndo} />
        <IconButton label="Redo" icon={<Redo2 size={17} strokeWidth={2} />} disabled={!canRedo} onClick={onRedo} />
        <span className="zoom-pill" aria-label={`Zoom ${Math.round(zoom * 100)} percent`} title="Zoom">
          {Math.round(zoom * 100)}%
        </span>
        <IconButton
          label={showGrid ? "Hide grid" : "Show grid"}
          icon={<Grid2X2 size={17} strokeWidth={2} />}
          pressed={showGrid}
          onClick={onToggleGrid}
        />
        <IconButton
          label={snapToGrid ? "Disable snapping" : "Enable snapping"}
          icon={<Magnet size={17} strokeWidth={2} />}
          pressed={snapToGrid}
          onClick={onToggleSnap}
        />
        <IconButton label="Preview" icon={<Eye size={17} strokeWidth={2} />} pressed={previewMode} onClick={onTogglePreview} />
        {previewMode ? (
          <div className="preview-backgrounds" role="group" aria-label="Preview backgrounds">
            {previewBackgrounds.map((background) => (
              <button
                key={`${background.label}-${background.value}`}
                type="button"
                className="background-swatch"
                style={{ "--preview-background": background.value } as CSSProperties}
                data-transparent={background.value === "transparent"}
                aria-label={`${background.label} background`}
                aria-pressed={previewBackground === background.value}
                title={`${background.label} background`}
                onClick={() => onChangePreviewBackground(background.value)}
              />
            ))}
            <input
              type="color"
              className="preview-color-picker"
              aria-label="Custom preview background"
              title="Custom preview background"
              value={colorPickerValue(previewBackground)}
              onChange={(event) => onChangePreviewBackground(event.currentTarget.value)}
            />
          </div>
        ) : null}
        <button type="button" className="primary-button" title="Export" onClick={onOpenExport}>
          <Download size={16} strokeWidth={2} aria-hidden="true" />
          Export
        </button>
      </div>
    </header>
  );
}
