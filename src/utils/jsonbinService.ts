// ===== JSONBIN.IO SERVICE =====
// Handles direct storage of tournament standings data in JSONBin.io

import type { StandingsSnapshot } from "./gistService";

// JSONBin.io API key from environment variable (free tier: 10k requests/month)
// Set VITE_JSONBIN_API_KEY in your build environment
const JSONBIN_API_KEY = import.meta.env.VITE_JSONBIN_API_KEY || "";

/**
 * Creates a new JSONBin with standings data.
 * Returns the bin ID (shareable).
 */
export async function createStandingsBin(
  standings: StandingsSnapshot,
  tournamentName: string
): Promise<string> {
  const response = await fetch("https://api.jsonbin.io/v3/b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_API_KEY,
      "X-Bin-Name": `dune-tournament-${tournamentName.replace(/\s+/g, "-")}`,
      "X-Bin-Private": "false", // Make bin publicly readable
    },
    body: JSON.stringify(standings),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create JSONBin: ${response.status} ${error}`);
  }

  const result = await response.json();
  return result.metadata.id;
}

/**
 * Updates an existing JSONBin with new standings data.
 */
export async function updateStandingsBin(
  binId: string,
  standings: StandingsSnapshot
): Promise<void> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_API_KEY,
    },
    body: JSON.stringify(standings),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update JSONBin: ${response.status} ${error}`);
  }
}

/**
 * Fetches standings data from a public JSONBin (no auth required).
 */
export async function fetchStandingsBin(binId: string): Promise<StandingsSnapshot> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`);

  if (!response.ok) {
    throw new Error(`Failed to fetch JSONBin: ${response.status}`);
  }

  const result = await response.json();
  return result.record as StandingsSnapshot;
}

