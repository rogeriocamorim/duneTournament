import { describe, it, expect, beforeEach } from "vitest";
import type { Player, Round, Table, TournamentState } from "./types";
import { getLeadersByTier } from "./types";
import {
  generateSemifinals,
  generateFinalsRound6,
  generateGrandFinal,
  getFinalStandings,
  applyResults,
  getStandings,
  getTierForRound,
  selectRoundLeaders,
  migrateLeaderNames,
  generateSwissPairing,
  revertTableResults,
} from "./tournament";

// ===== TEST HELPERS =====

function makePlayer(id: string, name: string, points: number, totalVP: number, efficiency: number): Player {
  return { id, name, points, totalVP, efficiency, opponents: [] };
}

/**
 * Create 20 players ranked by descending points (seed 1 = highest).
 * Players 1-16 are the top cut, 17-20 fill out the roster.
 */
function make20Players(): Player[] {
  const names = [
    "Seed01", "Seed02", "Seed03", "Seed04",
    "Seed05", "Seed06", "Seed07", "Seed08",
    "Seed09", "Seed10", "Seed11", "Seed12",
    "Seed13", "Seed14", "Seed15", "Seed16",
    "Filler17", "Filler18", "Filler19", "Filler20",
  ];
  return names.map((name, i) => {
    const pts = 20 - i;       // 20, 19, 18, ... 1
    const vp = 40 - i * 2;    // 40, 38, 36, ... 2
    const eff = 4 + i;        // 4, 5, 6, ...
    return makePlayer(String(i + 1), name, pts, vp, eff);
  });
}

function makeState(players: Player[]): TournamentState {
  return {
    metadata: { version: "1.0.0", timestamp: "", tournamentName: "Test" },
    players,
    rounds: [],
    phase: "top8",
    currentRound: 6,
    settings: { totalQualifyingRounds: 5, topCut: 16, dramaticReveal: false, testMode: false },
  };
}

/** Build a completed Table with results for given player placements. */
function makeCompletedTable(id: number, placements: { playerId: string; position: number; vp: number }[]): Table {
  return {
    id,
    playerIds: placements.map((p) => p.playerId),
    results: placements.map((p) => ({ playerId: p.playerId, position: p.position, vp: p.vp })),
    isComplete: true,
  };
}

function makeRound(number: number, type: Round["type"], tables: Table[], isComplete = true): Round {
  return { number, tables, isComplete, type };
}

// ===== TESTS =====

describe("generateSemifinals", () => {
  let state: TournamentState;

  beforeEach(() => {
    state = makeState(make20Players());
  });

  it("produces exactly 4 tables of 4 players each", () => {
    const tables = generateSemifinals(state);
    expect(tables).toHaveLength(4);
    tables.forEach((t) => expect(t.playerIds).toHaveLength(4));
  });

  it("assigns Elite Table A seeds 1, 4, 5, 8", () => {
    const tables = generateSemifinals(state);
    const eliteA = tables[0].playerIds;
    // Players are sorted by standings; seed 1 = id "1", seed 4 = id "4", etc.
    expect(eliteA).toEqual(["1", "4", "5", "8"]);
  });

  it("assigns Elite Table B seeds 2, 3, 6, 7", () => {
    const tables = generateSemifinals(state);
    const eliteB = tables[1].playerIds;
    expect(eliteB).toEqual(["2", "3", "6", "7"]);
  });

  it("assigns Challenger Table C seeds 9, 10, 11, 12", () => {
    const tables = generateSemifinals(state);
    const challC = tables[2].playerIds;
    expect(challC).toEqual(["9", "10", "11", "12"]);
  });

  it("assigns Challenger Table D seeds 13, 14, 15, 16", () => {
    const tables = generateSemifinals(state);
    const challD = tables[3].playerIds;
    expect(challD).toEqual(["13", "14", "15", "16"]);
  });

  it("all 16 unique players are assigned across the 4 tables", () => {
    const tables = generateSemifinals(state);
    const allIds = tables.flatMap((t) => t.playerIds);
    expect(allIds).toHaveLength(16);
    expect(new Set(allIds).size).toBe(16);
  });

  it("tables start with empty results and not complete", () => {
    const tables = generateSemifinals(state);
    tables.forEach((t) => {
      expect(t.results).toEqual([]);
      expect(t.isComplete).toBe(false);
    });
  });

  it("returns empty array if fewer than 16 players", () => {
    state.players = state.players.slice(0, 15);
    const tables = generateSemifinals(state);
    expect(tables).toEqual([]);
  });

  it("uses standings order (not id order) for seeding", () => {
    // Swap points so player id "16" is actually the top seed
    state.players[0].points = 1;  // id "1" drops to bottom
    state.players[15].points = 99; // id "16" rises to top
    const tables = generateSemifinals(state);
    // Seed 1 should now be player "16"
    expect(tables[0].playerIds).toContain("16");
  });
});

describe("generateFinalsRound6", () => {
  let semiRound: Round;

  beforeEach(() => {
    // Elite A: players 1, 4, 5, 8 — player 1 wins, 4 second, 5 third, 8 fourth
    const eliteA = makeCompletedTable(1, [
      { playerId: "1", position: 1, vp: 12 },
      { playerId: "4", position: 2, vp: 9 },
      { playerId: "5", position: 3, vp: 6 },
      { playerId: "8", position: 4, vp: 3 },
    ]);
    // Elite B: players 2, 3, 6, 7 — player 2 wins
    const eliteB = makeCompletedTable(2, [
      { playerId: "2", position: 1, vp: 11 },
      { playerId: "3", position: 2, vp: 8 },
      { playerId: "6", position: 3, vp: 5 },
      { playerId: "7", position: 4, vp: 2 },
    ]);
    // Challenger C: players 9-12 — player 9 wins
    const challC = makeCompletedTable(3, [
      { playerId: "9", position: 1, vp: 10 },
      { playerId: "10", position: 2, vp: 7 },
      { playerId: "11", position: 3, vp: 4 },
      { playerId: "12", position: 4, vp: 1 },
    ]);
    // Challenger D: players 13-16 — player 13 wins
    const challD = makeCompletedTable(4, [
      { playerId: "13", position: 1, vp: 10 },
      { playerId: "14", position: 2, vp: 7 },
      { playerId: "15", position: 3, vp: 4 },
      { playerId: "16", position: 4, vp: 1 },
    ]);

    semiRound = makeRound(6, "semifinal", [eliteA, eliteB, challC, challD]);
  });

  it("produces exactly 2 redemption tables", () => {
    const tables = generateFinalsRound6(semiRound);
    expect(tables).toHaveLength(2);
  });

  it("each redemption table has 4 players", () => {
    const tables = generateFinalsRound6(semiRound);
    tables.forEach((t) => expect(t.playerIds).toHaveLength(4));
  });

  it("Redemption 1 has Elite A losers (2nd/3rd/4th) + Challenger C winner (1st)", () => {
    const tables = generateFinalsRound6(semiRound);
    const r1 = tables[0].playerIds;
    // Elite A 2nd/3rd/4th = players 4, 5, 8
    expect(r1).toContain("4");
    expect(r1).toContain("5");
    expect(r1).toContain("8");
    // Challenger C 1st = player 9
    expect(r1).toContain("9");
    // Must NOT contain Elite A winner
    expect(r1).not.toContain("1");
  });

  it("Redemption 2 has Elite B losers (2nd/3rd/4th) + Challenger D winner (1st)", () => {
    const tables = generateFinalsRound6(semiRound);
    const r2 = tables[1].playerIds;
    // Elite B 2nd/3rd/4th = players 3, 6, 7
    expect(r2).toContain("3");
    expect(r2).toContain("6");
    expect(r2).toContain("7");
    // Challenger D 1st = player 13
    expect(r2).toContain("13");
    // Must NOT contain Elite B winner
    expect(r2).not.toContain("2");
  });

  it("Elite A and B winners do NOT appear in any redemption table", () => {
    const tables = generateFinalsRound6(semiRound);
    const allIds = tables.flatMap((t) => t.playerIds);
    expect(allIds).not.toContain("1");
    expect(allIds).not.toContain("2");
  });

  it("Challenger C/D losers (2nd-4th) are ELIMINATED — not in redemption tables", () => {
    const tables = generateFinalsRound6(semiRound);
    const allIds = tables.flatMap((t) => t.playerIds);
    // Challenger C 2nd-4th
    expect(allIds).not.toContain("10");
    expect(allIds).not.toContain("11");
    expect(allIds).not.toContain("12");
    // Challenger D 2nd-4th
    expect(allIds).not.toContain("14");
    expect(allIds).not.toContain("15");
    expect(allIds).not.toContain("16");
  });

  it("8 unique players across both redemption tables, no overlap", () => {
    const tables = generateFinalsRound6(semiRound);
    const allIds = tables.flatMap((t) => t.playerIds);
    expect(allIds).toHaveLength(8);
    expect(new Set(allIds).size).toBe(8);
  });

  it("tables start empty and not complete", () => {
    const tables = generateFinalsRound6(semiRound);
    tables.forEach((t) => {
      expect(t.results).toEqual([]);
      expect(t.isComplete).toBe(false);
    });
  });

  it("works when results are in non-position order in the data", () => {
    // Shuffle the results order within Elite A — position field still defines ranking
    semiRound.tables[0].results = [
      { playerId: "8", position: 4, vp: 3 },
      { playerId: "1", position: 1, vp: 12 },
      { playerId: "5", position: 3, vp: 6 },
      { playerId: "4", position: 2, vp: 9 },
    ];
    const tables = generateFinalsRound6(semiRound);
    const r1 = tables[0].playerIds;
    // Should still pick Elite A 2nd/3rd/4th by position field
    expect(r1).toContain("4");
    expect(r1).toContain("5");
    expect(r1).toContain("8");
    expect(r1).not.toContain("1");
  });
});

describe("generateGrandFinal", () => {
  let semiRound: Round;
  let redemptionRound: Round;

  beforeEach(() => {
    // Semifinal round (R5) — same as above
    const eliteA = makeCompletedTable(1, [
      { playerId: "1", position: 1, vp: 12 },
      { playerId: "4", position: 2, vp: 9 },
      { playerId: "5", position: 3, vp: 6 },
      { playerId: "8", position: 4, vp: 3 },
    ]);
    const eliteB = makeCompletedTable(2, [
      { playerId: "2", position: 1, vp: 11 },
      { playerId: "3", position: 2, vp: 8 },
      { playerId: "6", position: 3, vp: 5 },
      { playerId: "7", position: 4, vp: 2 },
    ]);
    const challC = makeCompletedTable(3, [
      { playerId: "9", position: 1, vp: 10 },
      { playerId: "10", position: 2, vp: 7 },
      { playerId: "11", position: 3, vp: 4 },
      { playerId: "12", position: 4, vp: 1 },
    ]);
    const challD = makeCompletedTable(4, [
      { playerId: "13", position: 1, vp: 10 },
      { playerId: "14", position: 2, vp: 7 },
      { playerId: "15", position: 3, vp: 4 },
      { playerId: "16", position: 4, vp: 1 },
    ]);
    semiRound = makeRound(6, "semifinal", [eliteA, eliteB, challC, challD]);

    // Redemption round (R6)
    // Redemption 1: players 4, 5, 8, 9 — player 9 wins (Challenger redemption!)
    const redemption1 = makeCompletedTable(1, [
      { playerId: "9", position: 1, vp: 11 },
      { playerId: "4", position: 2, vp: 8 },
      { playerId: "5", position: 3, vp: 5 },
      { playerId: "8", position: 4, vp: 2 },
    ]);
    // Redemption 2: players 3, 6, 7, 13 — player 3 wins (Elite redemption!)
    const redemption2 = makeCompletedTable(2, [
      { playerId: "3", position: 1, vp: 10 },
      { playerId: "6", position: 2, vp: 7 },
      { playerId: "7", position: 3, vp: 4 },
      { playerId: "13", position: 4, vp: 1 },
    ]);
    redemptionRound = makeRound(7, "winners-final", [redemption1, redemption2]);
  });

  it("produces exactly 1 table with 4 players", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(table.playerIds).toHaveLength(4);
  });

  it("includes Elite A winner (1st from semifinal table 0)", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(table.playerIds).toContain("1"); // player 1 won Elite A
  });

  it("includes Elite B winner (1st from semifinal table 1)", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(table.playerIds).toContain("2"); // player 2 won Elite B
  });

  it("includes Redemption 1 winner", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(table.playerIds).toContain("9"); // player 9 won Redemption 1
  });

  it("includes Redemption 2 winner", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(table.playerIds).toContain("3"); // player 3 won Redemption 2
  });

  it("Grand Final has exactly {Elite A winner, Elite B winner, Redem1 winner, Redem2 winner}", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(new Set(table.playerIds)).toEqual(new Set(["1", "2", "9", "3"]));
  });

  it("does NOT include any redemption losers", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(table.playerIds).not.toContain("4");
    expect(table.playerIds).not.toContain("5");
    expect(table.playerIds).not.toContain("6");
    expect(table.playerIds).not.toContain("7");
    expect(table.playerIds).not.toContain("8");
    expect(table.playerIds).not.toContain("13");
  });

  it("table starts empty and not complete", () => {
    const table = generateGrandFinal(semiRound, redemptionRound);
    expect(table.results).toEqual([]);
    expect(table.isComplete).toBe(false);
  });
});

describe("getFinalStandings", () => {
  let state: TournamentState;

  /**
   * Build a full tournament state with all 3 elimination rounds completed.
   * This simulates the entire Top 16 bracket flow.
   */
  beforeEach(() => {
    const players = make20Players();
    state = makeState(players);

    // R5: Semifinals
    const eliteA = makeCompletedTable(1, [
      { playerId: "1", position: 1, vp: 12 },
      { playerId: "4", position: 2, vp: 9 },
      { playerId: "5", position: 3, vp: 6 },
      { playerId: "8", position: 4, vp: 3 },
    ]);
    const eliteB = makeCompletedTable(2, [
      { playerId: "2", position: 1, vp: 11 },
      { playerId: "3", position: 2, vp: 8 },
      { playerId: "6", position: 3, vp: 5 },
      { playerId: "7", position: 4, vp: 2 },
    ]);
    const challC = makeCompletedTable(3, [
      { playerId: "9", position: 1, vp: 10 },
      { playerId: "10", position: 2, vp: 7 },
      { playerId: "11", position: 3, vp: 4 },
      { playerId: "12", position: 4, vp: 1 },
    ]);
    const challD = makeCompletedTable(4, [
      { playerId: "13", position: 1, vp: 10 },
      { playerId: "14", position: 2, vp: 7 },
      { playerId: "15", position: 3, vp: 4 },
      { playerId: "16", position: 4, vp: 1 },
    ]);
    const semiRound = makeRound(6, "semifinal", [eliteA, eliteB, challC, challD]);

    // Apply R5 scoring
    state.rounds.push(semiRound);
    state = applyResults(state, 0);

    // R6: Redemption Round
    const redemption1 = makeCompletedTable(1, [
      { playerId: "9", position: 1, vp: 11 },
      { playerId: "4", position: 2, vp: 8 },
      { playerId: "5", position: 3, vp: 5 },
      { playerId: "8", position: 4, vp: 2 },
    ]);
    const redemption2 = makeCompletedTable(2, [
      { playerId: "3", position: 1, vp: 10 },
      { playerId: "6", position: 2, vp: 7 },
      { playerId: "7", position: 3, vp: 4 },
      { playerId: "13", position: 4, vp: 1 },
    ]);
    const redemptionRound = makeRound(7, "winners-final", [redemption1, redemption2]);

    state.rounds.push(redemptionRound);
    state = applyResults(state, 1);

    // R7: Grand Final
    const grandFinalTable = makeCompletedTable(1, [
      { playerId: "9", position: 1, vp: 14 },  // Emperor!
      { playerId: "1", position: 2, vp: 11 },
      { playerId: "2", position: 3, vp: 8 },
      { playerId: "3", position: 4, vp: 5 },
    ]);
    const grandFinalRound = makeRound(8, "grand-final", [grandFinalTable]);

    state.rounds.push(grandFinalRound);
    state = applyResults(state, 2);
  });

  it("returns all 20 players", () => {
    const standings = getFinalStandings(state);
    expect(standings).toHaveLength(20);
  });

  it("Tier 1: Grand Final players occupy positions 1-4 in GF placement order", () => {
    const standings = getFinalStandings(state);
    const top4Ids = standings.slice(0, 4).map((p) => p.id);
    // GF placement: 1st=9, 2nd=1, 3rd=2, 4th=3
    expect(top4Ids).toEqual(["9", "1", "2", "3"]);
  });

  it("Tier 1: GF placement overrides cumulative points", () => {
    const standings = getFinalStandings(state);
    // Player 9 (Seed09) started with fewer points than player 1 (Seed01)
    // but finished 1st in GF so should be #1 overall
    expect(standings[0].id).toBe("9");
    expect(standings[0].name).toBe("Seed09");
  });

  it("Tier 2: Redemption losers occupy positions 5-10", () => {
    const standings = getFinalStandings(state);
    const tier2Ids = new Set(standings.slice(4, 10).map((p) => p.id));
    // Redemption players minus the 2 winners (9 and 3):
    // Redem1 losers: 4, 5, 8
    // Redem2 losers: 6, 7, 13
    expect(tier2Ids).toEqual(new Set(["4", "5", "8", "6", "7", "13"]));
  });

  it("Tier 2: sorted by R6 placement first, then cumulative stats", () => {
    const standings = getFinalStandings(state);
    const tier2 = standings.slice(4, 10);

    // R6 positions: 4=2nd, 6=2nd, 5=3rd, 7=3rd, 8=4th, 13=4th
    // Within same R6 position, higher cumulative points comes first
    // 2nd-place finishers first (players 4 and 6)
    const first2 = tier2.slice(0, 2).map((p) => p.id);
    expect(first2).toContain("4");
    expect(first2).toContain("6");

    // Then 3rd-place (players 5 and 7)
    const next2 = tier2.slice(2, 4).map((p) => p.id);
    expect(next2).toContain("5");
    expect(next2).toContain("7");

    // Then 4th-place (players 8 and 13)
    const last2 = tier2.slice(4, 6).map((p) => p.id);
    expect(last2).toContain("8");
    expect(last2).toContain("13");
  });

  it("Tier 3: Eliminated Challenger players (2nd-4th from C/D) occupy positions 11-16", () => {
    const standings = getFinalStandings(state);
    const tier3Ids = new Set(standings.slice(10, 16).map((p) => p.id));
    // Challenger C 2nd-4th: 10, 11, 12
    // Challenger D 2nd-4th: 14, 15, 16
    expect(tier3Ids).toEqual(new Set(["10", "11", "12", "14", "15", "16"]));
  });

  it("Tier 3: sorted by cumulative standings", () => {
    const standings = getFinalStandings(state);
    const tier3 = standings.slice(10, 16);
    // These should be in descending points order
    for (let i = 0; i < tier3.length - 1; i++) {
      expect(tier3[i].points).toBeGreaterThanOrEqual(tier3[i + 1].points);
    }
  });

  it("Tier 4: Non-top-16 players occupy positions 17-20", () => {
    const standings = getFinalStandings(state);
    const tier4Ids = new Set(standings.slice(16).map((p) => p.id));
    expect(tier4Ids).toEqual(new Set(["17", "18", "19", "20"]));
  });

  it("Tier 4: sorted by cumulative standings", () => {
    const standings = getFinalStandings(state);
    const tier4 = standings.slice(16);
    for (let i = 0; i < tier4.length - 1; i++) {
      expect(tier4[i].points).toBeGreaterThanOrEqual(tier4[i + 1].points);
    }
  });

  it("no player appears twice in standings", () => {
    const standings = getFinalStandings(state);
    const ids = standings.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to cumulative standings if Grand Final not complete", () => {
    // Remove the grand final round
    state.rounds = state.rounds.filter((r) => r.type !== "grand-final");
    const standings = getFinalStandings(state);
    // Should be pure cumulative ordering — same as getStandings
    const expected = getStandings(state.players);
    expect(standings.map((p) => p.id)).toEqual(expected.map((p) => p.id));
  });

  it("falls back if grand final exists but isComplete is false", () => {
    const gfRound = state.rounds.find((r) => r.type === "grand-final")!;
    gfRound.isComplete = false;
    const standings = getFinalStandings(state);
    const expected = getStandings(state.players);
    expect(standings.map((p) => p.id)).toEqual(expected.map((p) => p.id));
  });
});

describe("end-to-end bracket flow", () => {
  it("full pipeline: semis → redemption → grand final produces correct player flow", () => {
    const state = makeState(make20Players());

    // 1. Generate semifinals
    const semiTables = generateSemifinals(state);
    expect(semiTables).toHaveLength(4);

    // Simulate R5 results
    semiTables[0].results = [
      { playerId: "1", position: 1, vp: 12 },
      { playerId: "4", position: 2, vp: 9 },
      { playerId: "5", position: 3, vp: 6 },
      { playerId: "8", position: 4, vp: 3 },
    ];
    semiTables[0].isComplete = true;

    semiTables[1].results = [
      { playerId: "2", position: 1, vp: 11 },
      { playerId: "3", position: 2, vp: 8 },
      { playerId: "6", position: 3, vp: 5 },
      { playerId: "7", position: 4, vp: 2 },
    ];
    semiTables[1].isComplete = true;

    semiTables[2].results = [
      { playerId: "9", position: 1, vp: 10 },
      { playerId: "10", position: 2, vp: 7 },
      { playerId: "11", position: 3, vp: 4 },
      { playerId: "12", position: 4, vp: 1 },
    ];
    semiTables[2].isComplete = true;

    semiTables[3].results = [
      { playerId: "13", position: 1, vp: 10 },
      { playerId: "14", position: 2, vp: 7 },
      { playerId: "15", position: 3, vp: 4 },
      { playerId: "16", position: 4, vp: 1 },
    ];
    semiTables[3].isComplete = true;

    const semiRound = makeRound(6, "semifinal", semiTables);

    // 2. Generate Redemption
    const redemptionTables = generateFinalsRound6(semiRound);
    expect(redemptionTables).toHaveLength(2);

    // Verify redemption composition
    expect(new Set(redemptionTables[0].playerIds)).toEqual(new Set(["4", "5", "8", "9"]));
    expect(new Set(redemptionTables[1].playerIds)).toEqual(new Set(["3", "6", "7", "13"]));

    // Simulate R6 results
    redemptionTables[0].results = [
      { playerId: "4", position: 1, vp: 11 },
      { playerId: "9", position: 2, vp: 8 },
      { playerId: "5", position: 3, vp: 5 },
      { playerId: "8", position: 4, vp: 2 },
    ];
    redemptionTables[0].isComplete = true;

    redemptionTables[1].results = [
      { playerId: "6", position: 1, vp: 10 },
      { playerId: "3", position: 2, vp: 7 },
      { playerId: "13", position: 3, vp: 4 },
      { playerId: "7", position: 4, vp: 1 },
    ];
    redemptionTables[1].isComplete = true;

    const redemptionRound = makeRound(7, "winners-final", redemptionTables);

    // 3. Generate Grand Final
    const grandFinalTable = generateGrandFinal(semiRound, redemptionRound);

    // Elite A winner (1) + Elite B winner (2) + Redem1 winner (4) + Redem2 winner (6)
    expect(new Set(grandFinalTable.playerIds)).toEqual(new Set(["1", "2", "4", "6"]));
  });

  it("lower seed can reach Grand Final via redemption path", () => {
    const state = makeState(make20Players());
    const semiTables = generateSemifinals(state);

    // Seed 8 (player "8") loses Elite A — goes to Redemption
    semiTables[0].results = [
      { playerId: "1", position: 1, vp: 12 },
      { playerId: "5", position: 2, vp: 9 },
      { playerId: "4", position: 3, vp: 6 },
      { playerId: "8", position: 4, vp: 3 },
    ];
    semiTables[0].isComplete = true;

    semiTables[1].results = [
      { playerId: "2", position: 1, vp: 11 },
      { playerId: "7", position: 2, vp: 8 },
      { playerId: "3", position: 3, vp: 5 },
      { playerId: "6", position: 4, vp: 2 },
    ];
    semiTables[1].isComplete = true;

    // Seed 12 (player "12") is worst Challenger seed but WINS table C
    semiTables[2].results = [
      { playerId: "12", position: 1, vp: 10 },
      { playerId: "9", position: 2, vp: 7 },
      { playerId: "10", position: 3, vp: 4 },
      { playerId: "11", position: 4, vp: 1 },
    ];
    semiTables[2].isComplete = true;

    semiTables[3].results = [
      { playerId: "16", position: 1, vp: 10 },
      { playerId: "13", position: 2, vp: 7 },
      { playerId: "14", position: 3, vp: 4 },
      { playerId: "15", position: 4, vp: 1 },
    ];
    semiTables[3].isComplete = true;

    const semiRound = makeRound(6, "semifinal", semiTables);
    const redemptionTables = generateFinalsRound6(semiRound);

    // Challenger C winner (12) goes to Redemption 1
    expect(redemptionTables[0].playerIds).toContain("12");
    // Challenger D winner (16) goes to Redemption 2
    expect(redemptionTables[1].playerIds).toContain("16");

    // Player 12 (lowest seed in Redemption 1) WINS redemption
    redemptionTables[0].results = [
      { playerId: "12", position: 1, vp: 14 },
      { playerId: "5", position: 2, vp: 8 },
      { playerId: "4", position: 3, vp: 5 },
      { playerId: "8", position: 4, vp: 2 },
    ];
    redemptionTables[0].isComplete = true;

    redemptionTables[1].results = [
      { playerId: "16", position: 1, vp: 13 },
      { playerId: "7", position: 2, vp: 7 },
      { playerId: "3", position: 3, vp: 4 },
      { playerId: "6", position: 4, vp: 1 },
    ];
    redemptionTables[1].isComplete = true;

    const redemptionRound = makeRound(7, "winners-final", redemptionTables);
    const grandFinalTable = generateGrandFinal(semiRound, redemptionRound);

    // Seeds 12 and 16 (bottom challengers) made it to Grand Final!
    expect(grandFinalTable.playerIds).toContain("12");
    expect(grandFinalTable.playerIds).toContain("16");
    expect(grandFinalTable.playerIds).toContain("1");
    expect(grandFinalTable.playerIds).toContain("2");
  });
});

// ===== LEADER TIER SELECTION TESTS =====

describe("getTierForRound", () => {
  it("cycles A/B/C for qualifying rounds 1-5", () => {
    expect(getTierForRound(1, false)).toBe("A");
    expect(getTierForRound(2, false)).toBe("B");
    expect(getTierForRound(3, false)).toBe("C");
    expect(getTierForRound(4, false)).toBe("A");
    expect(getTierForRound(5, false)).toBe("B");
  });

  it("continues cycling beyond 5 qualifying rounds", () => {
    expect(getTierForRound(6, false)).toBe("C");
    expect(getTierForRound(7, false)).toBe("A");
  });

  it("returns C for all top8 rounds regardless of round number", () => {
    expect(getTierForRound(1, true)).toBe("C");
    expect(getTierForRound(5, true)).toBe("C");
    expect(getTierForRound(7, true)).toBe("C");
  });
});

describe("selectRoundLeaders", () => {
  it("returns exactly 7 leaders", () => {
    const leaders = selectRoundLeaders("A");
    expect(leaders).toHaveLength(7);
  });

  it("returns leaders from the correct tier", () => {
    const leaders = selectRoundLeaders("B");
    for (const leader of leaders) {
      expect(leader.tier).toBe("B");
    }
  });

  it("returns unique leaders (no duplicates)", () => {
    const leaders = selectRoundLeaders("A");
    const ids = leaders.map((l) => l.id);
    expect(new Set(ids).size).toBe(7);
  });

  it("selects from the A-tier pool (9 leaders, picks 7)", () => {
    // Run multiple times to verify randomness doesn't break things
    for (let i = 0; i < 10; i++) {
      const leaders = selectRoundLeaders("A");
      expect(leaders).toHaveLength(7);
      for (const leader of leaders) {
        expect(leader.tier).toBe("A");
      }
    }
  });

  it("selects from the B-tier pool (8 leaders, picks 7)", () => {
    const leaders = selectRoundLeaders("B");
    expect(leaders).toHaveLength(7);
    for (const leader of leaders) {
      expect(leader.tier).toBe("B");
    }
  });

  it("selects ALL leaders from the C-tier pool (no random draw)", () => {
    const leaders = selectRoundLeaders("C");
    const cPool = getLeadersByTier("C");
    expect(leaders).toHaveLength(cPool.length);
    for (const leader of leaders) {
      expect(leader.tier).toBe("C");
    }
  });

  it("produces different selections across calls (randomness)", () => {
    // Run 20 times and collect all unique sets; at least 2 should differ
    const selections = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const leaders = selectRoundLeaders("A");
      const key = leaders.map((l) => l.id).sort().join(",");
      selections.add(key);
    }
    // With 9 choose 7 = 36 combinations, 20 tries should yield at least 2 different
    expect(selections.size).toBeGreaterThanOrEqual(2);
  });
});

// ===== MIGRATE LEADER NAMES =====

describe("migrateLeaderNames", () => {
  function makeMinimalState(rounds: Round[]): TournamentState {
    return {
      metadata: { version: "1.0.0", tournamentName: "Test", timestamp: "2025-01-01T00:00:00Z" },
      players: [],
      rounds,
      currentRound: rounds.length,
      phase: "qualifying",
      settings: { totalQualifyingRounds: 5, topCut: 16, dramaticReveal: false, testMode: false },
    };
  }

  it("converts old camelCase leader ids to display names", () => {
    const table: Table = {
      id: 1,
      playerIds: ["p1", "p2", "p3", "p4"],
      results: [
        { playerId: "p1", position: 1, vp: 12, leader: "paulAtreides" },
        { playerId: "p2", position: 2, vp: 10, leader: "glossuRabban" },
        { playerId: "p3", position: 3, vp: 9, leader: "letoAtreides" },
        { playerId: "p4", position: 4, vp: 8, leader: "vladimirHarkonnen" },
      ],
      isComplete: true,
    };
    const round: Round = { number: 1, tables: [table], isComplete: true, type: "qualifying" };
    const state = makeMinimalState([round]);

    migrateLeaderNames(state);

    expect(state.rounds[0].tables[0].results[0].leader).toBe("Paul Atreides");
    expect(state.rounds[0].tables[0].results[1].leader).toBe('Glossu "The Beast" Rabban');
    expect(state.rounds[0].tables[0].results[2].leader).toBe("Duke Leto Atreides");
    expect(state.rounds[0].tables[0].results[3].leader).toBe("Baron Vladimir Harkonnen");
  });

  it("leaves current display names unchanged (idempotent)", () => {
    const table: Table = {
      id: 1,
      playerIds: ["p1", "p2"],
      results: [
        { playerId: "p1", position: 1, vp: 10, leader: "Tessia Vernius" },
        { playerId: "p2", position: 2, vp: 8, leader: "Count Hasimir Fenring" },
      ],
      isComplete: true,
    };
    const round: Round = { number: 2, tables: [table], isComplete: true, type: "qualifying" };
    const state = makeMinimalState([round]);

    migrateLeaderNames(state);

    expect(state.rounds[0].tables[0].results[0].leader).toBe("Tessia Vernius");
    expect(state.rounds[0].tables[0].results[1].leader).toBe("Count Hasimir Fenring");
  });

  it("handles empty or missing leader fields gracefully", () => {
    const table: Table = {
      id: 1,
      playerIds: ["p1", "p2"],
      results: [
        { playerId: "p1", position: 1, vp: 10, leader: "" },
        { playerId: "p2", position: 2, vp: 8 } as never,
      ],
      isComplete: true,
    };
    const round: Round = { number: 1, tables: [table], isComplete: true, type: "qualifying" };
    const state = makeMinimalState([round]);

    // Should not throw
    migrateLeaderNames(state);

    expect(state.rounds[0].tables[0].results[0].leader).toBe("");
  });

  it("handles mixed old and new leader names in the same round", () => {
    const table: Table = {
      id: 1,
      playerIds: ["p1", "p2", "p3", "p4"],
      results: [
        { playerId: "p1", position: 1, vp: 12, leader: "tessiaVernius" },
        { playerId: "p2", position: 2, vp: 10, leader: "Kota Odax of Ix" },
        { playerId: "p3", position: 3, vp: 9, leader: "armandEcaz" },
        { playerId: "p4", position: 4, vp: 8, leader: "Piter De Vries (Community)" },
      ],
      isComplete: true,
    };
    const round: Round = { number: 1, tables: [table], isComplete: true, type: "qualifying" };
    const state = makeMinimalState([round]);

    migrateLeaderNames(state);

    expect(state.rounds[0].tables[0].results[0].leader).toBe("Tessia Vernius");
    expect(state.rounds[0].tables[0].results[1].leader).toBe("Kota Odax of Ix");
    expect(state.rounds[0].tables[0].results[2].leader).toBe("Archduke Armand Ecaz");
    expect(state.rounds[0].tables[0].results[3].leader).toBe("Piter De Vries (Community)");
  });

  it("does not update timestamp when no migration is needed", () => {
    const table: Table = {
      id: 1,
      playerIds: ["p1"],
      results: [{ playerId: "p1", position: 1, vp: 10, leader: "Tessia Vernius" }],
      isComplete: true,
    };
    const round: Round = { number: 1, tables: [table], isComplete: true, type: "qualifying" };
    const state = makeMinimalState([round]);
    const originalTimestamp = state.metadata.timestamp;

    migrateLeaderNames(state);

    expect(state.metadata.timestamp).toBe(originalTimestamp);
  });
});

// ===== SWISS PAIRING — NO-REMATCH TESTS =====

describe("generateSwissPairing", () => {
  function makeQualifyingState(playerCount: number): TournamentState {
    const players: Player[] = [];
    for (let i = 0; i < playerCount; i++) {
      players.push(makePlayer(String(i + 1), `Player${i + 1}`, 0, 0, 0));
    }
    return {
      metadata: { version: "1.0.0", timestamp: "", tournamentName: "Test" },
      players,
      rounds: [],
      phase: "qualifying",
      currentRound: 0,
      settings: { totalQualifyingRounds: 5, topCut: 16, dramaticReveal: false, testMode: false },
    };
  }

  /**
   * Simulate a full round: generate pairing, fill in fake results, apply scoring.
   * Each table gets positions 1-4 assigned in playerIds order.
   */
  function simulateRound(state: TournamentState): TournamentState {
    const tables = generateSwissPairing(state);
    const roundNumber = state.rounds.length + 1;
    const round: Round = {
      number: roundNumber,
      tables: tables.map((t) => ({
        ...t,
        results: t.playerIds.map((pid, idx) => ({
          playerId: pid,
          position: idx + 1,
          vp: 10 - idx * 2,
        })),
        isComplete: true,
      })),
      isComplete: true,
      type: "qualifying",
    };
    const newState: TournamentState = {
      ...state,
      rounds: [...state.rounds, round],
      currentRound: roundNumber,
    };
    return applyResults(newState, newState.rounds.length - 1);
  }

  it("produces all tables of exactly 4 players (20 players)", () => {
    const state = makeQualifyingState(20);
    const tables = generateSwissPairing(state);
    expect(tables).toHaveLength(5);
    for (const table of tables) {
      expect(table.playerIds).toHaveLength(4);
    }
  });

  it("produces all tables of exactly 4 players (16 players)", () => {
    const state = makeQualifyingState(16);
    const tables = generateSwissPairing(state);
    expect(tables).toHaveLength(4);
    for (const table of tables) {
      expect(table.playerIds).toHaveLength(4);
    }
  });

  it("all players are assigned exactly once", () => {
    const state = makeQualifyingState(20);
    const tables = generateSwissPairing(state);
    const allIds = tables.flatMap((t) => t.playerIds);
    expect(allIds).toHaveLength(20);
    expect(new Set(allIds).size).toBe(20);
  });

  it("no rematches over 5 rounds with 20 players", () => {
    let state = makeQualifyingState(20);
    for (let r = 0; r < 5; r++) {
      state = simulateRound(state);
    }
    // Check no player has duplicate opponents
    for (const player of state.players) {
      const uniqueOpponents = new Set(player.opponents);
      expect(uniqueOpponents.size).toBe(player.opponents.length);
    }
  });

  it("no rematches over 5 rounds with 16 players", () => {
    let state = makeQualifyingState(16);
    for (let r = 0; r < 5; r++) {
      state = simulateRound(state);
    }
    for (const player of state.players) {
      const uniqueOpponents = new Set(player.opponents);
      expect(uniqueOpponents.size).toBe(player.opponents.length);
    }
  });

  it("no rematches over 5 rounds with 24 players", () => {
    let state = makeQualifyingState(24);
    for (let r = 0; r < 5; r++) {
      state = simulateRound(state);
    }
    for (const player of state.players) {
      const uniqueOpponents = new Set(player.opponents);
      expect(uniqueOpponents.size).toBe(player.opponents.length);
    }
  });

  it("handles 8 players gracefully (rematches inevitable after round 3)", () => {
    let state = makeQualifyingState(8);
    // Should not throw for 5 rounds even though rematches are forced
    for (let r = 0; r < 5; r++) {
      state = simulateRound(state);
    }
    // All players should have been assigned each round
    expect(state.rounds).toHaveLength(5);
    for (const round of state.rounds) {
      const allIds = round.tables.flatMap((t) => t.playerIds);
      expect(allIds).toHaveLength(8);
      expect(new Set(allIds).size).toBe(8);
    }
  });

  it("tables start with empty results and not complete", () => {
    const state = makeQualifyingState(20);
    const tables = generateSwissPairing(state);
    for (const table of tables) {
      expect(table.results).toEqual([]);
      expect(table.isComplete).toBe(false);
    }
  });

  it("table ids are sequential starting from 1", () => {
    const state = makeQualifyingState(20);
    const tables = generateSwissPairing(state);
    tables.forEach((t, i) => {
      expect(t.id).toBe(i + 1);
    });
  });
});

// ===== REVERT TABLE RESULTS — OPPONENT CLEANUP =====

describe("revertTableResults", () => {
  it("reverts points, VP, and efficiency for a scored table", () => {
    const players = [
      makePlayer("1", "A", 0, 0, 0),
      makePlayer("2", "B", 0, 0, 0),
      makePlayer("3", "C", 0, 0, 0),
      makePlayer("4", "D", 0, 0, 0),
    ];
    let state: TournamentState = {
      metadata: { version: "1.0.0", timestamp: "", tournamentName: "Test" },
      players,
      rounds: [{
        number: 1,
        tables: [makeCompletedTable(1, [
          { playerId: "1", position: 1, vp: 12 },
          { playerId: "2", position: 2, vp: 9 },
          { playerId: "3", position: 3, vp: 6 },
          { playerId: "4", position: 4, vp: 3 },
        ])],
        isComplete: true,
        type: "qualifying",
      }],
      phase: "qualifying",
      currentRound: 1,
      settings: { totalQualifyingRounds: 5, topCut: 16, dramaticReveal: false, testMode: false },
    };

    // Apply scoring
    state = applyResults(state, 0);
    expect(state.players.find((p) => p.id === "1")!.points).toBe(5);
    expect(state.players.find((p) => p.id === "1")!.totalVP).toBe(12);

    // Revert scoring
    state = revertTableResults(state, 0, 1);
    expect(state.players.find((p) => p.id === "1")!.points).toBe(0);
    expect(state.players.find((p) => p.id === "1")!.totalVP).toBe(0);
    expect(state.players.find((p) => p.id === "1")!.efficiency).toBe(0);
  });

  it("removes opponents added by the reverted table", () => {
    const players = [
      makePlayer("1", "A", 0, 0, 0),
      makePlayer("2", "B", 0, 0, 0),
      makePlayer("3", "C", 0, 0, 0),
      makePlayer("4", "D", 0, 0, 0),
    ];
    let state: TournamentState = {
      metadata: { version: "1.0.0", timestamp: "", tournamentName: "Test" },
      players,
      rounds: [{
        number: 1,
        tables: [makeCompletedTable(1, [
          { playerId: "1", position: 1, vp: 12 },
          { playerId: "2", position: 2, vp: 9 },
          { playerId: "3", position: 3, vp: 6 },
          { playerId: "4", position: 4, vp: 3 },
        ])],
        isComplete: true,
        type: "qualifying",
      }],
      phase: "qualifying",
      currentRound: 1,
      settings: { totalQualifyingRounds: 5, topCut: 16, dramaticReveal: false, testMode: false },
    };

    // Apply scoring — opponents should be tracked
    state = applyResults(state, 0);
    const p1 = state.players.find((p) => p.id === "1")!;
    expect(p1.opponents).toContain("2");
    expect(p1.opponents).toContain("3");
    expect(p1.opponents).toContain("4");

    // Revert — opponents from this table should be removed
    state = revertTableResults(state, 0, 1);
    const p1After = state.players.find((p) => p.id === "1")!;
    expect(p1After.opponents).toHaveLength(0);
  });

  it("does not affect opponents from other tables", () => {
    const players = [
      makePlayer("1", "A", 0, 0, 0),
      makePlayer("2", "B", 0, 0, 0),
      makePlayer("3", "C", 0, 0, 0),
      makePlayer("4", "D", 0, 0, 0),
      makePlayer("5", "E", 0, 0, 0),
      makePlayer("6", "F", 0, 0, 0),
      makePlayer("7", "G", 0, 0, 0),
      makePlayer("8", "H", 0, 0, 0),
    ];
    let state: TournamentState = {
      metadata: { version: "1.0.0", timestamp: "", tournamentName: "Test" },
      players,
      rounds: [{
        number: 1,
        tables: [
          makeCompletedTable(1, [
            { playerId: "1", position: 1, vp: 12 },
            { playerId: "2", position: 2, vp: 9 },
            { playerId: "3", position: 3, vp: 6 },
            { playerId: "4", position: 4, vp: 3 },
          ]),
          makeCompletedTable(2, [
            { playerId: "5", position: 1, vp: 12 },
            { playerId: "6", position: 2, vp: 9 },
            { playerId: "7", position: 3, vp: 6 },
            { playerId: "8", position: 4, vp: 3 },
          ]),
        ],
        isComplete: true,
        type: "qualifying",
      }],
      phase: "qualifying",
      currentRound: 1,
      settings: { totalQualifyingRounds: 5, topCut: 16, dramaticReveal: false, testMode: false },
    };

    // Apply scoring for all tables
    state = applyResults(state, 0);

    // Revert only table 1 — table 2 players should keep their opponents
    state = revertTableResults(state, 0, 1);
    const p5 = state.players.find((p) => p.id === "5")!;
    expect(p5.opponents).toContain("6");
    expect(p5.opponents).toContain("7");
    expect(p5.opponents).toContain("8");
  });
});
