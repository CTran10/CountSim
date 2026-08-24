import { expect, test, type Page } from "@playwright/test";

const SEEDED_ROUTE = "/play?seed=785390425&mode=observation";

async function waitForTable(page: Page): Promise<void> {
  await expect(page.getByTestId("trueedge-table")).toHaveAttribute(
    "data-hydrated",
    "true"
  );
}

async function dealTwentyFive(page: Page): Promise<string[]> {
  await waitForTable(page);
  await page.getByRole("button", { name: "Bet $25", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(page.getByTestId("player-card")).toHaveCount(2);
  await expect(page.getByTestId("dealer-hole-card")).toBeVisible();
  await expect(page.getByTestId("player-card").first()).toHaveCSS(
    "animation-name",
    /dealCard/u
  );
  return page
    .getByTestId("player-card")
    .locator("img")
    .evaluateAll((images) =>
      images.map((image) => image.getAttribute("alt") ?? "")
    );
}

test("reproduces a visible hand and versioned replay from the same seed", async ({
  page
}) => {
  await page.goto(SEEDED_ROUTE);
  const firstHand = await dealTwentyFive(page);

  await page.reload();
  expect(await dealTwentyFive(page)).toEqual(firstHand);
  await page.getByRole("button", { name: "Stand", exact: true }).click();
  await expect(page.getByText("Round complete")).toBeVisible();

  await page.getByRole("button", { name: "Export replay" }).click();
  const replayText = await page
    .getByRole("textbox", { name: "Exported replay data" })
    .inputValue();
  const replay = JSON.parse(replayText) as {
    schemaVersion: number;
    config: { seed: number };
    successfulCommands: { type: string }[];
  };
  expect(replay.schemaVersion).toBe(3);
  expect(replay.config.seed).toBe(785390425);
  expect(replay.successfulCommands.map((command) => command.type)).toEqual([
    "place_bet",
    "deal",
    "stand"
  ]);
  await expect(page.getByText("Replay position 3 of 3")).toBeVisible();
});

test("supports keyboard play and has no horizontal overflow", async ({
  page
}, testInfo) => {
  await page.goto(SEEDED_ROUTE);
  await waitForTable(page);
  await expect(
    page.getByText("Virtual funds only.", { exact: false })
  ).toBeVisible();

  const rail = page.locator("details").filter({ hasText: "Training rail" });
  if (testInfo.project.name === "mobile-390") {
    await expect(rail).not.toHaveAttribute("open", "");
    await rail.locator("summary").click();
  } else {
    await expect(rail).toHaveAttribute("open", "");
  }
  await expect(page.getByText("Running count", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.keyboard.press("Alt+D");
  await expect(page.getByTestId("player-card")).toHaveCount(2);
  await page.keyboard.press("Alt+H");
  await expect(page.getByTestId("player-card")).toHaveCount(3);

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});

test("deals without animation when reduced motion is requested", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(SEEDED_ROUTE);
  await waitForTable(page);
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(page.getByTestId("player-card").first()).toHaveCSS(
    "animation-name",
    "none"
  );
});

test("falls back safely when the seed query is invalid", async ({ page }) => {
  await page.goto("/play?seed=not-a-number");
  await expect(
    page.getByRole("region", { name: "Session status" })
  ).toContainText("785390425");
  await page.goto("/play?seed=4294967296");
  await expect(
    page.getByRole("region", { name: "Session status" })
  ).toContainText("785390425");
});

test("exposes deterministic split, insurance, and double fixtures", async ({
  page
}) => {
  await page.goto("/play?seed=1&mode=decision");
  await waitForTable(page);
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Split", exact: true })
  ).toBeEnabled();
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect(page.getByText("Hand 2", { exact: true })).toBeVisible();

  await page.goto("/play?seed=14&mode=observation");
  await waitForTable(page);
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Take insurance" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Decline" }).click();

  await page.goto("/play?seed=0&mode=decision");
  await waitForTable(page);
  await page.getByRole("button", { name: "Bet $5", exact: true }).click();
  await page.getByRole("button", { name: "Deal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Double", exact: true })
  ).toBeEnabled();
  await page.getByRole("button", { name: "Double", exact: true }).click();
  await expect(page.getByText("Round complete")).toBeVisible();
});
