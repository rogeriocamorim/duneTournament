// ===== PASTE SERVICE =====
// Handles tournament standings storage using dpaste.com (anonymous, no auth required)

import type { StandingsSnapshot } from "./gistService";

/**
 * Creates a new paste with standings data on dpaste.com.
 * Returns the paste URL that can be shared with spectators.
 */
export async function createStandingsPaste(standings: StandingsSnapshot): Promise<string> {
  const response = await fetch("https://dpaste.com/api/v2/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      content: JSON.stringify(standings, null, 2),
      syntax: "json",
      expiry_days: "365", // Keep for 1 year
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create paste: ${response.status} ${error}`);
  }

  // dpaste returns the full URL in the response text
  const pasteUrl = await response.text();
  return pasteUrl.trim();
}

/**
 * Fetches standings data from a dpaste URL.
 * @param pasteUrl - The full dpaste URL (e.g., "https://dpaste.com/ABC123")
 */
export async function fetchStandingsPaste(pasteUrl: string): Promise<StandingsSnapshot> {
  // Add .txt to get raw content
  const rawUrl = pasteUrl.endsWith(".txt") ? pasteUrl : `${pasteUrl}.txt`;
  
  const response = await fetch(rawUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch paste: ${response.status}`);
  }

  const content = await response.text();
  return JSON.parse(content) as StandingsSnapshot;
}
