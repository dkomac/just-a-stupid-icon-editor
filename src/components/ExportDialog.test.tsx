import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocument } from "../editor/document";
import { ExportDialog } from "./ExportDialog";

afterEach(() => {
  cleanup();
});

describe("ExportDialog", () => {
  it("exports svg from the dialog", async () => {
    const onClose = vi.fn();
    const onDownload = vi.fn();
    render(<ExportDialog open document={createDocument()} onClose={onClose} onDownload={onDownload} />);

    await userEvent.selectOptions(screen.getByLabelText("Format"), "svg");
    const downloadButton = screen.getByRole("button", { name: "Download" });
    expect(downloadButton).toHaveTextContent("Download SVG");
    await userEvent.click(downloadButton);

    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ format: "svg" }));
  });

  it("updates export dimensions", async () => {
    const onDownload = vi.fn();
    render(<ExportDialog open document={createDocument()} onClose={vi.fn()} onDownload={onDownload} />);

    await userEvent.clear(screen.getByLabelText("Width"));
    await userEvent.type(screen.getByLabelText("Width"), "1400");
    await userEvent.click(screen.getByRole("button", { name: /Download/ }));

    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ width: 1400 }));
  });

  it("keeps the dialog open and shows an error when export fails", async () => {
    const onClose = vi.fn();
    const onDownload = vi.fn().mockRejectedValue(new Error("PDF export failed."));
    render(<ExportDialog open document={createDocument()} onClose={onClose} onDownload={onDownload} />);

    await userEvent.selectOptions(screen.getByLabelText("Format"), "pdf");
    const downloadButton = screen.getByRole("button", { name: "Download" });
    expect(downloadButton).toHaveTextContent("Download PDF");
    await userEvent.click(downloadButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("PDF export failed.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
