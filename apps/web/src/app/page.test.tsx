// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "./page";

vi.mock("../features/home/HomeDashboard", () => ({
  HomeDashboard: () => <section>Skill baseline</section>
}));

afterEach(cleanup);

describe("home page", () => {
  it("keeps the dashboard while removing non-functional explainer copy", () => {
    render(<Page />);

    expect(screen.getByText("Skill baseline")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Training overview" })
    ).toHaveClass("sr-only");
    expect(
      screen.queryByText("Practice the game, not a generic chart.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "How TrueEdge works" })
    ).not.toBeInTheDocument();
  });
});
