import { jsPDF } from "jspdf";
import { renderDocumentSvg } from "./svg";
import type { ExportOptions, LogoDocument } from "./types";

export type ExportFormat = ExportOptions["format"];

const DEFAULT_SIZE = 1024;
const DEFAULT_BACKGROUND = "#ffffff";
const DEFAULT_SCALE = 1;
const MAX_EXPORT_DIMENSION = 8192;
const MAX_EXPORT_SCALE = 4;
const DEFAULT_JPG_QUALITY = 0.92;
const WEBM_DURATION_MS = 2000;
const WEBM_FPS = 30;
const WEBM_MIME_TYPES = ["video/webm", "video/webm;codecs=vp9", "video/webm;codecs=vp8"];

export function normalizeExportOptions(input: Partial<ExportOptions> & { format: ExportFormat }): ExportOptions {
  const width = clampNumber(positiveInteger(input.width, DEFAULT_SIZE), 1, MAX_EXPORT_DIMENSION);
  const height = clampNumber(positiveInteger(input.height, DEFAULT_SIZE), 1, MAX_EXPORT_DIMENSION);
  const scale = clampNumber(positiveFiniteNumber(input.scale, DEFAULT_SCALE), 0.1, MAX_EXPORT_SCALE);
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
  const canvas = await renderSvgToCanvas(renderExportSvg(document, exportOptions), exportOptions);

  return canvasToBlob(canvas, "image/jpeg", exportOptions.quality ?? DEFAULT_JPG_QUALITY);
}

export async function createPdfBlob(document: LogoDocument, options: ExportOptions): Promise<Blob> {
  const exportOptions = normalizeExportOptions(options);
  const svg = renderExportSvg(document, exportOptions);
  const canvas = await renderSvgToCanvas(svg, exportOptions);
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
  pdf.addImage(
    canvas.toDataURL("image/jpeg", exportOptions.quality ?? DEFAULT_JPG_QUALITY),
    "JPEG",
    0,
    0,
    exportOptions.width,
    exportOptions.height,
  );

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
  let onDataAvailable: EventListener | undefined;
  let onError: EventListener | undefined;
  let onStop: EventListener | undefined;
  const cleanup = () => {
    if (onDataAvailable) {
      recorder.removeEventListener("dataavailable", onDataAvailable);
    }

    if (onError) {
      recorder.removeEventListener("error", onError);
    }

    if (onStop) {
      recorder.removeEventListener("stop", onStop);
    }

    stream.getTracks().forEach((track) => track.stop());
  };
  const stopped = new Promise<Blob>((resolve, reject) => {
    onDataAvailable = (event) => {
      const data = (event as BlobEvent).data;

      if (data.size > 0) {
        chunks.push(data);
      }
    };
    onError = () => reject(new Error("WebM recording failed."));
    onStop = () => resolve(new Blob(chunks, { type: support.mimeType }));

    recorder.addEventListener("dataavailable", onDataAvailable);
    recorder.addEventListener("error", onError);
    recorder.addEventListener("stop", onStop);
  });

  try {
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

    return await stopped;
  } finally {
    cleanup();
  }
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

  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
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

async function renderSvgToCanvas(svg: string, options: ExportOptions): Promise<HTMLCanvasElement> {
  const canvas = createExportCanvas(options);
  const context = get2dContext(canvas);
  const image = await loadSvgImage(svg);

  fillCanvasBackground(context, options);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
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

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function positiveFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBackground(value: string | undefined): string {
  const background = value?.trim();

  if (!background || background === "transparent") {
    return DEFAULT_BACKGROUND;
  }

  return background;
}

function clampQuality(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_JPG_QUALITY;
  }

  return Math.min(1, Math.max(0, value));
}
