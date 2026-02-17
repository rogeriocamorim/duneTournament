// ===== JSONBIN.IO SERVICE =====
// Handles master pointer storage that always points to the latest standings Gist

export interface MasterPointer {
  latestGistId: string;
  tournamentName: string;
  lastUpdated: string;
}

// Generate a simple master key for JSONBin.io (stored in localStorage)
function generateMasterKey(): string {
  // JSONBin.io accepts any string as a master key for anonymous bins
  // We'll generate a random one and store it locally
  return `dune-tournament-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Creates a new JSONBin master pointer.
 * Returns both the bin ID (shareable) and master key (private, for updates).
 */
export async function createMasterPointer(
  initialGistId: string,
  tournamentName: string
): Promise<{ binId: string; masterKey: string }> {
  const masterKey = generateMasterKey();

  const response = await fetch("https://api.jsonbin.io/v3/b", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": masterKey,
      "X-Bin-Name": `dune-tournament-${tournamentName.replace(/\s+/g, "-")}`,
    },
    body: JSON.stringify({
      latestGistId: initialGistId,
      tournamentName,
      lastUpdated: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create JSONBin: ${response.status} ${error}`);
  }

  const result = await response.json();
  return {
    binId: result.metadata.id,
    masterKey,
  };
}

/**
 * Updates an existing JSONBin master pointer with a new Gist ID.
 */
export async function updateMasterPointer(
  binId: string,
  masterKey: string,
  newGistId: string,
  tournamentName: string
): Promise<void> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": masterKey,
    },
    body: JSON.stringify({
      latestGistId: newGistId,
      tournamentName,
      lastUpdated: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update JSONBin: ${response.status} ${error}`);
  }
}

/**
 * Fetches the master pointer from JSONBin (public read, no auth needed).
 */
export async function fetchMasterPointer(binId: string): Promise<MasterPointer> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`);

  if (!response.ok) {
    throw new Error(`Failed to fetch JSONBin: ${response.status}`);
  }

  const result = await response.json();
  return result.record as MasterPointer;
}
