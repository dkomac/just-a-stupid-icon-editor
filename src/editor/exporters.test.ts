import { afterEach, describe, expect, it, vi } from "vitest";
import { addLayer, applyMask, createDocument } from "./document";
import {
  createJpgBlob,
  createPdfBlob,
  createSvgBlob,
  createWebmBlob,
  downloadBlob,
  getWebmSupport,
  normalizeExportOptions,
} from "./exporters";

describe("exporters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("normalizes export dimensions and background", () => {
    expect(normalizeExportOptions({ format: "jpg", width: 0, height: -1, background: "transparent" })).toMatchObject({
      format: "jpg",
      width: 1024,
      height: 1024,
      background: "#ffffff",
    });
  });

  it("rounds and clamps oversized export dimensions and scale", () => {
    expect(normalizeExportOptions({ format: "jpg", width: 12.6, height: 20_000, scale: 10 })).toMatchObject({
      width: 13,
      height: 8192,
      scale: 4,
    });
  });

  it("creates an svg blob from the document", async () => {
    const blob = createSvgBlob(createDocument());

    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toContain("<svg");
  });

  it("creates transparent svg exports without an opaque background rect", async () => {
    const blob = createSvgBlob(createDocument(), { background: "transparent" });
    const svg = await blob.text();

    expect(svg).not.toContain('fill="#ffffff"');
    expect(svg).not.toContain('<rect width="100%" height="100%"');
  });

  it("reports webm support from MediaRecorder", () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });

    expect(getWebmSupport()).toMatchObject({ supported: true, mimeType: "video/webm" });
  });

  it("creates a jpg blob from rasterized svg output", async () => {
    const raster = installRasterMocks({
      blob: new Blob(["jpg"], { type: "image/jpeg" }),
    });

    const blob = await createJpgBlob(createDocument(), { format: "jpg", width: 256, height: 128, background: "#ffffff", scale: 2, quality: 0.8 });

    expect(blob.type).toBe("image/jpeg");
    expect(raster.canvas.width).toBe(512);
    expect(raster.canvas.height).toBe(256);
    expect(raster.drawImage).toHaveBeenCalledOnce();
    expect(raster.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);
    expect(raster.renderedSvg()).toContain("<svg");
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

  it("rejects webm export when recording is unsupported", async () => {
    vi.stubGlobal("MediaRecorder", undefined);

    await expect(createWebmBlob(createDocument(), { format: "webm", width: 128, height: 128, background: "#ffffff", scale: 1 })).rejects.toThrow(
      "MediaRecorder is not available",
    );
  });

  it("records webm output and stops stream tracks", async () => {
    vi.useFakeTimers();
    const raster = installRasterMocks({ stream: true });
    const recorder = installMediaRecorderMock();

    const promise = createWebmBlob(createDocument(), { format: "webm", width: 128, height: 128, background: "#ffffff", scale: 1 });
    await vi.runAllTimersAsync();
    const blob = await promise;

    expect(blob.type).toBe("video/webm");
    expect(raster.trackStop).toHaveBeenCalledOnce();
    expect(recorder.start).toHaveBeenCalledOnce();
    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(recorder.removeEventListener).toHaveBeenCalledWith("dataavailable", expect.any(Function));
    expect(recorder.removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(recorder.removeEventListener).toHaveBeenCalledWith("stop", expect.any(Function));
  });

  it("records transparent webm frames without filling an opaque background", async () => {
    vi.useFakeTimers();
    const raster = installRasterMocks({ stream: true });
    installMediaRecorderMock();

    const promise = createWebmBlob(createDocument(), { format: "webm", width: 128, height: 128, background: "transparent", scale: 1 });
    await vi.runAllTimersAsync();
    await promise;

    expect(raster.fillRect).not.toHaveBeenCalled();
    expect(raster.renderedSvg()).not.toContain('<rect width="100%" height="100%"');
  });

  it("stops webm stream tracks when rendering fails", async () => {
    const raster = installRasterMocks({ stream: true, failImage: true });
    const recorder = installMediaRecorderMock();

    await expect(createWebmBlob(createDocument(), { format: "webm", width: 128, height: 128, background: "#ffffff", scale: 1 })).rejects.toThrow(
      "Unable to load SVG",
    );

    expect(raster.trackStop).toHaveBeenCalledOnce();
    expect(recorder.removeEventListener).toHaveBeenCalledWith("dataavailable", expect.any(Function));
    expect(recorder.removeEventListener).toHaveBeenCalledWith("error", expect.any(Function));
    expect(recorder.removeEventListener).toHaveBeenCalledWith("stop", expect.any(Function));
  });

  it("downloads a blob with body insertion and object url cleanup", () => {
    const { appendChild, remove, revokeObjectURL } = installDownloadMocks();
    const blob = new Blob(["svg"], { type: "image/svg+xml" });

    downloadBlob(blob, "logo.svg");

    expect(appendChild).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:logo");
  });

  it("cleans up download object urls when click throws", () => {
    const { remove, revokeObjectURL } = installDownloadMocks({ clickError: new Error("blocked") });
    const blob = new Blob(["svg"], { type: "image/svg+xml" });

    expect(() => downloadBlob(blob, "logo.svg")).toThrow("blocked");
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:logo");
  });
});

function installRasterMocks(options: { blob?: Blob | null; stream?: boolean; failImage?: boolean } = {}) {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const toBlob = vi.fn((callback: BlobCallback) => callback(options.blob ?? new Blob(["jpg"], { type: "image/jpeg" })));
  const toDataURL = vi.fn(
    () =>
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z",
  );
  const trackStop = vi.fn();
  const stream = { getTracks: () => [{ stop: trackStop }] };
  let imageSource = "";
  let canvas: HTMLCanvasElement;
  const context = {
    fillStyle: "",
    fillRect,
    drawImage,
  };

  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName) as HTMLElement;

    if (tagName === "canvas") {
      canvas = element as HTMLCanvasElement;
      Object.defineProperties(canvas, {
        getContext: { value: vi.fn(() => context) },
        toBlob: { value: toBlob },
        toDataURL: { value: toDataURL },
        captureStream: { value: options.stream ? vi.fn(() => stream) : undefined },
      });
    }

    return element;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(toDataURL);
  vi.stubGlobal(
    "Image",
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(value: string) {
        imageSource = value;
        queueMicrotask(() => {
          if (options.failImage) {
            this.onerror?.();
            return;
          }

          this.onload?.();
        });
      }

      get src() {
        return imageSource;
      }
    },
  );

  return {
    get canvas() {
      return canvas;
    },
    drawImage,
    fillRect,
    toBlob,
    toDataURL,
    trackStop,
    renderedSvg: () => decodeURIComponent(imageSource.replace(/^data:image\/svg\+xml;charset=utf-8,/, "")),
  };
}

function installMediaRecorderMock() {
  const listeners = new Map<string, EventListener[]>();
  const start = vi.fn();
  const removeEventListener = vi.fn((event: string, listener: EventListener) => {
    listeners.set(
      event,
      (listeners.get(event) ?? []).filter((candidate) => candidate !== listener),
    );
  });
  const stop = vi.fn(() => {
    listeners.get("dataavailable")?.forEach((listener) => listener({ data: new Blob(["webm"], { type: "video/webm" }) } as BlobEvent));
    listeners.get("stop")?.forEach((listener) => listener(new Event("stop")));
  });

  vi.stubGlobal(
    "MediaRecorder",
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      start = start;
      stop = stop;
      addEventListener = vi.fn((event: string, listener: EventListener) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      });
      removeEventListener = removeEventListener;
    },
  );

  return { start, stop, removeEventListener };
}

function installDownloadMocks(options: { clickError?: Error } = {}) {
  const appendChild = vi.fn((node: Node) => node);
  const remove = vi.fn();
  const click = vi.fn(() => {
    if (options.clickError) {
      throw options.clickError;
    }
  });
  const anchor = {
    click,
    remove,
    href: "",
    download: "",
    rel: "",
  } as unknown as HTMLAnchorElement;
  const createObjectURL = vi.fn(() => "blob:logo");
  const revokeObjectURL = vi.fn();

  vi.spyOn(document, "createElement").mockReturnValue(anchor);
  vi.spyOn(document.body, "appendChild").mockImplementation(appendChild);
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

  return { appendChild, remove, click, createObjectURL, revokeObjectURL };
}
