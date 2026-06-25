import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

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
});
