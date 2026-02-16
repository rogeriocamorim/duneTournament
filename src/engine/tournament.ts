import type { Player, Table, Round, TournamentState } from "./types";
import type { LeaderStat } from "./types";
import { getLeaderInfo } from "./types";

// ===== PLAYER MANAGEMENT =====

let nextId = 1;

export function createPlayer(name: string): Player {
  return {
    id: String(nextId++),
    name: name.trim(),
    points: 0,
    totalVP: 0,
    efficiency: 0,
    opponents: [],
  };
}

export function initializePlayerIds(players: Player[]): void {
  const maxId = players.reduce((max, p) => Math.max(max, parseInt(p.id, 10) || 0), 0);
  nextId = maxId + 1;
}

// ===== PAIRING ENGINE =====

/**
 * Swiss-style pairing: group players by similar point totals,
 * then assign to tables while respecting the anti-repeat constraint.
 */
export function generateSwissPairing(state: TournamentState): Table[] {
  const players = [...state.players];

  // Sort by points (desc), then by VP (desc), then by efficiency (asc)
  players.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.totalVP !== a.totalVP) return b.totalVP - a.totalVP;
    return a.efficiency - b.efficiency;
  });

  const playerIds = players.map((p) => p.id);
  const playerMap = new Map(state.players.map((p) => [p.id, p]));

  // Try to create valid pairings with anti-repeat logic
  const validPods = createValidPods(playerIds, playerMap);

  return validPods.map((pod, index) => ({
    id: index + 1,
    playerIds: pod,
    results: [],
    isComplete: false,
  }));
}

/**
 * Anti-repeat pairing: tries to arrange players so no two have met before.
 * Uses a greedy approach with backtracking.
 */
function createValidPods(
  sortedIds: string[],
  playerMap: Map<string, Player>
): string[][] {
  const count = sortedIds.length;
  let remainder = count % 4;
  let tablesOf3 = 0;
  if (remainder === 1) tablesOf3 = 3;
  else if (remainder === 2) tablesOf3 = 2;
  else if (remainder === 3) tablesOf3 = 1;

  const numTablesOf4 = (count - tablesOf3 * 3) / 4;
  const tableSizes: number[] = [];
  for (let i = 0; i < numTablesOf4; i++) tableSizes.push(4);
  for (let i = 0; i < tablesOf3; i++) tableSizes.push(3);

  // Group players by point brackets for Swiss-style
  const brackets = new Map<number, string[]>();
  for (const id of sortedIds) {
    const p = playerMap.get(id)!;
    const pts = p.points;
    if (!brackets.has(pts)) brackets.set(pts, []);
    brackets.get(pts)!.push(id);
  }

  // Flatten brackets (highest points first) with shuffle within brackets
  const orderedIds: string[] = [];
  const sortedBrackets = [...brackets.entries()].sort((a, b) => b[0] - a[0]);
  for (const [, ids] of sortedBrackets) {
    // Shuffle within bracket for variety
    shuffleArray(ids);
    orderedIds.push(...ids);
  }

  // Greedy assignment to tables
  const tables: string[][] = tableSizes.map(() => []);
  const assigned = new Set<string>();

  for (const playerId of orderedIds) {
    if (assigned.has(playerId)) continue;

    const player = playerMap.get(playerId)!;
    let bestTable = -1;
    let bestConflicts = Infinity;

    for (let t = 0; t < tables.length; t++) {
      if (tables[t].length >= tableSizes[t]) continue;

      // Count how many players at this table have already faced this player
      let conflicts = 0;
      for (const otherId of tables[t]) {
        if (player.opponents.includes(otherId)) {
          conflicts++;
        }
      }

      if (conflicts < bestConflicts) {
        bestConflicts = conflicts;
        bestTable = t;
      }
    }

    if (bestTable >= 0) {
      tables[bestTable].push(playerId);
      assigned.add(playerId);
    }
  }

  return tables.filter((t) => t.length > 0);
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ===== TOP 8 FINALS =====

/**
 * Generate semifinal tables for Round 5:
 * Table A: seeds 1, 4, 5, 8
 * Table B: seeds 2, 3, 6, 7
 */
export function generateSemifinals(state: TournamentState): Table[] {
  const top8 = getTop8(state);
  if (top8.length < 8) return [];

  return [
    {
      id: 1,
      playerIds: [top8[0].id, top8[3].id, top8[4].id, top8[7].id],
      results: [],
      isComplete: false,
    },
    {
      id: 2,
      playerIds: [top8[1].id, top8[2].id, top8[5].id, top8[6].id],
      results: [],
      isComplete: false,
    },
  ];
}

/**
 * Generate Winners Final & Losers Final from semifinal results.
 * Winners Final: Top 2 from Table A + Top 2 from Table B
 * Losers Final: Bottom 2 from Table A + Bottom 2 from Table B
 */
export function generateFinalsRound6(semiRound: Round): { winners: Table; losers: Table } {
  const tableA = semiRound.tables[0];
  const tableB = semiRound.tables[1];

  const sortByResult = (table: Table) => {
    return [...table.results].sort((a, b) => a.position - b.position);
  };

  const sortedA = sortByResult(tableA);
  const sortedB = sortByResult(tableB);

  return {
    winners: {
      id: 1,
      playerIds: [sortedA[0].playerId, sortedA[1].playerId, sortedB[0].playerId, sortedB[1].playerId],
      results: [],
      isComplete: false,
    },
    losers: {
      id: 2,
      playerIds: [sortedA[2].playerId, sortedA[3]?.playerId, sortedB[2].playerId, sortedB[3]?.playerId].filter(Boolean),
      results: [],
      isComplete: false,
    },
  };
}

/**
 * Generate Grand Final from Winners Final and Losers Final results.
 * Top 2 from Winners Final + Top 2 from Losers Final
 */
export function generateGrandFinal(winnersTable: Table, losersTable: Table): Table {
  const winnersTop2 = [...winnersTable.results]
    .sort((a, b) => a.position - b.position)
    .slice(0, 2)
    .map((r) => r.playerId);

  const losersTop2 = [...losersTable.results]
    .sort((a, b) => a.position - b.position)
    .slice(0, 2)
    .map((r) => r.playerId);

  return {
    id: 1,
    playerIds: [...winnersTop2, ...losersTop2],
    results: [],
    isComplete: false,
  };
}

// ===== SCORING =====

const POINTS: Record<number, number> = { 1: 5, 2: 3, 3: 2, 4: 1 };

export function applyResults(state: TournamentState, roundIndex: number): TournamentState {
  const newState = structuredClone(state);
  const round = newState.rounds[roundIndex];

  for (const table of round.tables) {
    if (!table.isComplete) continue;

    for (const result of table.results) {
      const player = newState.players.find((p) => p.id === result.playerId);
      if (!player) continue;

      player.points += POINTS[result.position] || 0;
      player.totalVP += result.vp;
      player.efficiency += result.position;

      // Track opponents
      for (const otherId of table.playerIds) {
        if (otherId !== result.playerId && !player.opponents.includes(otherId)) {
          player.opponents.push(otherId);
        }
      }
    }
  }

  return newState;
}

// ===== RANKINGS =====

export function getStandings(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.totalVP !== a.totalVP) return b.totalVP - a.totalVP;
    return a.efficiency - b.efficiency; // lower efficiency = better
  });
}

export function getTop8(state: TournamentState): Player[] {
  return getStandings(state.players).slice(0, 8);
}

/**
 * Final standings that respect Grand Final placement.
 * Once the Grand Final is complete:
 *   - Positions 1-4: Grand Final placement order (1st = champion)
 *   - Positions 5-8: Top 8 players who didn't reach Grand Final, sorted by cumulative stats
 *   - Positions 9+: Everyone else by cumulative stats
 * If Grand Final is not complete, falls back to cumulative standings.
 */
export function getFinalStandings(state: TournamentState): Player[] {
  const grandFinal = state.rounds.find((r) => r.type === "grand-final");

  // If no completed grand final, just use normal standings
  if (!grandFinal?.isComplete) {
    return getStandings(state.players);
  }

  const grandFinalResults = [...grandFinal.tables[0].results].sort(
    (a, b) => a.position - b.position
  );
  const grandFinalPlayerIds = new Set(grandFinalResults.map((r) => r.playerId));

  // Find all Top 8 player IDs (players who participated in any top8 round)
  const top8PlayerIds = new Set<string>();
  for (const round of state.rounds) {
    if (
      round.type === "semifinal" ||
      round.type === "winners-final" ||
      round.type === "losers-final" ||
      round.type === "grand-final"
    ) {
      for (const table of round.tables) {
        for (const pid of table.playerIds) {
          top8PlayerIds.add(pid);
        }
      }
    }
  }

  // Tier 1: Grand Final players in their Grand Final finishing order
  const tier1 = grandFinalResults
    .map((r) => state.players.find((p) => p.id === r.playerId))
    .filter(Boolean) as Player[];

  // Tier 2: Top 8 players NOT in Grand Final, sorted by cumulative stats
  const tier2Players = state.players.filter(
    (p) => top8PlayerIds.has(p.id) && !grandFinalPlayerIds.has(p.id)
  );
  const tier2 = getStandings(tier2Players);

  // Tier 3: Everyone else, sorted by cumulative stats
  const tier3Players = state.players.filter((p) => !top8PlayerIds.has(p.id));
  const tier3 = getStandings(tier3Players);

  return [...tier1, ...tier2, ...tier3];
}

// ===== LEADER STATISTICS =====

/**
 * Compute leader stats from all completed rounds.
 * Optionally filter by round range (e.g., a single round or cumulative).
 */
export function getLeaderStats(
  rounds: Round[],
  fromRound?: number,
  toRound?: number
): LeaderStat[] {
  const statsMap = new Map<string, { plays: number; wins: number; top2: number; totalVP: number; positionSum: number }>();

  for (const round of rounds) {
    if (!round.isComplete) continue;
    if (fromRound !== undefined && round.number < fromRound) continue;
    if (toRound !== undefined && round.number > toRound) continue;

    for (const table of round.tables) {
      for (const result of table.results) {
        if (!result.leader) continue;

        const leader = result.leader;
        if (!statsMap.has(leader)) {
          statsMap.set(leader, { plays: 0, wins: 0, top2: 0, totalVP: 0, positionSum: 0 });
        }

        const stat = statsMap.get(leader)!;
        stat.plays++;
        if (result.position === 1) stat.wins++;
        if (result.position <= 2) stat.top2++;
        stat.totalVP += result.vp;
        stat.positionSum += result.position;
      }
    }
  }

  const leaderStats: LeaderStat[] = [];
  for (const [leader, stat] of statsMap) {
    const info = getLeaderInfo(leader);
    leaderStats.push({
      leader,
      tier: info?.tier ?? "none",
      plays: stat.plays,
      wins: stat.wins,
      top2: stat.top2,
      totalVP: stat.totalVP,
      avgPosition: stat.plays > 0 ? +(stat.positionSum / stat.plays).toFixed(2) : 0,
      winRate: stat.plays > 0 ? +(stat.wins / stat.plays * 100).toFixed(1) : 0,
    });
  }

  // Sort by win rate (desc), then by plays (desc)
  leaderStats.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.plays - a.plays;
  });

  return leaderStats;
}

// ===== VALIDATION =====

export function validateImportSchema(data: unknown): data is TournamentState {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (!obj.metadata || !obj.players || !obj.settings) return false;
  if (!Array.isArray(obj.players)) return false;
  return true;
}
