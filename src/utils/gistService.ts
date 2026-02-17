// ===== GITHUB GIST SERVICE =====
// Handles creation and fetching of tournament standings via GitHub Gist API

export interface StandingsSnapshot {
  metadata: {
    tournamentName: string;
    timestamp: string;
    currentRound: number;
    totalRounds: number;
    phase: string;
  };
  standings: {
    rank: number;
    name: string;
    points: number;
    totalVP: number;
    efficiency: number;
  }[];
}

/**
 * Creates an anonymous public GitHub Gist with standings data.
 * Returns the Gist ID.
 */
export async function createStandingsGist(snapshot: StandingsSnapshot): Promise<string> {
  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: `Dune Tournament Standings - ${snapshot.metadata.tournamentName}`,
      public: true,
      files: {
        "standings.json": {
          content: JSON.stringify(snapshot, null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Gist: ${response.status} ${error}`);
  }

  const gist = await response.json();
  return gist.id;
}

/**
 * Fetches standings data from a GitHub Gist.
 * @param gistId - The Gist ID to fetch
 */
export async function fetchStandingsGist(gistId: string): Promise<StandingsSnapshot> {
  const response = await fetch(`https://api.github.com/gists/${gistId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Gist: ${response.status}`);
  }

  const gist = await response.json();
  const fileContent = gist.files["standings.json"]?.content;

  if (!fileContent) {
    throw new Error("Gist does not contain standings.json");
  }

  return JSON.parse(fileContent) as StandingsSnapshot;
}
