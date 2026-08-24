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
    ["/", "Skill baseline"],
    ["/games", "Preset games"],
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

test("games presents ten presets with optional editing", async ({ page }) => {
  await page.goto("/games");
  const presets = page.getByRole("region", { name: "Preset games" });
  await expect(presets.locator("article")).toHaveCount(10);
  await expect(page.getByRole("table")).toHaveCount(0);

  await presets
    .getByRole("button", { name: "Edit The Lodge Casino Six Deck" })
    .click();
  await expect(page.getByLabel("Game name")).toHaveValue(
    "The Lodge Casino Six Deck"
  );
  await expect(
    page.getByRole("button", { name: "Save edited game" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Save edited game" }).click();

  const editedLodge = presets.getByRole("article", {
    name: "The Lodge Casino Six Deck"
  });
  await expect(editedLodge.getByText("Edited preset")).toBeVisible();
  await editedLodge.getByRole("link", { name: "Practice" }).click();
  await expect(page.locator('input[name="preset"]')).toHaveValue(
    "custom-catalog-lodge-6d"
  );
  await expect(page.locator('input[name="minBet"]')).toHaveValue("15");
});

test("table menu switches to another preset through setup", async ({
  page
}) => {
  await page.goto("/play?seed=785390425&preset=lodge-6d&minBet=15");
  await waitForTable(page);
  const rail = page.locator("details").filter({ hasText: "Decision guide" });
  if ((await rail.getAttribute("open")) === null) {
    await rail.locator("summary").click();
  }

  const gamePreset = rail.getByRole("combobox", { name: "Game preset" });
  await expect(gamePreset).toHaveValue("lodge-6d");
  await gamePreset.selectOption("ballys-north-dd");
  await Promise.all([
    page.waitForURL(/\/setup\?preset=ballys-north-dd$/u),
    rail.getByRole("button", { name: "Set up game" }).click()
  ]);
  await expect(page.locator('input[name="preset"]')).toHaveValue(
    "ballys-north-dd"
  );

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Session", exact: true })
  ).toHaveAttribute("href", "/setup?preset=ballys-north-dd");
  await page.reload();
  const tableLink = page.getByRole("link", { name: "Table", exact: true });
  await expect(tableLink).toHaveAttribute(
    "href",
    "/play?preset=ballys-north-dd&minBet=15"
  );
  await tableLink.click();
  await waitForTable(page);
  await expect(
    page.getByRole("region", { name: "Session status" })
  ).toContainText("Bally's North Double Deck");
});

test("saves, reopens, edits, and deletes a validated custom game", async ({
  page
}) => {
  await page.goto("/games");
  await page.getByRole("button", { name: "Add game" }).click();
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

  const savedGame = page.getByRole("article", { name: "My Local S17" });
  await expect(savedGame).toBeVisible();
  await savedGame.getByRole("link", { name: "Practice" }).click();
  await expect(page.getByText("Custom game loaded")).toBeVisible();
  await expect(page.getByText("My Local S17", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Lock limits and start" }).click();
  await waitForTable(page);
  await expect(page.locator('details select[name="preset"]')).toHaveValue(
    "custom-user-my-local-s17"
  );
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
  const savedAfterPlay = page.getByRole("article", { name: "My Local S17" });
  await savedAfterPlay
    .getByRole("button", { name: "Edit My Local S17" })
    .click();
  await savedAfterPlay.getByRole("button", { name: "Delete game" }).click();
  await expect(savedAfterPlay).toHaveCount(0);
});

test("locks a one-hand session, stops without override, and persists review", async ({
  page
}) => {
  await page.goto("/setup?preset=lodge-6d");
  await expect(page.getByLabel("Play")).toBeVisible();
  await expect(page.getByLabel("Observation")).toBeVisible();
  await expect(page.getByLabel("Practice")).toBeVisible();
  await expect(page.getByLabel("Decision")).toBeVisible();
  await page.getByLabel("Running count").check();
  await expect(page.getByLabel("Practice")).toBeChecked();
  await page.getByLabel("Observation").check();
  await page.getByLabel("Basic strategy").check();
  await expect(page.getByLabel("Decision")).toBeChecked();
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

  await page.getByRole("button", { name: "Review session" }).click();
  await expect(page).toHaveURL(/\/review$/u);
  await expect(
    page.getByText("Decision quality", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Technical breakdown")).toBeVisible();
  await expect(page.getByText("Shoe replay")).toBeVisible();
  await page.goto("/progress");
  await expect(page.getByText("1 completed sessions")).toBeVisible();
});

test("ends a session from the bottom of the table and opens review", async ({
  page
}) => {
  await page.goto("/play?seed=785390425&mode=decision");
  await waitForTable(page);
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  const decline = page.getByRole("button", { name: "Decline" });
  if (await decline.isVisible()) await decline.click();
  const stand = page.getByRole("button", { name: "Stand", exact: true });
  if (await stand.isEnabled()) await stand.click();

  await page.getByRole("button", { name: "End session and review" }).click();

  await expect(page).toHaveURL(/\/review$/u);
  await expect(
    page.getByText("Decision quality", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Shoe replay")).toBeVisible();
});

test("play hides live coaching, observation reveals it, and drills persist attempts", async ({
  page
}, testInfo) => {
  await page.goto("/play?seed=785390425&mode=play");
  await waitForTable(page);
  const playRail = page
    .locator("details")
    .filter({ hasText: "Decision guide" });
  if (testInfo.project.name === "mobile-390") {
    await expect(playRail).not.toHaveAttribute("open", "");
    await playRail.locator("summary").click();
    await expect(playRail).toHaveAttribute("open", "");
  } else {
    await expect(
      playRail.getByRole("heading", { name: "Choose a wager" })
    ).toBeVisible();
  }
  await expect(
    page.getByText("Count-based wager guidance stays hidden during play.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(playRail.getByText("--", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Stand", exact: true }).click();
  await expect(page.getByText("Wager signal")).toBeVisible();

  await page.goto("/play?seed=785390425&mode=observation");
  await waitForTable(page);
  const observationRail = page
    .locator("details")
    .filter({ hasText: "Decision guide" });
  if (testInfo.project.name === "mobile-390") {
    await expect(observationRail).not.toHaveAttribute("open", "");
    await observationRail.locator("summary").click();
    await expect(observationRail).toHaveAttribute("open", "");
  } else {
    await expect(page.getByText("Wager signal")).toBeVisible();
  }
  await expect(page.getByText("True count", { exact: true })).toBeVisible();

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
  const rail = page.locator("details").filter({ hasText: "Decision guide" });
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

  await page.goto("/drill?kind=count-practice");
  await expect(page.getByLabel(/Outlined card:/u)).toBeVisible();
  for (const label of [
    "Outlined card value",
    "Final running count",
    "Truncated true count"
  ]) {
    await page.getByLabel(label).fill("999");
  }
  await page.getByRole("button", { name: "Score count practice" }).click();
  await expect(page.getByText(/\/3 correct\./u)).toBeVisible();

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
