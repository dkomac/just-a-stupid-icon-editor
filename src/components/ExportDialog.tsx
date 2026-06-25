import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExportOptions, LogoDocument } from "../editor/types";
import { CheckboxField, ColorField, IconButton, NumberField, SelectField } from "./ui";

export interface ExportDialogOptions extends ExportOptions {
  transparent: boolean;
}

interface ExportDialogProps {
  open: boolean;
  document: LogoDocument;
  onClose: () => void;
  onDownload: (options: ExportDialogOptions) => void;
}

const formats: Array<{ value: ExportOptions["format"]; label: string }> = [
  { value: "svg", label: "SVG" },
  { value: "jpg", label: "JPG" },
  { value: "pdf", label: "PDF" },
  { value: "webm", label: "WebM" },
];

function supportsTransparency(format: ExportOptions["format"]): boolean {
  return format === "svg" || format === "webm";
}

export function ExportDialog({ open, document, onClose, onDownload }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [format, setFormat] = useState<ExportOptions["format"]>("svg");
  const [width, setWidth] = useState(document.settings.width);
  const [height, setHeight] = useState(document.settings.height);
  const [background, setBackground] = useState(document.settings.background);
  const [transparent, setTransparent] = useState(false);
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(1);
  const transparentAvailable = supportsTransparency(format);
  const normalizedOptions = useMemo<ExportDialogOptions>(
    () => ({
      format,
      width: Math.max(1, width),
      height: Math.max(1, height),
      background: transparent && transparentAvailable ? "transparent" : background,
      transparent: transparent && transparentAvailable,
      quality: format === "jpg" || format === "webm" ? quality : undefined,
      scale: Math.max(1, scale),
    }),
    [background, format, height, quality, scale, transparent, transparentAvailable, width],
  );

  function closeDialog() {
    const dialog = dialogRef.current;

    if (dialog?.open && typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog?.removeAttribute("open");
    }

    onClose();
    restoreFocusRef.current?.focus();
    restoreFocusRef.current = null;
  }

  useEffect(() => {
    if (open) {
      setWidth(document.settings.width);
      setHeight(document.settings.height);
      setBackground(document.settings.background);
    }
  }, [document.settings.background, document.settings.height, document.settings.width, open]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!open) {
      if (dialog.open && typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }

      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
      return;
    }

    restoreFocusRef.current = globalThis.document.activeElement as HTMLElement | null;

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute("open", "");
    }

    dialog.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="export-dialog"
      aria-labelledby="export-title"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDialog();
        }
      }}
    >
      <div className="dialog-heading">
        <h2 id="export-title">Export</h2>
        <IconButton label="Close export dialog" icon={<X size={17} />} onClick={closeDialog} />
      </div>
      <div className="field-stack">
        <SelectField label="Format" value={format} options={formats} onChange={setFormat} />
        <div className="field-grid">
          <NumberField label="Width" value={width} min={1} commitOn="change" onChange={setWidth} />
          <NumberField label="Height" value={height} min={1} commitOn="change" onChange={setHeight} />
        </div>
        <ColorField
          label="Background"
          value={background}
          disabled={transparent && transparentAvailable}
          commitOn="change"
          onChange={setBackground}
        />
        <CheckboxField
          label="Transparent background"
          checked={transparent && transparentAvailable}
          disabled={!transparentAvailable}
          onChange={setTransparent}
        />
        <div className="field-grid">
          <NumberField label="Scale" value={scale} min={1} step={0.5} commitOn="change" onChange={setScale} />
          <NumberField
            label="Quality"
            value={quality}
            min={0.1}
            max={1}
            step={0.01}
            disabled={format !== "jpg" && format !== "webm"}
            commitOn="change"
            onChange={setQuality}
          />
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={closeDialog}>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={() => onDownload(normalizedOptions)}>
          Download
        </button>
      </div>
    </dialog>
  );
}
