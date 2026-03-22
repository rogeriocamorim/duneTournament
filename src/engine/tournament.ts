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
    wins: 0,
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
 * Golf-style pairing: rank players by standings, then snake-draft across
 * tables so each table gets a mix of top, middle, and bottom players.
 * Anti-rematch backtracking ensures no two players meet twice where possible.
 *
 * Snake-draft example (16 players, 4 tables):
 *   T1: ranks 1, 8, 9, 16
 *   T2: ranks 2, 7, 10, 15
 *   T3: ranks 3, 6, 11, 14
 *   T4: ranks 4, 5, 12, 13
 */
export function generateSwissPairing(state: TournamentState): Table[] {
  const players = [...state.players];

  // Pre-compute VP Share % for sorting
  const vpShareCache = new Map<string, number>();
  for (const p of players) {
    vpShareCache.set(p.id, getVpSharePct(p.id, state.rounds));
  }

  // Sort by points (desc), wins (desc), VP (desc), vpSharePct (desc), efficiency (asc)
  players.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.totalVP !== a.totalVP) return b.totalVP - a.totalVP;
    const aShare = vpShareCache.get(a.id) ?? 0;
    const bShare = vpShareCache.get(b.id) ?? 0;
    if (bShare !== aShare) return bShare - aShare;
    return a.efficiency - b.efficiency;
  });

  const playerIds = players.map((p) => p.id);
  const playerMap = new Map(state.players.map((p) => [p.id, p]));

  // Try to create valid pairings with golf-style anti-repeat logic
  const validPods = createGolfPods(playerIds, playerMap);

  return validPods.map((pod, index) => ({
    id: index + 1,
    playerIds: pod,
    results: [],
    isComplete: false,
  }));
}

/**
 * Compute the snake-draft preferred table index for each rank position.
 * Alternates direction each row of T assignments:
 *   Row 0 (left→right): ranks 0..T-1 → tables 0..T-1
 *   Row 1 (right→left): ranks T..2T-1 → tables T-1..0
 *   Row 2 (left→right): ranks 2T..3T-1 → tables 0..T-1
 *   Row 3 (right→left): ranks 3T..4T-1 → tables T-1..0
 */
export function snakeDraftOrder(playerCount: number): number[] {
  const numTables = playerCount / 4;
  const preferred: number[] = [];
  for (let i = 0; i < playerCount; i++) {
    const row = Math.floor(i / numTables);
    const col = i % numTables;
    const tableIdx = row % 2 === 0 ? col : numTables - 1 - col;
    preferred.push(tableIdx);
  }
  return preferred;
}

/** Maximum backtracking iterations before falling back to greedy. */
const MAX_BACKTRACK_ITERATIONS = 100_000;

/**
 * Golf-style anti-repeat pairing: distributes players across tables using
 * snake-draft for skill balance, with backtracking to avoid rematches.
 *
 * The solver tries each player's preferred (snake-draft) table first,
 * then falls back to other tables. This biases toward balanced tables
 * while still guaranteeing no rematches when possible.
 *
 * Falls back to greedy conflict-minimization if no valid assignment exists
 * (e.g., too few players relative to rounds played).
 *
 * Player count MUST be divisible by 4 — all tables seat exactly 4.
 */
function createGolfPods(
  sortedIds: string[],
  playerMap: Map<string, Player>
): string[][] {
  const count = sortedIds.length;
  const numTables = count / 4;

  // Build opponent sets for O(1) lookup
  const opponentSets = new Map<string, Set<string>>();
  for (const id of sortedIds) {
    const p = playerMap.get(id)!;
    opponentSets.set(id, new Set(p.opponents));
  }

  // Compute preferred table for each player rank via snake draft
  const preferredTable = snakeDraftOrder(count);

  // ── Backtracking solver ──
  // Process players in rank order. For each player, try their preferred
  // (snake-draft) table first, then the remaining tables in order.
  // This biases toward golf-style distribution while allowing swaps
  // to resolve rematch conflicts.

  const tables: string[][] = Array.from({ length: numTables }, () => []);
  let iterations = 0;

  function hasConflict(playerId: string, tableIdx: number): boolean {
    const opps = opponentSets.get(playerId)!;
    for (const otherId of tables[tableIdx]) {
      if (opps.has(otherId)) return true;
    }
    return false;
  }

  /**
   * Build table-try order: preferred table first, then the rest in order.
   */
  function tableOrder(playerIdx: number): number[] {
    const pref = preferredTable[playerIdx];
    const order = [pref];
    for (let t = 0; t < numTables; t++) {
      if (t !== pref) order.push(t);
    }
    return order;
  }

  function solve(playerIdx: number): boolean {
    if (playerIdx === sortedIds.length) return true;
    if (++iterations > MAX_BACKTRACK_ITERATIONS) return false;

    const playerId = sortedIds[playerIdx];

    for (const t of tableOrder(playerIdx)) {
      if (tables[t].length >= 4) continue;
      if (hasConflict(playerId, t)) continue;

      tables[t].push(playerId);
      if (solve(playerIdx + 1)) return true;
      tables[t].pop();
    }

    return false;
  }

  if (solve(0)) {
    return tables;
  }

  // ── Fallback: greedy conflict-minimization with golf preference ──
  // Used when no conflict-free pairing exists (e.g., 8 players after 3+ rounds).
  // Prefers the snake-draft table, breaking ties by fewest conflicts.

  const fallbackTables: string[][] = Array.from({ length: numTables }, () => []);

  for (let i = 0; i < sortedIds.length; i++) {
    const playerId = sortedIds[i];
    const opps = opponentSets.get(playerId)!;
    let bestTable = -1;
    let bestConflicts = Infinity;
    let bestIsPreferred = false;

    for (const t of tableOrder(i)) {
      if (fallbackTables[t].length >= 4) continue;

      let conflicts = 0;
      for (const otherId of fallbackTables[t]) {
        if (opps.has(otherId)) conflicts++;
      }

      const isPreferred = t === preferredTable[i];

      // Pick this table if: fewer conflicts, OR same conflicts but preferred
      if (
        conflicts < bestConflicts ||
        (conflicts === bestConflicts && isPreferred && !bestIsPreferred)
      ) {
        bestConflicts = conflicts;
        bestTable = t;
        bestIsPreferred = isPreferred;
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
  return getStandings(state.players, state.rounds).slice(0, state.settings.topCut);
}

/**
 * Generate semifinal tables for Round 6 (16 players → 4 tables of 4):
 *   Elite Table A:      Seeds 1, 4, 5, 8
 *   Elite Table B:      Seeds 2, 3, 6, 7
 *   Challenger Table C: Seeds 9, 12, 13, 16
 *   Challenger Table D: Seeds 10, 11, 14, 15
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
    // Challenger Table C: seeds 9, 12, 13, 16
    {
      id: 3,
      playerIds: [top16[8].id, top16[11].id, top16[12].id, top16[15].id],
      results: [],
      isComplete: false,
    },
    // Challenger Table D: seeds 10, 11, 14, 15
    {
      id: 4,
      playerIds: [top16[9].id, top16[10].id, top16[13].id, top16[14].id],
      results: [],
      isComplete: false,
    },
  ];
}

/**
 * Generate Round 7 Redemption tables from semifinal results (10 players → 3 tables):
 *
 *   Table 1 — Finalists (bye table, 2 players, no game played):
 *     1st from Elite A  +  1st from Elite B
 *     → Advance directly to Grand Final
 *
 *   Table 2 — Lower Final 1 (4 players):
 *     1st from Challenger C  +  3 random Elite losers (min 1 from each Elite table)
 *
 *   Table 3 — Lower Final 2 (4 players):
 *     1st from Challenger D  +  3 remaining Elite losers
 *
 * Challenger 2nd-4th from C and D are ELIMINATED after Round 6.
 * 6 Elite losers (2nd-4th from A and B) are randomly split between the two Lower Finals,
 * with at least 1 from each Elite table in each Lower Final.
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

  // Elite winners advance to Finalists bye table
  const eliteAWinner = sortedA[0].playerId;
  const eliteBWinner = sortedB[0].playerId;

  // Elite losers (2nd-4th from each Elite table)
  const eliteALosers = [sortedA[1].playerId, sortedA[2].playerId, sortedA[3].playerId];
  const eliteBLosers = [sortedB[1].playerId, sortedB[2].playerId, sortedB[3].playerId];

  // Challenger winners
  const challCWinner = sortedC[0].playerId;
  const challDWinner = sortedD[0].playerId;

  // Randomly distribute 6 Elite losers across 2 Lower Finals (3 each),
  // with at least 1 from each Elite table in each Lower Final.
  // Strategy: shuffle each group, pick 1 from A and 1 from B for LF1,
  // then pick 1 more randomly from the remaining 4 for LF1, rest go to LF2.
  const shuffledALosers = [...eliteALosers];
  shuffleArray(shuffledALosers);
  const shuffledBLosers = [...eliteBLosers];
  shuffleArray(shuffledBLosers);

  // Guarantee 1 from A, 1 from B in Lower Final 1
  const lf1FromA = [shuffledALosers.pop()!];
  const lf1FromB = [shuffledBLosers.pop()!];

  // Remaining 4 losers: 2 from A, 2 from B — pick 1 more for LF1 randomly
  const remainingPool = [
    ...shuffledALosers.map((id) => ({ id, source: "A" as const })),
    ...shuffledBLosers.map((id) => ({ id, source: "B" as const })),
  ];
  shuffleArray(remainingPool);
  const thirdForLf1 = remainingPool.pop()!;
  const lf2Remaining = remainingPool.map((e) => e.id);

  const lf1Players = [challCWinner, ...lf1FromA, ...lf1FromB, thirdForLf1.id];
  const lf2Players = [challDWinner, ...lf2Remaining];

  return [
    // Table 1 — Finalists (bye table, no game)
    {
      id: 1,
      playerIds: [eliteAWinner, eliteBWinner],
      results: [],
      isComplete: false,
    },
    // Table 2 — Lower Final 1
    {
      id: 2,
      playerIds: lf1Players,
      results: [],
      isComplete: false,
    },
    // Table 3 — Lower Final 2
    {
      id: 3,
      playerIds: lf2Players,
      results: [],
      isComplete: false,
    },
  ];
}

/**
 * Generate Grand Final (1 table of 4):
 *   2 Finalists from bye table (table 1 of redemption round)
 *   + Winner of Lower Final 1 (table 2)  +  Winner of Lower Final 2 (table 3)
 */
export function generateGrandFinal(redemptionRound: Round): Table {
  const sortByResult = (table: Table) =>
    [...table.results].sort((a, b) => a.position - b.position);

  // Finalists from bye table (table id 1 — 2 players who auto-advance)
  const byeTable = redemptionRound.tables[0];
  const finalists = byeTable.playerIds;

  // Lower Final winners: 1st place from each Lower Final table
  const lf1Winner = sortByResult(redemptionRound.tables[1])[0].playerId;
  const lf2Winner = sortByResult(redemptionRound.tables[2])[0].playerId;

  return {
    id: 1,
    playerIds: [...finalists, lf1Winner, lf2Winner],
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
      if (result.position === 1) player.wins++;

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
    if (result.position === 1) player.wins--;

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
    if (result.position === 1) player.wins++;

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

/**
 * Compute VP Share % for a player across all completed rounds.
 * Per game: (playerVP / tableTotal VP) × 100
 * Overall: mean of all per-game percentages
 */
export function getVpSharePct(playerId: string, rounds: Round[]): number {
  let totalPct = 0;
  let gamesPlayed = 0;

  for (const round of rounds) {
    if (!round.isComplete) continue;
    for (const table of round.tables) {
      if (!table.isComplete || table.results.length === 0) continue;
      const playerResult = table.results.find((r) => r.playerId === playerId);
      if (!playerResult) continue;

      const tableTotal = table.results.reduce((sum, r) => sum + r.vp, 0);
      if (tableTotal > 0) {
        totalPct += (playerResult.vp / tableTotal) * 100;
      }
      gamesPlayed++;
    }
  }

  return gamesPlayed > 0 ? totalPct / gamesPlayed : 0;
}

export function getStandings(players: Player[], rounds: Round[] = []): Player[] {
  // Pre-compute VP Share % for all players to avoid recalculating per comparison
  const vpShareCache = new Map<string, number>();
  for (const p of players) {
    vpShareCache.set(p.id, getVpSharePct(p.id, rounds));
  }

  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aShare = vpShareCache.get(a.id) ?? 0;
    const bShare = vpShareCache.get(b.id) ?? 0;
    if (bShare !== aShare) return bShare - aShare;
    if (b.totalVP !== a.totalVP) return b.totalVP - a.totalVP;
    return a.efficiency - b.efficiency; // lower efficiency = better
  });
}

export function getTop8(state: TournamentState): Player[] {
  return getStandings(state.players, state.rounds).slice(0, state.settings.topCut);
}

/**
 * Final standings that respect the double-elimination bracket.
 * Once the Grand Final is complete:
 *
 *   Tier 1 (pos 1-4):  Grand Final placement order (1st = Emperor)
 *   Tier 2 (pos 5-10): Lower Final losers (2nd-4th from each Lower Final table)
 *                       — sorted by LF placement, then cumulative points
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
    return getStandings(state.players, state.rounds);
  }

  // ── Tier 1: Grand Final finishers in placement order ──
  const grandFinalResults = [...grandFinal.tables[0].results].sort(
    (a, b) => a.position - b.position
  );
  const grandFinalPlayerIds = new Set(grandFinalResults.map((r) => r.playerId));

  const tier1 = grandFinalResults
    .map((r) => state.players.find((p) => p.id === r.playerId))
    .filter(Boolean) as Player[];

  // ── Tier 2: Lower Final losers (positions 2-4 from each Lower Final table) ──
  const redemptionRound = state.rounds.find((r) => r.type === "winners-final");
  const redemptionPlayerIds = new Set<string>();
  let tier2: Player[] = [];

  if (redemptionRound?.isComplete) {
    // Collect all player IDs from the redemption round (all 3 tables)
    for (const table of redemptionRound.tables) {
      for (const pid of table.playerIds) {
        redemptionPlayerIds.add(pid);
      }
    }

    // Lower Final tables are tables[1] and tables[2] (table[0] is the bye table)
    const lowerFinalTables = redemptionRound.tables.slice(1);
    const lowerFinalLosers: { playerId: string; position: number }[] = [];

    for (const table of lowerFinalTables) {
      for (const result of table.results) {
        if (result.position > 1) {
          lowerFinalLosers.push({ playerId: result.playerId, position: result.position });
        }
      }
    }

    // Sort by LF placement first, then by cumulative points (desc), wins (desc), VP (desc), vpSharePct (desc), efficiency (asc)
    const tier2VpShareCache = new Map<string, number>();
    for (const r of lowerFinalLosers) {
      tier2VpShareCache.set(r.playerId, getVpSharePct(r.playerId, state.rounds));
    }

    lowerFinalLosers.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      const pa = state.players.find((p) => p.id === a.playerId)!;
      const pb = state.players.find((p) => p.id === b.playerId)!;
      if (pb.points !== pa.points) return pb.points - pa.points;
      if (pb.wins !== pa.wins) return pb.wins - pa.wins;
      if (pb.totalVP !== pa.totalVP) return pb.totalVP - pa.totalVP;
      const aShare = tier2VpShareCache.get(a.playerId) ?? 0;
      const bShare = tier2VpShareCache.get(b.playerId) ?? 0;
      if (bShare !== aShare) return bShare - aShare;
      return pa.efficiency - pb.efficiency;
    });

    tier2 = lowerFinalLosers
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
  const tier3 = getStandings(tier3Players, state.rounds);

  // ── Tier 4: Everyone else ──
  const tier4Players = state.players.filter((p) => !topCutPlayerIds.has(p.id));
  const tier4 = getStandings(tier4Players, state.rounds);

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

/**
 * Backfill the `wins` field on every player by scanning all completed rounds.
 * Used when loading state saved before the `wins` field was introduced.
 * Safe to call multiple times — it recomputes from scratch.
 */
export function backfillPlayerWins(state: TournamentState): void {
  // Reset all wins to 0 before recomputing
  for (const player of state.players) {
    player.wins = player.wins ?? 0;
  }

  const playerMap = new Map(state.players.map((p) => [p.id, p]));
  // Only count wins from rounds whose scoring was applied (isComplete)
  for (const round of state.rounds) {
    if (!round.isComplete) continue;
    for (const table of round.tables) {
      for (const result of table.results) {
        if (result.position === 1) {
          const player = playerMap.get(result.playerId);
          if (player) player.wins++;
        }
      }
    }
  }
}

/**
 * Count how many completed rounds a player has participated in.
 */
export function getRoundsPlayed(playerId: string, rounds: Round[]): number {
  let count = 0;
  for (const round of rounds) {
    if (!round.isComplete) continue;
    for (const table of round.tables) {
      if (table.playerIds.includes(playerId)) {
        count++;
        break;
      }
    }
  }
  return count;
}

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
