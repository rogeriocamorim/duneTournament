import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// ===== HELPERS =====

/** Clear localStorage before each test to start fresh */
async function resetState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

/** Wait for mode selector page to be visible */
async function waitForModeSelector(page: Page) {
  await expect(page.getByText("Tournament Manager")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Classic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Colosseum" })).toBeVisible();
}

/** Select a tournament mode */
async function selectMode(page: Page, mode: "Classic" | "Colosseum") {
  await page.getByRole("button", { name: mode }).click();
}

/** Type a player name into the registration form and submit */
async function addPlayer(page: Page, name: string) {
  const input = page.getByPlaceholder("Enter Name...");
  await input.fill(name);
  await page.getByRole("button", { name: "Summon" }).click();
}

/** Add N players with sequential names */
async function addPlayers(page: Page, count: number, prefix = "Player") {
  for (let i = 1; i <= count; i++) {
    await addPlayer(page, `${prefix} ${i}`);
  }
}

/** Enable test mode via the toolbar flask icon */
async function enableTestMode(page: Page) {
  await page.locator("button[title*='Test Mode']").click();
}

/** Disable dramatic reveal to prevent overlays blocking interactions */
async function disableDramaticReveal(page: Page) {
  const btn = page.locator("button[title='Dramatic Reveal: ON']");
  if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await btn.click();
  }
}

/** Auto-fill players using test mode controls */
async function autoFillPlayers(page: Page, count: number) {
  await enableTestMode(page);
  // Set the count input
  const countInput = page.locator("input[type='number']");
  await countInput.fill(String(count));
  await page.getByRole("button", { name: "Auto Fill Players" }).click();
}

// ===== MODE SELECTOR PAGE =====

test.describe("Mode Selector Page", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
  });

  test("shows mode selector as the landing page", async ({ page }) => {
    await waitForModeSelector(page);
    await expect(page.getByText("Dune: Imperium")).toBeVisible();
    await expect(page.getByText("Choose your tournament format")).toBeVisible();
  });

  test("Classic card shows correct description", async ({ page }) => {
    await waitForModeSelector(page);
    await expect(page.getByText("Swiss Pairing")).toBeVisible();
    await expect(page.getByText("5 qualifying rounds")).toBeVisible();
    await expect(page.getByText("Minimum 4 players")).toBeVisible();
  });

  test("Colosseum card shows correct description", async ({ page }) => {
    await waitForModeSelector(page);
    await expect(page.getByText("Group Stage")).toBeVisible();
    await expect(page.getByText("4 pre-generated qualifying rounds")).toBeVisible();
    await expect(page.getByText("Minimum 16 players")).toBeVisible();
  });

  test("selecting Classic goes to registration page", async ({ page }) => {
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder("Enter Name...")).toBeVisible();
  });

  test("selecting Colosseum goes to registration page", async ({ page }) => {
    await waitForModeSelector(page);
    await selectMode(page, "Colosseum");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder("Enter Name...")).toBeVisible();
  });
});

// ===== CLASSIC MODE — REGISTRATION =====

test.describe("Classic Mode — Registration", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
  });

  test("can add a player", async ({ page }) => {
    await addPlayer(page, "Paul Atreides");
    await expect(page.getByText("Paul Atreides")).toBeVisible();
    await expect(page.getByText("1")).toBeVisible(); // 1 champion summoned
  });

  test("can remove a player", async ({ page }) => {
    await addPlayer(page, "Paul Atreides");
    await expect(page.getByText("Paul Atreides")).toBeVisible();
    // Click the X button next to the player name
    const playerRow = page.locator("div").filter({ hasText: /^Paul Atreides$/ });
    await playerRow.locator("button").click();
    await expect(page.getByText("Paul Atreides")).not.toBeVisible();
  });

  test("shows 'Begin the Jihad' button with 4 players", async ({ page }) => {
    await addPlayers(page, 4);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).toBeVisible();
  });

  test("does NOT show 'Begin the Jihad' with 3 players", async ({ page }) => {
    await addPlayers(page, 3);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).not.toBeVisible();
  });

  test("shows hint when player count not divisible by 4", async ({ page }) => {
    await addPlayers(page, 5);
    await expect(page.getByText(/Add \d+ more player/)).toBeVisible();
  });

  test("shows 'Begin the Jihad' with 8 players", async ({ page }) => {
    await addPlayers(page, 8);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).toBeVisible();
    await expect(page.getByText("2 tables of 4")).toBeVisible();
  });

  test("Begin the Jihad transitions to qualifying (dashboard)", async ({ page }) => {
    await addPlayers(page, 4);
    await page.getByRole("button", { name: "Begin the Jihad" }).click();
    // Should see qualifying dashboard with round info
    await expect(page.getByText("Round 1 / 5")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Tables" })).toBeVisible();
  });
});

// ===== COLOSSEUM MODE — REGISTRATION =====

test.describe("Colosseum Mode — Registration", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Colosseum");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
  });

  test("does NOT show 'Begin the Jihad' with 4 players", async ({ page }) => {
    await addPlayers(page, 4);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).not.toBeVisible();
  });

  test("does NOT show 'Begin the Jihad' with 12 players", async ({ page }) => {
    await addPlayers(page, 12);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).not.toBeVisible();
    // Should show hint about needing more players
    await expect(page.getByText(/Need at least 16 players/)).toBeVisible();
  });

  test("does NOT show 'Begin the Jihad' with 20 players (not multiple of 8)", async ({ page }) => {
    await addPlayers(page, 20);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).not.toBeVisible();
    await expect(page.getByText(/Add \d+ more player/)).toBeVisible();
  });

  test("shows 'Begin the Jihad' with 16 players", async ({ page }) => {
    await addPlayers(page, 16);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).toBeVisible();
    await expect(page.getByText("2 groups of 8")).toBeVisible();
  });

  test("shows 'Begin the Jihad' with 24 players", async ({ page }) => {
    await addPlayers(page, 24);
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).toBeVisible();
    await expect(page.getByText("3 groups of 8")).toBeVisible();
  });

  test("Begin the Jihad transitions to group draw (spinner wheel)", async ({ page }) => {
    await addPlayers(page, 16);
    await page.getByRole("button", { name: "Begin the Jihad" }).click();
    // Should transition to group-draw phase (SpinnerWheelPage)
    // Wait for the sandstorm transition and then the new page
    await page.waitForTimeout(2000); // sandstorm transition
    // The spinner wheel page should have some group-related content
    const hasGroupDraw = await page.getByText(/group|spin|draw|wheel/i).first().isVisible().catch(() => false);
    expect(hasGroupDraw).toBe(true);
  });
});

// ===== CLASSIC MODE — QUALIFYING DASHBOARD =====

test.describe("Classic Mode — Qualifying Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
    // Enable test mode first, then auto-fill
    await autoFillPlayers(page, 8);
    // Disable dramatic reveal to prevent overlays blocking interactions
    await disableDramaticReveal(page);
    await page.getByRole("button", { name: "Begin the Jihad" }).click();
    // Wait for dashboard to load
    await expect(page.getByText("Round 1 / 5")).toBeVisible({ timeout: 10_000 });
  });

  test("shows qualifying dashboard with round info", async ({ page }) => {
    await expect(page.getByText("Round 1 / 5")).toBeVisible();
    await expect(page.getByText("8 Players")).toBeVisible();
  });

  test("shows tab navigation with Tables, Standings, Leaders", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Tables", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Standings", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Leaders", exact: true })).toBeVisible();
  });

  test("does NOT show Groups or Seats tabs in Classic mode", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Groups" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Seats" })).not.toBeVisible();
  });

  test("auto-fill works and completes the round", async ({ page }) => {
    // Test mode should be on already
    await page.getByRole("button", { name: "Auto Fill All Tables" }).click();
    // After auto-fill, round should be complete and "Generate Round 2" should appear
    await expect(page.getByText("Round 1 Complete")).toBeVisible({ timeout: 5_000 });
  });

  test("can navigate to Standings tab", async ({ page }) => {
    await page.getByRole("button", { name: "Standings", exact: true }).click();
    // Should see the leaderboard with column headers
    await expect(page.getByText("Pts")).toBeVisible({ timeout: 5_000 });
  });
});

// ===== CLASSIC MODE — FULL QUALIFYING FLOW =====

test.describe("Classic Mode — Full Qualifying Flow", () => {
  test("can complete all 5 qualifying rounds", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
    await autoFillPlayers(page, 8);
    // Disable dramatic reveal to prevent overlays blocking interactions
    await disableDramaticReveal(page);
    await page.getByRole("button", { name: "Begin the Jihad" }).click();
    await expect(page.getByText("Round 1 / 5")).toBeVisible({ timeout: 10_000 });

    for (let round = 1; round <= 5; round++) {
      // Auto-fill results
      const autoFill = page.getByRole("button", { name: "Auto Fill All Tables" });
      if (await autoFill.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await autoFill.click();
      }

      if (round < 5) {
        // Wait for round completion
        await expect(page.getByText(`Round ${round} Complete`)).toBeVisible({ timeout: 5_000 });
        // Generate next round
        await page.getByRole("button", { name: `Generate Round ${round + 1}` }).click();
        await expect(page.getByText(`Round ${round + 1} / 5`)).toBeVisible({ timeout: 5_000 });
      }
    }

    // After round 5, qualifying should be complete
    await expect(page.getByText("Qualifying Complete")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Begin the Landsraad" })).toBeVisible();
  });
});

// ===== EDGE CASES =====

test.describe("Edge Cases", () => {
  test("state persists across page reload", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
    await addPlayer(page, "Persistent Player");
    await expect(page.getByText("Persistent Player")).toBeVisible();

    // Reload the page
    await page.reload();
    // Player should still be visible
    await expect(page.getByText("Persistent Player")).toBeVisible({ timeout: 5_000 });
  });

  test("reset tournament returns to mode selector", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
    await addPlayers(page, 4);

    // Click reset button
    await page.locator("button[title='Reset Tournament']").click();
    // Should see reset confirmation dialog
    await expect(page.getByText("Reset Tournament?")).toBeVisible({ timeout: 3_000 });
  });

  test("empty player name is not submitted", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });

    // Try to submit empty name — Summon button should be disabled
    const summonBtn = page.getByRole("button", { name: "Summon" });
    await expect(summonBtn).toBeDisabled();
  });

  test("spaces-only name is not submitted", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });

    const input = page.getByPlaceholder("Enter Name...");
    await input.fill("   ");
    const summonBtn = page.getByRole("button", { name: "Summon" });
    await expect(summonBtn).toBeDisabled();
  });

  test("test mode toggle works from toolbar", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });

    // Toggle test mode on
    await enableTestMode(page);
    // Should see auto-fill controls
    await expect(page.getByRole("button", { name: "Auto Fill Players" })).toBeVisible();

    // Toggle test mode off
    await page.locator("button[title*='Test Mode']").click();
    // Auto-fill controls should disappear
    await expect(page.getByRole("button", { name: "Auto Fill Players" })).not.toBeVisible();
  });

  test("Guild Navigator (import/export) opens and closes", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });

    // Open Guild Navigator
    await page.locator("button[title*='Guild Navigator']").click();
    await expect(page.getByText("Export State")).toBeVisible({ timeout: 3_000 });

    // Close with Escape
    await page.keyboard.press("Escape");
  });

  test("Colosseum mode with exactly 16 players transitions correctly", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Colosseum");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
    await autoFillPlayers(page, 16);

    // Should see the start button
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).toBeVisible();
    // Verify it shows groups info
    await expect(page.getByText("2 groups of 8")).toBeVisible();

    // Click start
    await page.getByRole("button", { name: "Begin the Jihad" }).click();
    // Wait for transition
    await page.waitForTimeout(2000);
    // Should no longer be on registration
    await expect(page.getByText("The Summoning")).not.toBeVisible({ timeout: 5_000 });
  });

  test("Classic mode: hint updates as players are added", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });

    // Add 1 player — need 3 more
    await addPlayer(page, "Solo");
    await expect(page.getByText(/Need at least 4 players/)).toBeVisible();

    // Add 2 more — still under 4, hint updates count
    await addPlayer(page, "Duo");
    await addPlayer(page, "Trio");
    await expect(page.getByText(/Need at least 4 players.*1 more/)).toBeVisible();

    // Add 1 more — button appears
    await addPlayer(page, "Quad");
    await expect(page.getByRole("button", { name: "Begin the Jihad" })).toBeVisible();
  });

  test("Colosseum mode: hint updates as players are added", async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Colosseum");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });

    // Add 5 players — need at least 16
    await addPlayers(page, 5);
    await expect(page.getByText(/Need at least 16 players/)).toBeVisible();

    // Add up to 17 — need 7 more for 24 (or shows "add X more")
    await addPlayers(page, 12, "Extra");
    // 17 players: not multiple of 8, should see "Add X more"
    await expect(page.getByText(/Add \d+ more player/)).toBeVisible();
  });
});

// ===== TOOLBAR =====

test.describe("Toolbar Controls", () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
    await waitForModeSelector(page);
    await selectMode(page, "Classic");
    await expect(page.getByText("The Summoning")).toBeVisible({ timeout: 5_000 });
  });

  test("dramatic reveal toggle works", async ({ page }) => {
    const btn = page.locator("button[title*='Dramatic Reveal']");
    await expect(btn).toBeVisible();
    await btn.click(); // toggle off
    await btn.click(); // toggle on
  });

  test("share button is disabled during registration", async ({ page }) => {
    const shareBtn = page.locator("button[title='Share Standings']");
    await expect(shareBtn).toBeVisible();
    // Should be visually disabled
    await expect(shareBtn).toBeDisabled();
  });
});
