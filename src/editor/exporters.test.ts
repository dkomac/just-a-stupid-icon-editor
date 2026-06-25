import { describe, expect, it, vi } from "vitest";
import { addLayer, applyMask, createDocument } from "./document";
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

  it("creates a pdf blob", async () => {
    installRasterMocks();

    const blob = await createPdfBlob(createDocument(), { format: "pdf", width: 512, height: 512, background: "#ffffff", scale: 1 });

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("creates pdf output from the rendered svg source", async () => {
    const raster = installRasterMocks();
    const withMask = addLayer(createDocument(), { type: "rect", name: "Mask", x: 0, y: 0, width: 100, height: 100 });
    const withTarget = addLayer(withMask, {
      type: "ellipse",
      name: "Target",
      x: 20,
      y: 20,
      width: 120,
      height: 120,
      rotation: 25,
      opacity: 0.5,
    });
    const document = applyMask(withTarget, withTarget.layers[0].id, withTarget.layers[1].id);

    const blob = await createPdfBlob(document, { format: "pdf", width: 512, height: 512, background: "#ffffff", scale: 1 });

    expect(blob.type).toBe("application/pdf");
    expect(raster.drawImage).toHaveBeenCalledOnce();
    expect(raster.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92);
    expect(raster.renderedSvg()).toContain("rotate(25");
    expect(raster.renderedSvg()).toContain('opacity="0.5"');
    expect(raster.renderedSvg()).toContain("<clipPath");
    expect(raster.renderedSvg()).toContain("clip-path=");
  });
});

function installRasterMocks() {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toDataURL = vi.fn(
    () =>
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z",
  );
  let imageSource = "";
  const context = {
    fillStyle: "",
    fillRect,
    drawImage,
  };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);
  vi.stubGlobal(
    "Image",
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(value: string) {
        imageSource = value;
        queueMicrotask(() => this.onload?.());
      }

      get src() {
        return imageSource;
      }
    },
  );

  return {
    drawImage,
    toDataURL,
    renderedSvg: () => decodeURIComponent(imageSource.replace(/^data:image\/svg\+xml;charset=utf-8,/, "")),
  };
}
