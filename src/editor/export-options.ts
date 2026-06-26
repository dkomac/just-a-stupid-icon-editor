import type { ExportOptions } from "./types";

export type ExportFormat = ExportOptions["format"];

export const DEFAULT_EXPORT_SIZE = 1024;
export const DEFAULT_EXPORT_BACKGROUND = "#ffffff";
export const DEFAULT_EXPORT_SCALE = 1;
export const DEFAULT_EXPORT_QUALITY = 0.92;
export const MAX_EXPORT_DIMENSION = 8192;
export const MAX_EXPORT_SCALE = 4;

interface NormalizeExportOptionsConfig {
  allowTransparent?: boolean;
}

export function normalizeExportOptions(
  input: Partial<ExportOptions> & { format: ExportFormat },
  config: NormalizeExportOptionsConfig = {},
): ExportOptions {
  const width = clampNumber(positiveInteger(input.width, DEFAULT_EXPORT_SIZE), 1, MAX_EXPORT_DIMENSION);
  const height = clampNumber(positiveInteger(input.height, DEFAULT_EXPORT_SIZE), 1, MAX_EXPORT_DIMENSION);
  const scale = clampNumber(positiveFiniteNumber(input.scale, DEFAULT_EXPORT_SCALE), 0.1, MAX_EXPORT_SCALE);
  const background = normalizeBackground(input.background, config.allowTransparent ?? false);

  return {
    format: input.format,
    width,
    height,
    background,
    scale,
    quality: clampQuality(input.quality),
  };
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

function normalizeBackground(value: string | undefined, allowTransparent: boolean): string {
  const background = value?.trim();

  if (!background) {
    return DEFAULT_EXPORT_BACKGROUND;
  }

  if (allowTransparent && background.toLowerCase() === "transparent") {
    return "transparent";
  }

  if (background.toLowerCase() === "transparent") {
    return DEFAULT_EXPORT_BACKGROUND;
  }

  return background;
}

function clampQuality(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_EXPORT_QUALITY;
  }

  return Math.min(1, Math.max(0, value));
}
