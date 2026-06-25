import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addLayer, createDocument } from "../editor/document";
import { Inspector } from "./Inspector";
import { LayersPanel } from "./LayersPanel";
import { Toolbar } from "./Toolbar";

describe("editor panels", () => {
  it("adds shape tools through the toolbar", async () => {
    const onAddLayer = vi.fn();
    render(<Toolbar activeTool="select" onSelectTool={vi.fn()} onAddLayer={onAddLayer} />);

    await userEvent.click(screen.getByRole("button", { name: "Rectangle" }));
    await userEvent.click(screen.getByRole("button", { name: "Star" }));

    expect(onAddLayer).toHaveBeenCalledWith("rect");
    expect(onAddLayer).toHaveBeenCalledWith("star");
  });

  it("shows layer controls", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<LayersPanel document={doc} selectedLayerIds={[doc.layers[0].id]} onSelectLayer={vi.fn()} onChangeDocument={onChange} />);

    expect(screen.getByText("Badge")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hide Badge" }));

    expect(onChange).toHaveBeenCalled();
  });

  it("edits precise layer values in the inspector", async () => {
    const doc = addLayer(createDocument(), { type: "rect", name: "Badge", x: 0, y: 0, width: 100, height: 100 });
    const onChange = vi.fn();
    render(<Inspector document={doc} selectedLayerId={doc.layers[0].id} onChangeDocument={onChange} />);

    const width = screen.getByLabelText("Width");
    await userEvent.clear(width);
    await userEvent.type(width, "160");

    expect(onChange).toHaveBeenCalled();
  });
});
