import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

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
});
