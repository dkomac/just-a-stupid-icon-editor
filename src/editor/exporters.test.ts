import { describe, expect, it, vi } from "vitest";
import { createDocument } from "./document";
import {
  createPdfBlob,
  createSvgBlob,
  getWebmSupport,
  normalizeExportOptions,
} from "./exporters";

describe("exporters", () => {
  it("normalizes export dimensions and background", () => {
    expect(normalizeExportOptions({ format: "jpg", width: 0, height: -1, background: "transparent" })).toMatchObject({
      format: "jpg",
      width: 1024,
      height: 1024,
      background: "#ffffff",
    });
  });

  it("creates an svg blob from the document", async () => {
    const blob = createSvgBlob(createDocument());

    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toContain("<svg");
  });

  it("reports webm support from MediaRecorder", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });

    expect(getWebmSupport()).toMatchObject({ supported: true, mimeType: "video/webm" });
  });

  it("creates a pdf blob", () => {
    const blob = createPdfBlob(createDocument(), { format: "pdf", width: 512, height: 512, background: "#ffffff", scale: 1 });

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });
});
