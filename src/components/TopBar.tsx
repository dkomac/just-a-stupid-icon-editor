import { Download, Grid2X2, Magnet, Redo2, Undo2 } from "lucide-react";
import { IconButton, TextField } from "./ui";

interface TopBarProps {
  documentName: string;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  onRenameDocument: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onOpenExport: () => void;
}

export function TopBar({
  documentName,
  canUndo,
  canRedo,
  zoom,
  showGrid,
  snapToGrid,
  onRenameDocument,
  onUndo,
  onRedo,
  onToggleGrid,
  onToggleSnap,
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
        <span className="zoom-pill" aria-label="Zoom">
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
        <button type="button" className="primary-button" onClick={onOpenExport}>
          <Download size={16} strokeWidth={2} aria-hidden="true" />
          Export
        </button>
      </div>
    </header>
  );
}
