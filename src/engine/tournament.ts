import type { Player, Table, Round, TournamentState } from "./types";
import type { LeaderStat, LeaderTier, LeaderInfo } from "./types";
import { LEADER_LIST, getLeaderInfo, getLeadersByTier } from "./types";

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

/** Maximum backtracking iterations before falling back to greedy. */
const MAX_BACKTRACK_ITERATIONS = 100_000;

/**
 * Anti-repeat pairing: arranges players so no two have met before.
 * Uses recursive backtracking with a hard no-rematch constraint.
 * Falls back to greedy conflict-minimization if no valid assignment exists
 * (e.g., too few players relative to rounds played).
 *
 * Player count MUST be divisible by 4 — all tables seat exactly 4.
 */
function createValidPods(
  sortedIds: string[],
  playerMap: Map<string, Player>
): string[][] {
  const count = sortedIds.length;
  const numTables = count / 4;

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
    shuffleArray(ids);
    orderedIds.push(...ids);
  }

  // Build opponent sets for O(1) lookup
  const opponentSets = new Map<string, Set<string>>();
  for (const id of orderedIds) {
    const p = playerMap.get(id)!;
    opponentSets.set(id, new Set(p.opponents));
  }

  // ── Backtracking solver ──

  const tables: string[][] = Array.from({ length: numTables }, () => []);
  let iterations = 0;

  /**
   * Check if placing `playerId` at `tables[tableIdx]` would cause a rematch.
   */
  function hasConflict(playerId: string, tableIdx: number): boolean {
    const opps = opponentSets.get(playerId)!;
    for (const otherId of tables[tableIdx]) {
      if (opps.has(otherId)) return true;
    }
    return false;
  }

  /**
   * Recursively assign players[playerIdx..] to tables.
   * Returns true if a complete valid assignment is found.
   */
  function solve(playerIdx: number): boolean {
    if (playerIdx === orderedIds.length) return true;
    if (++iterations > MAX_BACKTRACK_ITERATIONS) return false;

    const playerId = orderedIds[playerIdx];

    for (let t = 0; t < numTables; t++) {
      if (tables[t].length >= 4) continue;
      if (hasConflict(playerId, t)) continue;

      // Skip duplicate-shaped tables: if this table is empty and
      // a previous empty table exists, skip to avoid redundant branches
      if (tables[t].length === 0) {
        let hasPriorEmpty = false;
        for (let p = 0; p < t; p++) {
          if (tables[p].length === 0) { hasPriorEmpty = true; break; }
        }
        if (hasPriorEmpty) continue;
      }

      tables[t].push(playerId);
      if (solve(playerIdx + 1)) return true;
      tables[t].pop();
    }

    return false;
  }

  if (solve(0)) {
    return tables;
  }

  // ── Fallback: greedy conflict-minimization ──
  // Used when no conflict-free pairing exists (e.g., 8 players after 3+ rounds)

  const fallbackTables: string[][] = Array.from({ length: numTables }, () => []);

  for (const playerId of orderedIds) {
    const opps = opponentSets.get(playerId)!;
    let bestTable = -1;
    let bestConflicts = Infinity;

    for (let t = 0; t < numTables; t++) {
      if (fallbackTables[t].length >= 4) continue;

      let conflicts = 0;
      for (const otherId of fallbackTables[t]) {
        if (opps.has(otherId)) conflicts++;
      }

      if (conflicts < bestConflicts) {
        bestConflicts = conflicts;
        bestTable = t;
      }
    }

    if (bestTable >= 0) {
      fallbackTables[bestTable].push(playerId);
    }
  }

  return fallbackTables;
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ===== TOP 16 FINALS (True Double-Elimination Bracket) =====
//
// Top 8 seeds (Elite) get 2 chances to reach the Grand Final.
// Bottom 8 seeds (Challenger) get 1 chance.
//
// Round 6 — Semifinals:
//   Elite Table A:      Seeds 1, 4, 5, 8   (alternating high/low)
//   Elite Table B:      Seeds 2, 3, 6, 7   (alternating high/low)
//   Challenger Table C: Seeds 9, 10, 11, 12
//   Challenger Table D: Seeds 13, 14, 15, 16
//
// Round 7 — Redemption Round:
//   Redemption 1 ("Trial of Gom Jabbar"): 2nd/3rd/4th from Elite A + 1st from Challenger C
//   Redemption 2 ("Water of Life"):       2nd/3rd/4th from Elite B + 1st from Challenger D
//
// Round 8 — Grand Final:
//   1st from Elite A + 1st from Elite B + Winner Redemption 1 + Winner Redemption 2

/**
 * Get top 16 players by standings.
 */
export function getTopCut(state: TournamentState): Player[] {
  return getStandings(state.players).slice(0, state.settings.topCut);
}

/**
 * Generate semifinal tables for Round 6 (16 players → 4 tables of 4):
 *   Elite Table A:      Seeds 1, 4, 5, 8
 *   Elite Table B:      Seeds 2, 3, 6, 7
 *   Challenger Table C: Seeds 9, 10, 11, 12
 *   Challenger Table D: Seeds 13, 14, 15, 16
 */
export function generateSemifinals(state: TournamentState): Table[] {
  const top16 = getTopCut(state);
  if (top16.length < 16) return [];

  return [
    // Elite Table A: seeds 1, 4, 5, 8
    {
      id: 1,
      playerIds: [top16[0].id, top16[3].id, top16[4].id, top16[7].id],
      results: [],
      isComplete: false,
    },
    // Elite Table B: seeds 2, 3, 6, 7
    {
      id: 2,
      playerIds: [top16[1].id, top16[2].id, top16[5].id, top16[6].id],
      results: [],
      isComplete: false,
    },
    // Challenger Table C: seeds 9, 10, 11, 12
    {
      id: 3,
      playerIds: [top16[8].id, top16[9].id, top16[10].id, top16[11].id],
      results: [],
      isComplete: false,
    },
    // Challenger Table D: seeds 13, 14, 15, 16
    {
      id: 4,
      playerIds: [top16[12].id, top16[13].id, top16[14].id, top16[15].id],
      results: [],
      isComplete: false,
    },
  ];
}

/**
 * Generate Round 7 Redemption tables from semifinal results (8 players → 2 tables of 4):
 *
 *   Redemption 1 ("Trial of Gom Jabbar"):
 *     2nd, 3rd, 4th from Elite A  +  1st from Challenger C
 *
 *   Redemption 2 ("Water of Life"):
 *     2nd, 3rd, 4th from Elite B  +  1st from Challenger D
 *
 * Challenger 2nd-4th from C and D are ELIMINATED after Round 6.
 * Elite 1st from A and B advance directly to Grand Final.
 */
export function generateFinalsRound6(semiRound: Round): Table[] {
  const [eliteA, eliteB, challengerC, challengerD] = semiRound.tables;

  const sortByResult = (table: Table) => {
    return [...table.results].sort((a, b) => a.position - b.position);
  };

  const sortedA = sortByResult(eliteA);
  const sortedB = sortByResult(eliteB);
  const sortedC = sortByResult(challengerC);
  const sortedD = sortByResult(challengerD);

  return [
    // Redemption 1 ("Trial of Gom Jabbar"): 2nd/3rd/4th from Elite A + 1st from Challenger C
    {
      id: 1,
      playerIds: [
        sortedA[1].playerId,
        sortedA[2].playerId,
        sortedA[3].playerId,
        sortedC[0].playerId,
      ],
      results: [],
      isComplete: false,
    },
    // Redemption 2 ("Water of Life"): 2nd/3rd/4th from Elite B + 1st from Challenger D
    {
      id: 2,
      playerIds: [
        sortedB[1].playerId,
        sortedB[2].playerId,
        sortedB[3].playerId,
        sortedD[0].playerId,
      ],
      results: [],
      isComplete: false,
    },
  ];
}

/**
 * Generate Grand Final (1 table of 4):
 *   1st from Elite A  +  1st from Elite B
 *   + Winner of Redemption 1  +  Winner of Redemption 2
 */
export function generateGrandFinal(semiRound: Round, redemptionRound: Round): Table {
  const sortByResult = (table: Table) =>
    [...table.results].sort((a, b) => a.position - b.position);

  // Elite winners: 1st place from Elite A (tables[0]) and Elite B (tables[1])
  const eliteAWinner = sortByResult(semiRound.tables[0])[0].playerId;
  const eliteBWinner = sortByResult(semiRound.tables[1])[0].playerId;

  // Redemption winners: 1st place from each Redemption table
  const redemption1Winner = sortByResult(redemptionRound.tables[0])[0].playerId;
  const redemption2Winner = sortByResult(redemptionRound.tables[1])[0].playerId;

  return {
    id: 1,
    playerIds: [eliteAWinner, eliteBWinner, redemption1Winner, redemption2Winner],
    results: [],
    isComplete: false,
  };
}

// ===== SCORING =====

const POINTS: Record<number, number> = { 1: 6, 2: 3, 3: 2, 4: 1 };

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

/**
 * Revert scoring for a single table that was previously completed.
 * Used when editing results on a table that has already been scored.
 */
export function revertTableResults(state: TournamentState, roundIndex: number, tableId: number): TournamentState {
  const newState = structuredClone(state);
  const round = newState.rounds[roundIndex];
  if (!round) return newState;

  const table = round.tables.find((t) => t.id === tableId);
  if (!table || !table.isComplete || table.results.length === 0) return newState;

  for (const result of table.results) {
    const player = newState.players.find((p) => p.id === result.playerId);
    if (!player) continue;

    player.points -= POINTS[result.position] || 0;
    player.totalVP -= result.vp;
    player.efficiency -= result.position;

    // Remove opponents that were added when this table was scored.
    // Note: this is safe for qualifying rounds where the no-rematch
    // constraint prevents the same pair meeting at multiple tables.
    for (const otherId of table.playerIds) {
      if (otherId !== result.playerId) {
        player.opponents = player.opponents.filter((id) => id !== otherId);
      }
    }
  }

  return newState;
}

/**
 * Apply scoring for a single table.
 */
export function applyTableResults(state: TournamentState, roundIndex: number, tableId: number): TournamentState {
  const newState = structuredClone(state);
  const round = newState.rounds[roundIndex];
  if (!round) return newState;

  const table = round.tables.find((t) => t.id === tableId);
  if (!table || !table.isComplete || table.results.length === 0) return newState;

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
  return getStandings(state.players).slice(0, state.settings.topCut);
}

/**
 * Final standings that respect the double-elimination bracket.
 * Once the Grand Final is complete:
 *
 *   Tier 1 (pos 1-4):  Grand Final placement order (1st = Emperor)
 *   Tier 2 (pos 5-10): Redemption Round losers (2nd-4th from each Redemption table)
 *                       — sorted by Round 6 placement, then cumulative points
 *   Tier 3 (pos 11-16): Eliminated in Round 5 (Challenger 2nd-4th from C/D)
 *                        — sorted by cumulative stats
 *   Tier 4 (pos 17+):  Everyone else by cumulative stats
 *
 * If Grand Final is not complete, falls back to cumulative standings.
 */
export function getFinalStandings(state: TournamentState): Player[] {
  const grandFinal = state.rounds.find((r) => r.type === "grand-final");

  // If no completed grand final, just use normal standings
  if (!grandFinal?.isComplete) {
    return getStandings(state.players);
  }

  // ── Tier 1: Grand Final finishers in placement order ──
  const grandFinalResults = [...grandFinal.tables[0].results].sort(
    (a, b) => a.position - b.position
  );
  const grandFinalPlayerIds = new Set(grandFinalResults.map((r) => r.playerId));

  const tier1 = grandFinalResults
    .map((r) => state.players.find((p) => p.id === r.playerId))
    .filter(Boolean) as Player[];

  // ── Tier 2: Redemption Round losers (positions 2-4 from each Redemption table) ──
  const redemptionRound = state.rounds.find((r) => r.type === "winners-final");
  const redemptionPlayerIds = new Set<string>();
  let tier2: Player[] = [];

  if (redemptionRound?.isComplete) {
    // Collect results from both Redemption tables, excluding winners (pos 1)
    const redemptionLosers: { playerId: string; position: number }[] = [];

    for (const table of redemptionRound.tables) {
      for (const result of table.results) {
        redemptionPlayerIds.add(result.playerId);
        if (result.position > 1) {
          redemptionLosers.push({ playerId: result.playerId, position: result.position });
        }
      }
    }

    // Sort by Round 6 placement first, then by cumulative points (desc), then VP (desc)
    redemptionLosers.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      const pa = state.players.find((p) => p.id === a.playerId)!;
      const pb = state.players.find((p) => p.id === b.playerId)!;
      if (pb.points !== pa.points) return pb.points - pa.points;
      if (pb.totalVP !== pa.totalVP) return pb.totalVP - pa.totalVP;
      return pa.efficiency - pb.efficiency;
    });

    tier2 = redemptionLosers
      .map((r) => state.players.find((p) => p.id === r.playerId))
      .filter(Boolean) as Player[];
  }

  // ── Collect all Top 16 player IDs ──
  const topCutPlayerIds = new Set<string>();
  for (const round of state.rounds) {
    if (
      round.type === "semifinal" ||
      round.type === "winners-final" ||
      round.type === "losers-final" ||
      round.type === "grand-final"
    ) {
      for (const table of round.tables) {
        for (const pid of table.playerIds) {
          topCutPlayerIds.add(pid);
        }
      }
    }
  }

  // ── Tier 3: Eliminated in Round 5 (didn't reach Redemption or Grand Final) ──
  const tier3Players = state.players.filter(
    (p) =>
      topCutPlayerIds.has(p.id) &&
      !grandFinalPlayerIds.has(p.id) &&
      !redemptionPlayerIds.has(p.id)
  );
  const tier3 = getStandings(tier3Players);

  // ── Tier 4: Everyone else ──
  const tier4Players = state.players.filter((p) => !topCutPlayerIds.has(p.id));
  const tier4 = getStandings(tier4Players);

  return [...tier1, ...tier2, ...tier3, ...tier4];
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
  const statsMap = new Map<string, { plays: number; wins: number; top2: number; totalVP: number; positionSum: number; roundsAvailable: number }>();

  for (const round of rounds) {
    if (!round.isComplete) continue;
    if (fromRound !== undefined && round.number < fromRound) continue;
    if (toRound !== undefined && round.number > toRound) continue;

    // Track which leaders were available this round
    const available = new Set(round.availableLeaders ?? []);
    for (const name of available) {
      if (!statsMap.has(name)) {
        statsMap.set(name, { plays: 0, wins: 0, top2: 0, totalVP: 0, positionSum: 0, roundsAvailable: 0 });
      }
      statsMap.get(name)!.roundsAvailable++;
    }

    for (const table of round.tables) {
      for (const result of table.results) {
        if (!result.leader) continue;

        const leader = result.leader;
        if (!statsMap.has(leader)) {
          statsMap.set(leader, { plays: 0, wins: 0, top2: 0, totalVP: 0, positionSum: 0, roundsAvailable: 0 });
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
      roundsAvailable: stat.roundsAvailable,
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

// ===== LEADER TIER SELECTION =====

/**
 * Determine which leader tier to use for a given round.
 * Qualifying rounds cycle: 1→A, 2→B, 3→C, 4→A, 5→B.
 * Top-8 rounds → C tier.
 */
export function getTierForRound(roundNumber: number, isTop8: boolean): LeaderTier {
  if (isTop8) return "C";
  const TIER_CYCLE: LeaderTier[] = ["A", "B", "C"];
  return TIER_CYCLE[(roundNumber - 1) % TIER_CYCLE.length];
}

/**
 * Pick a random leader tier (A, B, or C) for the Grand Final.
 */
export function randomTier(): LeaderTier {
  const TIERS: LeaderTier[] = ["A", "B", "C"];
  return TIERS[Math.floor(Math.random() * TIERS.length)];
}

/**
 * Select leaders for a round from the given tier's pool.
 * Tier C returns ALL available leaders (used in elimination rounds).
 * Other tiers draw 7 random leaders via Fisher-Yates shuffle.
 */
export function selectRoundLeaders(tier: LeaderTier): LeaderInfo[] {
  const pool = getLeadersByTier(tier);
  const shuffled = [...pool];
  shuffleArray(shuffled);
  if (tier === "C") return shuffled;
  return shuffled.slice(0, 7);
}

// ===== DATA MIGRATION =====

/** Map from legacy camelCase leader id → current display name */
const LEADER_ID_TO_NAME = new Map<string, string>(
  LEADER_LIST.map((l) => [l.id, l.name])
);

/**
 * Migrate old leader id slugs (e.g. "paulAtreides") to current display names
 * (e.g. "Paul Atreides") in all table results. Idempotent — display names that
 * already match a LEADER_LIST entry are left untouched.
 */
export function migrateLeaderNames(state: TournamentState): TournamentState {
  let changed = false;

  for (const round of state.rounds) {
    for (const table of round.tables) {
      for (const result of table.results) {
        if (!result.leader) continue;
        // Already a valid display name — skip
        if (getLeaderInfo(result.leader)) continue;
        // Try matching by legacy id
        const displayName = LEADER_ID_TO_NAME.get(result.leader);
        if (displayName) {
          result.leader = displayName;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    state.metadata.timestamp = new Date().toISOString();
  }
  return state;
}

// ===== VALIDATION =====

export function validateImportSchema(data: unknown): data is TournamentState {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (!obj.metadata || !obj.players || !obj.settings) return false;
  if (!Array.isArray(obj.players)) return false;
  return true;
}
