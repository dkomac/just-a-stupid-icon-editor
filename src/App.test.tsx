import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
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
});

describe("App", () => {
  it("opens directly into the logo editor", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Logo Creator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ellipse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Text" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Logo canvas" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Layers" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
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
});
