import { expect, test, type Page } from "@playwright/test";

async function waitForTable(page: Page): Promise<void> {
  await expect(page.getByTestId("trueedge-table")).toHaveAttribute(
    "data-hydrated",
    "true"
  );
}

test("all seven product screens are reachable through primary navigation", async ({
  page
}) => {
  const screens = [
    ["/", "Practice the game, not a generic chart."],
    ["/games", "Pick the game you mean to practice."],
    ["/setup", "Define the session before variance does."],
    ["/play", "Practice bankroll"],
    ["/drill", "Train the step that breaks under pressure."],
    ["/review", "Review the reasoning, not the runout."],
    ["/progress", "A technical record of your practice."]
  ] as const;

  for (const [route, text] of screens) {
    await page.goto(route);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("link", { name: "Games", exact: true })
  ).toBeVisible();
});

test("catalog presents ten sourced presets and aligned comparison", async ({
  page
}) => {
  await page.goto("/games");
  await expect(
    page.getByText("10 profiles · Black Hawk, Colorado")
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Black Hawk game presets" })
      .locator("article")
  ).toHaveCount(10);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Double after split/i })
  ).toBeVisible();

  const firstEvidence = page.getByText("Evidence", { exact: true }).first();
  await firstEvidence.click();
  await expect(
    page.getByRole("link", { name: /Colorado Gaming Regulations/i }).first()
  ).toBeVisible();
  await expect(
    page.getByText("conditions may have changed", { exact: false }).first()
  ).toBeVisible();
});

test("saves, compares, reopens, and deletes a validated custom game", async ({
  page
}) => {
  await page.goto("/games");
  await page.getByLabel("Game name").fill("My Local S17");
  await page.getByLabel("Decks").selectOption("2");
  await page.getByLabel("Dealer soft 17").selectOption("S17");
  await page.getByLabel("Penetration model").selectOption("range");
  await page.getByLabel("Shuffle behavior").selectOption("simulated_hand");
  await page
    .getByLabel("Hi-Lo deviation profile")
    .selectOption("basic-strategy-only");
  await page.getByRole("button", { name: "Save custom game" }).click();
  await expect(
    page.getByText("Saved My Local S17 in this browser.")
  ).toBeVisible();

  const localChoice = page.getByLabel(/My Local S17/).first();
  await expect(localChoice).toBeVisible();
  await localChoice.check();
  await expect(
    page.getByRole("columnheader", { name: "My Local S17" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Use" }).click();
  await expect(page.getByText("Custom game loaded")).toBeVisible();
  await expect(page.getByText("My Local S17", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Lock limits and start" }).click();
  await waitForTable(page);
  await page.getByRole("button", { name: "Export replay" }).click();
  const customReplay = JSON.parse(
    await page
      .getByRole("textbox", { name: "Exported replay data" })
      .inputValue()
  ) as {
    config: {
      rules: { decks: number; dealerSoft17: string };
      penetration: { mode: string };
      shuffleMode: string;
      deviationProfileId: string;
    };
  };
  expect(customReplay.config).toMatchObject({
    rules: { decks: 2, dealerSoft17: "S17" },
    penetration: { mode: "range" },
    shuffleMode: "simulated_hand",
    deviationProfileId: "basic-strategy-only"
  });

  await page.goto("/games");
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Custom game deleted.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Build a custom game" })
  ).toBeFocused();
});

test("locks a one-hand session, stops without override, and persists review", async ({
  page
}) => {
  await page.goto("/setup?preset=lodge-6d");
  await expect(page.getByLabel("Play")).toBeVisible();
  await expect(page.getByLabel("Observation")).toBeVisible();
  await expect(page.getByLabel("Practice")).toBeVisible();
  await expect(page.getByLabel("Decision")).toBeVisible();
  await page.getByLabel("Decision").check();
  await page.getByLabel("Hand limit").fill("1");
  await page.getByRole("button", { name: "Lock limits and start" }).click();

  await expect(page).toHaveURL(/\/play\?/u);
  await waitForTable(page);
  await page.getByRole("button", { name: "Bet $15", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  const decline = page.getByRole("button", { name: "Decline" });
  if (await decline.isVisible()) await decline.click();
  const stand = page.getByRole("button", { name: "Stand", exact: true });
  if (await stand.isEnabled()) await stand.click();
  await expect(page.getByText("Maximum hands reached")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Deal", exact: true })
  ).toBeDisabled();

  await page.goto("/review");
  await expect(
    page.getByText("Decision quality", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Technical breakdown")).toBeVisible();
  await expect(page.getByText("Shoe replay")).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("1 completed sessions")).toBeVisible();
});

test("play hides live coaching, observation reveals it, and drills persist attempts", async ({
  page
}, testInfo) => {
  await page.goto("/play?seed=785390425&mode=play");
  await waitForTable(page);
  const playRail = page.locator("details").filter({ hasText: "Training rail" });
  if (testInfo.project.name === "mobile-390") {
    await expect(playRail).not.toHaveAttribute("open", "");
    await playRail.locator("summary").click();
    await expect(playRail).toHaveAttribute("open", "");
  } else {
    await expect(page.getByText("Post-hand review")).toBeVisible();
  }
  await expect(
    page.getByText("Analysis stays hidden until the round settles.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(playRail.getByText("--", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Stand", exact: true }).click();
  await expect(page.getByText("Raw true count")).toBeVisible();

  await page.goto("/play?seed=785390425&mode=observation");
  await waitForTable(page);
  const observationRail = page
    .locator("details")
    .filter({ hasText: "Training rail" });
  if (testInfo.project.name === "mobile-390") {
    await expect(observationRail).not.toHaveAttribute("open", "");
    await observationRail.locator("summary").click();
    await expect(observationRail).toHaveAttribute("open", "");
  } else {
    await expect(page.getByText("Live analysis")).toBeVisible();
  }
  await expect(page.getByText("Running count", { exact: true })).toBeVisible();

  await page.goto("/drill?kind=basic-strategy");
  await expect(page.getByText("Generated training scenario")).toBeVisible();
  await page.getByRole("button", { name: "hit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next deterministic scenario" })
  ).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText(/of 1 correct/u)).toBeVisible();
});

test("practice mode and composite drills record each reasoning layer", async ({
  page
}, testInfo) => {
  await page.goto("/play?seed=785390425&mode=practice");
  await waitForTable(page);
  const rail = page.locator("details").filter({ hasText: "Training rail" });
  if (testInfo.project.name === "mobile-390") {
    await rail.locator("summary").click();
  }
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Running count" })
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Running count" }).fill("999");
  await page
    .getByRole("button", { name: "Check", exact: true })
    .first()
    .click();
  await expect(page.getByText(/Actual/u)).toBeVisible();

  await page.goto("/drill?kind=insurance");
  await page.getByRole("button", { name: "decline", exact: true }).click();
  await expect(page.getByText(/Correct\./u)).toBeVisible();

  await page.goto("/drill?kind=full-load");
  for (const label of ["Final RC", "Decks remain", "True count", "Bet units"]) {
    await page.getByLabel(label).fill("999");
  }
  await page.getByRole("radio", { name: "hit" }).check();
  await page.getByRole("button", { name: "Score all five steps" }).click();
  await expect(page.getByText(/\/5 steps correct/u)).toBeVisible();

  await page.goto("/progress");
  await expect(page.getByText("Insurance", { exact: true })).toBeVisible();
  await expect(page.getByText(/of 1 correct/u).first()).toBeVisible();
});

test("390px layout stays inside the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "mobile project only");
  for (const route of [
    "/",
    "/games",
    "/setup",
    "/play",
    "/drill",
    "/review",
    "/progress"
  ]) {
    await page.goto(route);
    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth
    }));
    expect(widths.document, route).toBeLessThanOrEqual(widths.viewport);
  }
});
