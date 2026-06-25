import { jsPDF } from "jspdf";
import { renderDocumentSvg } from "./svg";
import type { ExportOptions, LogoDocument, LogoLayer } from "./types";

export type ExportFormat = ExportOptions["format"];

const DEFAULT_SIZE = 1024;
const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_SCALE = 1;
const DEFAULT_JPG_QUALITY = 0.92;
const WEBM_DURATION_MS = 2000;
const WEBM_FPS = 30;
const WEBM_MIME_TYPES = ["video/webm", "video/webm;codecs=vp9", "video/webm;codecs=vp8"];

export function normalizeExportOptions(input: Partial<ExportOptions> & { format: ExportFormat }): ExportOptions {
  const width = positiveNumber(input.width, DEFAULT_SIZE);
  const height = positiveNumber(input.height, DEFAULT_SIZE);
  const scale = positiveNumber(input.scale, DEFAULT_SCALE);
  const background = normalizeBackground(input.background);

  return {
    format: input.format,
    width,
    height,
    background,
    scale,
    quality: clampQuality(input.quality),
  };
}

export function createSvgBlob(document: LogoDocument, options: Partial<ExportOptions> = {}): Blob {
  const svg = renderExportSvg(document, { ...options, format: "svg" });

  return createTextBlob(svg, "image/svg+xml");
}

export async function createJpgBlob(document: LogoDocument, options: ExportOptions): Promise<Blob> {
  const exportOptions = normalizeExportOptions(options);
  const canvas = createExportCanvas(exportOptions);
  const context = get2dContext(canvas);
  const image = await loadSvgImage(renderExportSvg(document, exportOptions));

  fillCanvasBackground(context, exportOptions);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvasToBlob(canvas, "image/jpeg", exportOptions.quality ?? DEFAULT_JPG_QUALITY);
}

export function createPdfBlob(document: LogoDocument, options: ExportOptions): Blob {
  const exportOptions = normalizeExportOptions(options);
  const svg = renderExportSvg(document, exportOptions);
  const pdf = new jsPDF({
    orientation: exportOptions.width >= exportOptions.height ? "landscape" : "portrait",
    unit: "px",
    format: [exportOptions.width, exportOptions.height],
    compress: true,
  });

  pdf.setProperties({
    title: document.name,
    subject: "Logo Creator export",
    creator: "Logo Creator",
  });
  pdf.addMetadata(svg);
  pdf.setFillColor(exportOptions.background);
  pdf.rect(0, 0, exportOptions.width, exportOptions.height, "F");
  drawPdfLayers(pdf, document);

  return pdf.output("blob");
}

export function getWebmSupport(): { supported: boolean; mimeType: string; reason?: string } {
  if (typeof MediaRecorder === "undefined") {
    return { supported: false, mimeType: "video/webm", reason: "MediaRecorder is not available in this browser." };
  }

  const mimeType = WEBM_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));

  if (!mimeType) {
    return { supported: false, mimeType: "video/webm", reason: "WebM recording is not supported in this browser." };
  }

  return { supported: true, mimeType };
}

export async function createWebmBlob(document: LogoDocument, options: ExportOptions): Promise<Blob> {
  const support = getWebmSupport();

  if (!support.supported) {
    throw new Error(support.reason ?? "WebM export is not supported.");
  }

  const exportOptions = normalizeExportOptions(options);
  const canvas = createExportCanvas(exportOptions);
  const stream = captureCanvasStream(canvas, WEBM_FPS);
  const recorder = new MediaRecorder(stream, { mimeType: support.mimeType });
  const chunks: BlobPart[] = [];
  const stopped = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    recorder.addEventListener("error", () => reject(new Error("WebM recording failed.")));
    recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: support.mimeType })));
  });
  const context = get2dContext(canvas);
  const image = await loadSvgImage(renderExportSvg(document, exportOptions));
  const totalFrames = WEBM_DURATION_MS / (1000 / WEBM_FPS);

  recorder.start();

  for (let frame = 0; frame < totalFrames; frame += 1) {
    fillCanvasBackground(context, exportOptions);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    await wait(1000 / WEBM_FPS);
  }

  recorder.stop();

  return stopped;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("Downloads require a browser document and object URL support.");
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderExportSvg(document: LogoDocument, options: Partial<ExportOptions> & { format: ExportFormat }): string {
  const exportOptions = normalizeExportOptions({
    width: document.settings.width,
    height: document.settings.height,
    background: document.settings.background,
    scale: DEFAULT_SCALE,
    ...options,
    format: options.format,
  });

  return renderDocumentSvg({
    ...document,
    settings: {
      ...document.settings,
      width: exportOptions.width,
      height: exportOptions.height,
      background: exportOptions.background,
    },
  });
}

function createExportCanvas(options: ExportOptions): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new Error("Canvas exports require a browser document.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(options.width * options.scale);
  canvas.height = Math.round(options.height * options.scale);

  return canvas;
}

function drawPdfLayers(pdf: jsPDF, document: LogoDocument): void {
  const maskLayerIds = new Set(
    document.layers
      .filter((layer) => (layer.maskFor?.length ?? 0) > 0)
      .map((layer) => layer.id),
  );

  document.layers
    .filter((layer) => layer.visible && !maskLayerIds.has(layer.id))
    .forEach((layer) => drawPdfLayer(pdf, layer));
}

function drawPdfLayer(pdf: jsPDF, layer: LogoLayer): void {
  const fill = pdfPaint(layer.fill, "#111111");
  const stroke = pdfPaint(layer.stroke, fill);
  const hasStroke = layer.strokeWidth > 0 && Boolean(layer.stroke);
  const style = hasStroke ? "FD" : "F";

  pdf.setFillColor(fill);
  pdf.setDrawColor(stroke);
  pdf.setLineWidth(Math.max(0, layer.strokeWidth));

  if (layer.type === "rect") {
    const radius = Math.max(0, Math.min(layer.cornerRadius, layer.width / 2, layer.height / 2));

    if (radius > 0) {
      pdf.roundedRect(layer.x, layer.y, layer.width, layer.height, radius, radius, style);
      return;
    }

    pdf.rect(layer.x, layer.y, layer.width, layer.height, style);
    return;
  }

  if (layer.type === "ellipse") {
    pdf.ellipse(layer.x + layer.width / 2, layer.y + layer.height / 2, layer.width / 2, layer.height / 2, style);
    return;
  }

  if (layer.type === "text") {
    pdf.setTextColor(fill);
    pdf.setFont("helvetica", layer.fontWeight >= 700 ? "bold" : "normal", layer.fontWeight);
    pdf.setFontSize(layer.fontSize);
    pdf.text(layer.text, layer.x, layer.y + layer.height / 2, { baseline: "middle" });
    return;
  }

  if (layer.type === "path") {
    drawPdfPath(pdf, layer.path, hasStroke);
  }
}

function drawPdfPath(pdf: jsPDF, path: string, hasStroke: boolean): void {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let index = 0;
  let command = "";
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let hasPath = false;

  const hasNumber = () => index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]);
  const readNumber = () => Number(tokens[index++]);
  const readPoint = (relative: boolean) => {
    const x = readNumber();
    const y = readNumber();

    return {
      x: relative ? currentX + x : x,
      y: relative ? currentY + y : y,
    };
  };

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) {
      command = tokens[index++];
    }

    const relative = command === command.toLowerCase();

    if (command.toLowerCase() === "m") {
      const point = readPoint(relative);
      pdf.moveTo(point.x, point.y);
      currentX = point.x;
      currentY = point.y;
      startX = point.x;
      startY = point.y;
      hasPath = true;
      command = relative ? "l" : "L";

      while (hasNumber()) {
        const linePoint = readPoint(relative);
        pdf.lineTo(linePoint.x, linePoint.y);
        currentX = linePoint.x;
        currentY = linePoint.y;
      }

      continue;
    }

    if (command.toLowerCase() === "l") {
      while (hasNumber()) {
        const point = readPoint(relative);
        pdf.lineTo(point.x, point.y);
        currentX = point.x;
        currentY = point.y;
      }

      continue;
    }

    if (command.toLowerCase() === "h") {
      while (hasNumber()) {
        const x = readNumber();
        currentX = relative ? currentX + x : x;
        pdf.lineTo(currentX, currentY);
      }

      continue;
    }

    if (command.toLowerCase() === "v") {
      while (hasNumber()) {
        const y = readNumber();
        currentY = relative ? currentY + y : y;
        pdf.lineTo(currentX, currentY);
      }

      continue;
    }

    if (command.toLowerCase() === "c") {
      while (hasNumber()) {
        const controlA = readPoint(relative);
        const controlB = readPoint(relative);
        const point = readPoint(relative);
        pdf.curveTo(controlA.x, controlA.y, controlB.x, controlB.y, point.x, point.y);
        currentX = point.x;
        currentY = point.y;
      }

      continue;
    }

    if (command.toLowerCase() === "q") {
      while (hasNumber()) {
        const control = readPoint(relative);
        const point = readPoint(relative);
        const controlA = {
          x: currentX + (2 / 3) * (control.x - currentX),
          y: currentY + (2 / 3) * (control.y - currentY),
        };
        const controlB = {
          x: point.x + (2 / 3) * (control.x - point.x),
          y: point.y + (2 / 3) * (control.y - point.y),
        };

        pdf.curveTo(controlA.x, controlA.y, controlB.x, controlB.y, point.x, point.y);
        currentX = point.x;
        currentY = point.y;
      }

      continue;
    }

    if (command.toLowerCase() === "z") {
      pdf.close();
      currentX = startX;
      currentY = startY;
      continue;
    }

    break;
  }

  if (hasPath) {
    if (hasStroke) {
      pdf.fillStroke();
      return;
    }

    pdf.fill();
  }
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D rendering is not available.");
  }

  return context;
}

function fillCanvasBackground(context: CanvasRenderingContext2D, options: ExportOptions): void {
  context.fillStyle = options.background;
  context.fillRect(0, 0, options.width * options.scale, options.height * options.scale);
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  if (typeof Image === "undefined") {
    return Promise.reject(new Error("Image loading is not available in this environment."));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = svgObjectUrl(svg);

    image.onload = () => {
      revokeSvgObjectUrl(url);
      resolve(image);
    };
    image.onerror = () => {
      revokeSvgObjectUrl(url);
      reject(new Error("Unable to load SVG for raster export."));
    };
    image.src = url;
  });
}

function svgObjectUrl(svg: string): string {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function revokeSvgObjectUrl(url: string): void {
  if (url.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(new Error("Canvas export did not produce a blob."));
        },
        type,
        quality,
      );
    });
  }

  if (typeof canvas.toDataURL === "function") {
    return Promise.resolve(dataUrlToBlob(canvas.toDataURL(type, quality)));
  }

  return Promise.reject(new Error("Canvas blob export is not available."));
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function createTextBlob(text: string, type: string): Blob {
  const blob = new Blob([text], { type });

  if (typeof blob.text !== "function") {
    Object.defineProperty(blob, "text", {
      value: () => Promise.resolve(text),
    });
  }

  return blob;
}

function captureCanvasStream(canvas: HTMLCanvasElement, fps: number): MediaStream {
  if (typeof canvas.captureStream !== "function") {
    throw new Error("Canvas stream capture is not available in this browser.");
  }

  return canvas.captureStream(fps);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeBackground(value: string | undefined): string {
  const background = value?.trim();

  if (!background || background === "transparent") {
    return DEFAULT_BACKGROUND;
  }

  return background;
}

function pdfPaint(value: string | undefined, fallback: string): string {
  const paint = value?.trim();

  if (paint && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(paint)) {
    return paint;
  }

  return fallback;
}

function clampQuality(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_JPG_QUALITY;
  }

  return Math.min(1, Math.max(0, value));
}
