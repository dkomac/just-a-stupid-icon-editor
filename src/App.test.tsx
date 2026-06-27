import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const exporterMocks = vi.hoisted(() => ({
  createSvgBlob: vi.fn(),
  createJpgBlob: vi.fn(),
  createPdfBlob: vi.fn(),
  createWebmBlob: vi.fn(),
  downloadBlob: vi.fn(),
}));

vi.mock("./editor/exporters", () => exporterMocks);

import App from "./App";

function dispatchPointerEvent(target: Document | Element | Window, type: string, options: { clientX?: number; clientY?: number; pointerId?: number }) {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: options.clientX ?? 0 },
    clientY: { value: options.clientY ?? 0 },
    pointerId: { value: options.pointerId ?? 1 },
  });

  fireEvent(target, event);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App", () => {
  it("opens directly into the logo editor", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Logo Creator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ellipse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Triangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Half circle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Text" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Logo canvas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Layers" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
  });

  it("labels the main editing controls", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Shape tools" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Logo canvas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Layers" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
  });

  it("previews the logo on alternate backgrounds without changing the document", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.queryByRole("navigation", { name: "Shape tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Layers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Inspector" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Preview backgrounds" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dark background" }));

    expect(screen.getByTestId("canvas-background")).toHaveAttribute("fill", "#111827");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    fireEvent.input(screen.getByLabelText("Custom preview background"), { target: { value: "#ff3366" } });

    expect(screen.getByTestId("canvas-background")).toHaveAttribute("fill", "#ff3366");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByLabelText("Background")).toHaveValue("#ffffff");
  });

  it("groups document name typing into a single undo step", async () => {
    const user = userEvent.setup();
    render(<App />);

    const name = screen.getByLabelText("Document name");
    await user.clear(name);
    await user.type(name, "Nova Mark");

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    await user.tab();

    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByLabelText("Document name")).toHaveValue("Sample Logo");
  });

  it("commits document name once when pressing Enter", async () => {
    const user = userEvent.setup();
    render(<App />);

    const name = screen.getByLabelText("Document name");
    await user.clear(name);
    await user.type(name, "Nova Mark");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByLabelText("Document name")).toHaveValue("Sample Logo");
  });

  it("groups a canvas drag into a single undo step", async () => {
    const user = userEvent.setup();
    render(<App />);

    const layer = screen.getByTestId("canvas-layer-sample-wordmark");
    dispatchPointerEvent(layer, "pointerdown", { clientX: 150, clientY: 300 });
    dispatchPointerEvent(window, "pointermove", { clientX: 166, clientY: 316 });
    dispatchPointerEvent(window, "pointermove", { clientX: 182, clientY: 332 });
    dispatchPointerEvent(window, "pointerup", {});

    expect(screen.getByLabelText("X")).toHaveValue(168);

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByLabelText("X")).toHaveValue(136);
  });

  it("zooms the canvas with the mouse wheel", () => {
    render(<App />);

    const canvas = screen.getByRole("img", { name: "Sample Logo" });
    fireEvent.wheel(canvas, { deltaY: -100 });

    expect(screen.getByLabelText("Zoom 110 percent")).toBeInTheDocument();

    fireEvent.wheel(canvas, { deltaY: 100 });

    expect(screen.getByLabelText("Zoom 100 percent")).toBeInTheDocument();
  });

  it("moves the selected layer with arrow keys", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByLabelText("X")).toHaveValue(144);

    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    expect(screen.getByLabelText("Y")).toHaveValue(316);
  });

  it("uses keyboard shortcuts for undo and redo", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByLabelText("X")).toHaveValue(144);

    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(screen.getByLabelText("X")).toHaveValue(136);

    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    expect(screen.getByLabelText("X")).toHaveValue(144);
  });

  it("does not hijack undo shortcuts while typing in fields", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    const name = screen.getByLabelText("Name");
    await user.click(name);

    fireEvent.keyDown(name, { key: "z", metaKey: true });

    expect(screen.getByRole("button", { name: "Select layer Rectangle" })).toBeInTheDocument();
  });

  it("applies masks through history so undo releases the target", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Select layer Orb" }));
    await user.click(screen.getByRole("button", { name: "Use selected layer as mask" }));
    await user.click(screen.getByRole("button", { name: "Select layer Wordmark" }));
    await user.click(screen.getByRole("button", { name: "Apply selected mask to selected target" }));

    expect(screen.getByText("Masked")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.queryByText("Masked")).not.toBeInTheDocument();
  });

  it("clears all layers and restores them with undo", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Clear all layers" }));

    expect(screen.getByText("Add a shape to start building your logo.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByRole("button", { name: "Select layer Wordmark" })).toBeInTheDocument();
  });

  it("multi-selects layers and aligns them from the inspector", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    await user.click(screen.getByRole("button", { name: "Ellipse" }));
    fireEvent.click(screen.getByRole("button", { name: "Select layer Rectangle" }), { shiftKey: true });
    await user.click(screen.getByRole("button", { name: "Align left" }));

    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select layer Rectangle" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Select layer Ellipse" })).toHaveAttribute("aria-pressed", "true");
  });

  it("adds triangle layers from the toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Triangle" }));

    expect(screen.getByRole("article", { name: "Layer Triangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select layer Triangle" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Inspector" })).toHaveTextContent("path");
  });

  it("adds additional path shapes from the toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Half circle" }));
    await user.click(screen.getByRole("button", { name: "Heart" }));
    await user.click(screen.getByRole("button", { name: "Arrow" }));

    expect(screen.getByRole("article", { name: "Layer Half circle" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Layer Heart" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Layer Arrow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select layer Arrow" })).toHaveAttribute("aria-pressed", "true");
  });

  it("starts new shape fill and stroke with the same default color and no stroke width", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Rectangle" }));

    expect(screen.getByLabelText("Fill")).toHaveValue("#2ec4b6");
    expect(screen.getByLabelText("Stroke")).toHaveValue("#2ec4b6");
    expect(screen.getByRole("slider", { name: "Stroke width" })).toHaveValue("0");
  });

  it("exports svg with the document filename", async () => {
    const user = userEvent.setup();
    const svgBlob = new Blob(["svg"], { type: "image/svg+xml" });
    exporterMocks.createSvgBlob.mockReturnValue(svgBlob);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("button", { name: "Download SVG" }));

    await waitFor(() => expect(exporterMocks.downloadBlob).toHaveBeenCalledWith(svgBlob, "Sample Logo.svg"));
    expect(exporterMocks.createSvgBlob).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sample Logo" }),
      expect.objectContaining({ format: "svg" }),
    );
  });

  it("exports pdf through the async exporter with the selected extension", async () => {
    const user = userEvent.setup();
    const pdfBlob = new Blob(["pdf"], { type: "application/pdf" });
    exporterMocks.createPdfBlob.mockResolvedValue(pdfBlob);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.selectOptions(screen.getByLabelText("Format"), "pdf");
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(exporterMocks.downloadBlob).toHaveBeenCalledWith(pdfBlob, "Sample Logo.pdf"));
    expect(exporterMocks.createPdfBlob).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Sample Logo" }),
      expect.objectContaining({ format: "pdf" }),
    );
  });
});
