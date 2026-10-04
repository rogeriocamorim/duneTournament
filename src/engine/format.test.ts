import { describe, it, expect } from "vitest";
import type { ClockConfig, TableResult, TournamentState } from "./types";
import { LEADER_LIST } from "./types";
import {
  DEFAULT_CLOCK,
  FORMAT_TEMPLATES,
  TIER_PRESETS,
  computeClockPenalty,
  getCustomFinalStandings,
  getStageEntrants,
  getStageStandings,
  getTierLeaderNames,
  projectStages,
  resolveTierRule,
  selectLeadersForRule,
  tiersFromPreset,
  validateFormat,
  validateManualTables,
} from "./format";
import { createInitialState, normalizeLoadedState, tournamentReducer } from "./reducer";
import type { TournamentAction } from "./reducer";

// ===== HELPERS =====

function run(state: TournamentState, ...actions: TournamentAction[]): TournamentState {
  return actions.reduce((s, a) => tournamentReducer(s, a), state);
}

function names(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Player ${String(i + 1).padStart(2, "0")}`);
}

/** Results where table order = finishing order (first seat wins) */
function orderedResults(playerIds: string[], minutes?: number[]): TableResult[] {
  return playerIds.map((playerId, i) => ({
    playerId,
    position: i + 1,
    vp: 12 - i,
    minutesUsed: minutes?.[i],
  }));
}

/** Submit every open table of the latest round, first seat wins */
function completeLatestRound(state: TournamentState): TournamentState {
  const roundIndex = state.rounds.length - 1;
  const round = state.rounds[roundIndex];
  return tournamentReducer(state, {
    type: "BATCH_SUBMIT_TABLE_RESULTS",
    roundIndex,
    tables: round.tables.filter((t) => !t.isComplete).map((t) => ({ tableId: t.id, results: orderedResults(t.playerIds) })),
  });
}

function customTournament(templateId: string, playerCount: number): TournamentState {
  return run(
    createInitialState(),
    { type: "CREATE_FROM_TEMPLATE", templateId },
    { type: "ADD_PLAYERS", names: names(playerCount) },
  );
}

const CLOCK: ClockConfig = { ...DEFAULT_CLOCK, enabled: true, budgetMinutes: 30, penaltyPerMinute: 1 };

// ===== CLOCK =====

describe("computeClockPenalty", () => {
  it("is zero without a clock, without minutes, or within budget", () => {
    expect(computeClockPenalty(45, null)).toBe(0);
    expect(computeClockPenalty(undefined, CLOCK)).toBe(0);
    expect(computeClockPenalty(30, CLOCK)).toBe(0);
    expect(computeClockPenalty(12, CLOCK)).toBe(0);
  });

  it("counts a started minute as a full minute", () => {
    expect(computeClockPenalty(30.1, CLOCK)).toBe(1);
    expect(computeClockPenalty(32.5, CLOCK)).toBe(3);
  });

  it("ignores partial minutes with full-minute rounding", () => {
    const clock = { ...CLOCK, rounding: "full-minute" as const };
    expect(computeClockPenalty(30.9, clock)).toBe(0);
    expect(computeClockPenalty(32.5, clock)).toBe(2);
  });

  it("multiplies by the penalty per minute and respects the cap", () => {
    expect(computeClockPenalty(33, { ...CLOCK, penaltyPerMinute: 2 })).toBe(6);
    expect(computeClockPenalty(40, { ...CLOCK, penaltyCap: 4 })).toBe(4);
  });
});

// ===== TIERS =====

describe("tier presets", () => {
  it("only reference leaders that exist", () => {
    const ids = new Set(LEADER_LIST.map((l) => l.id));
    for (const preset of TIER_PRESETS) {
      for (const tier of preset.tiers) {
        for (const id of tier.leaderIds) expect(ids.has(id), `${preset.id}/${tier.code}/${id}`).toBe(true);
      }
    }
  });

  it("Bloodlines S–E matches the TTS mod tiers", () => {
    const tiers = tiersFromPreset("bloodlines-s-e");
    expect(tiers.map((t) => t.code)).toEqual(["S", "A", "B", "C", "D", "E"]);
    expect(tiers.map((t) => t.leaderIds.length)).toEqual([5, 4, 5, 5, 6, 3]);
  });

  it("returns a copy so tournaments can edit their tiers", () => {
    const a = tiersFromPreset("bloodlines-s-e");
    a[0].leaderIds.pop();
    expect(tiersFromPreset("bloodlines-s-e")[0].leaderIds).toHaveLength(5);
  });
});

describe("selectLeadersForRule", () => {
  const tiers = tiersFromPreset("bloodlines-s-e");

  it("combines several tiers", () => {
    const pool = selectLeadersForRule(tiers, { tierCodes: ["S", "A"], selection: "all" });
    expect(pool.label).toBe("S+A");
    expect(pool.leaders.sort()).toEqual(getTierLeaderNames(tiers, ["S", "A"]).sort());
    expect(pool.leaders).toHaveLength(9);
  });

  it("draws N leaders without duplicates", () => {
    for (let i = 0; i < 20; i++) {
      const pool = selectLeadersForRule(tiers, { tierCodes: ["C", "D"], selection: "random-n", poolSize: 5 });
      expect(pool.leaders).toHaveLength(5);
      expect(new Set(pool.leaders).size).toBe(5);
      const allowed = new Set(getTierLeaderNames(tiers, ["C", "D"]));
      for (const name of pool.leaders) expect(allowed.has(name)).toBe(true);
    }
  });

  it("picks one tier at random with randomOneOf", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const pool = selectLeadersForRule(tiers, { tierCodes: ["A", "B"], selection: "all", randomOneOf: true });
      expect(pool.tierCodes).toHaveLength(1);
      seen.add(pool.label);
    }
    expect(seen).toEqual(new Set(["A", "B"]));
  });

  it("ignores tier codes that do not exist", () => {
    const pool = selectLeadersForRule(tiers, { tierCodes: ["Z", "E"], selection: "all" });
    expect(pool.label).toBe("E");
  });
});

describe("resolveTierRule", () => {
  const stage = FORMAT_TEMPLATES.find((t) => t.id === "classic")!.format.stages[1];

  it("prefers the rule of the exact round", () => {
    expect(resolveTierRule(stage, 3)?.randomOneOf).toBe(true);
    expect(resolveTierRule(stage, 1)?.tierCodes).toEqual(["C"]);
  });

  it("falls back to the stage default rule", () => {
    const custom = { ...stage, tierRules: [{ tierCodes: ["S"], selection: "all" as const }] };
    expect(resolveTierRule(custom, 2)?.tierCodes).toEqual(["S"]);
  });
});

// ===== FORMAT VALIDATION =====

describe("projectStages / validateFormat", () => {
  const swissTop8 = FORMAT_TEMPLATES.find((t) => t.id === "swiss-top8")!.format;

  it("projects players and tables per stage", () => {
    const p = projectStages(swissTop8, 20);
    expect(p.map((s) => [s.players, s.tables])).toEqual([[20, 5], [8, 2], [4, 1]]);
    expect(p.every((s) => s.errors.length === 0)).toBe(true);
  });

  it("rejects player counts that cannot fill tables of 4", () => {
    expect(validateFormat(swissTop8, 18, "custom").some((e) => e.includes("tables of 4"))).toBe(true);
  });

  it("rejects a cut larger than the field", () => {
    expect(validateFormat(swissTop8, 4, "custom").some((e) => e.includes("Top 8"))).toBe(true);
  });
});

describe("validateManualTables", () => {
  const entrants = ["1", "2", "3", "4", "5", "6", "7", "8"];

  it("accepts every player seated once", () => {
    expect(validateManualTables([["1", "2", "3", "4"], ["5", "6", "7", "8"]], entrants)).toBeNull();
  });

  it("rejects incomplete tables, duplicates and missing players", () => {
    expect(validateManualTables([["1", "2", "3"], ["5", "6", "7", "8"]], entrants)).not.toBeNull();
    expect(validateManualTables([["1", "2", "3", "4"], ["4", "6", "7", "8"]], entrants)).not.toBeNull();
    expect(validateManualTables([["1", "2", "3", "4"]], entrants)).not.toBeNull();
  });
});

// ===== CUSTOM TOURNAMENT FLOW =====

describe("custom format: Swiss + Top 8", () => {
  it("plays every stage with tables of 4, configured tiers and advancement", () => {
    let state = customTournament("swiss-top8", 16);
    expect(state.mode).toBe("custom");
    expect(state.tiers?.map((t) => t.code)).toEqual(["S", "A", "B", "C", "D", "E"]);

    state = run(state, { type: "START_TOURNAMENT" });
    expect(state.phase).toBe("qualifying");
    expect(getStageEntrants(state, 0)).toHaveLength(16);

    // Qualifying: 4 rounds with TTS tier pairs
    const expectedPairs = ["S+A", "A+B", "B+C", "C+D"];
    for (let r = 0; r < 4; r++) {
      state = run(state, { type: "GENERATE_ROUND" });
      const round = state.rounds[state.rounds.length - 1];
      expect(round.stageIndex).toBe(0);
      expect(round.roundInStage).toBe(r + 1);
      expect(round.tables).toHaveLength(4);
      for (const t of round.tables) expect(t.playerIds).toHaveLength(4);
      expect(round.leaderTier).toBe(expectedPairs[r]);
      expect(round.availableLeaders).toHaveLength(5);
      const allowed = new Set(getTierLeaderNames(state.tiers!, round.tierCodes!));
      for (const name of round.availableLeaders!) expect(allowed.has(name)).toBe(true);
      state = completeLatestRound(state);
    }

    // Stage complete: no fifth qualifying round
    expect(run(state, { type: "GENERATE_ROUND" }).rounds).toHaveLength(4);

    // Semifinal: top 8 by standings, seeded snake
    const top8 = getStageStandings(state, 0).slice(0, 8).map((p) => p.id);
    state = run(state, { type: "ADVANCE_STAGE" });
    expect(state.currentStage).toBe(1);
    expect(getStageEntrants(state, 1)).toEqual(top8);

    state = run(state, { type: "GENERATE_ROUND" });
    const semi = state.rounds[state.rounds.length - 1];
    expect(semi.type).toBe("stage");
    expect(semi.tables.map((t) => t.playerIds)).toEqual([
      [top8[0], top8[3], top8[4], top8[7]],
      [top8[1], top8[2], top8[5], top8[6]],
    ]);
    expect(semi.tierCodes).toEqual(["S", "A"]);
    state = completeLatestRound(state);

    // Final: best 2 of each semifinal table
    state = run(state, { type: "ADVANCE_STAGE" });
    const finalists = getStageEntrants(state, 2);
    expect(finalists).toHaveLength(4);
    expect(new Set(finalists)).toEqual(new Set([
      semi.tables[0].playerIds[0], semi.tables[0].playerIds[1],
      semi.tables[1].playerIds[0], semi.tables[1].playerIds[1],
    ]));

    state = run(state, { type: "GENERATE_ROUND" });
    const final = state.rounds[state.rounds.length - 1];
    expect(final.tables).toHaveLength(1);
    state = completeLatestRound(state);

    state = run(state, { type: "ADVANCE_STAGE" });
    expect(state.phase).toBe("finished");

    // Final standings: final table order first, then semifinal losers, then the rest
    const standings = getCustomFinalStandings(state);
    expect(standings).toHaveLength(16);
    expect(standings.slice(0, 4).map((p) => p.id)).toEqual(final.tables[0].playerIds);
    const semifinalists = new Set(top8);
    expect(standings.slice(4, 8).every((p) => semifinalists.has(p.id))).toBe(true);
  });

  it("refuses to start when the field does not fit the format", () => {
    const state = run(customTournament("swiss-top8", 6), { type: "START_TOURNAMENT" });
    expect(state.phase).toBe("registration");
  });

  it("needs organizer tables for manual pairing", () => {
    let state = customTournament("swiss-top4", 8);
    const format = structuredClone(state.format!);
    format.stages[0].pairing = "manual";
    state = run(state, { type: "UPDATE_FORMAT", format, tiers: state.tiers! }, { type: "START_TOURNAMENT" });

    expect(run(state, { type: "GENERATE_ROUND" }).rounds).toHaveLength(0);
    const ids = state.players.map((p) => p.id);
    expect(run(state, { type: "GENERATE_ROUND", tables: [ids.slice(0, 3), ids.slice(3, 8)] }).rounds).toHaveLength(0);

    const tables = [[ids[0], ids[7], ids[2], ids[5]], [ids[1], ids[3], ids[4], ids[6]]];
    const next = run(state, { type: "GENERATE_ROUND", tables });
    expect(next.rounds[0].tables.map((t) => t.playerIds)).toEqual(tables);
  });

  it("supports fixed groups of 8 in a custom stage", () => {
    let state = customTournament("swiss-top4", 16);
    const format = structuredClone(state.format!);
    format.stages[0].pairing = "groups-fixed";
    state = run(state, { type: "UPDATE_FORMAT", format, tiers: state.tiers! }, { type: "START_TOURNAMENT" });
    expect(new Set(state.players.map((p) => p.groupId))).toEqual(new Set([0, 1]));

    state = run(state, { type: "GENERATE_ROUND" });
    const round = state.rounds[0];
    expect(round.tables).toHaveLength(4);
    for (const table of round.tables) {
      const groups = new Set(table.playerIds.map((id) => state.players.find((p) => p.id === id)!.groupId));
      expect(groups.size).toBe(1);
    }
  });
});

// ===== SCORING =====

describe("custom placement points and clock penalties", () => {
  function startedWith(points: number[], clock: ClockConfig | null): TournamentState {
    const state = customTournament("swiss-top4", 4);
    const format = structuredClone(state.format!);
    format.placementPoints = points;
    if (clock) format.clock = clock;
    return run(state, { type: "UPDATE_FORMAT", format, tiers: state.tiers! }, { type: "START_TOURNAMENT" }, { type: "GENERATE_ROUND" });
  }

  it("uses the tournament's placement points", () => {
    let state = startedWith([5, 3, 1, 0], null);
    const table = state.rounds[0].tables[0];
    state = run(state, { type: "SUBMIT_TABLE_RESULTS", roundIndex: 0, tableId: table.id, results: orderedResults(table.playerIds) });
    const points = table.playerIds.map((id) => state.players.find((p) => p.id === id)!.points);
    expect(points).toEqual([5, 3, 1, 0]);
  });

  it("subtracts clock penalties and allows negative totals", () => {
    let state = startedWith([6, 3, 2, 1], CLOCK);
    const table = state.rounds[0].tables[0];
    state = run(state, {
      type: "SUBMIT_TABLE_RESULTS",
      roundIndex: 0,
      tableId: table.id,
      results: orderedResults(table.playerIds, [29, 32.5, 30, 34]),
    });
    const results = state.rounds[0].tables[0].results;
    expect(results.map((r) => r.penaltyPoints)).toEqual([0, 3, 0, 4]);
    const points = table.playerIds.map((id) => state.players.find((p) => p.id === id)!.points);
    expect(points).toEqual([6, 0, 2, -3]);
  });

  it("re-applies penalties correctly when results are edited", () => {
    let state = startedWith([6, 3, 2, 1], CLOCK);
    const table = state.rounds[0].tables[0];
    state = run(state, { type: "SUBMIT_TABLE_RESULTS", roundIndex: 0, tableId: table.id, results: orderedResults(table.playerIds, [40, 30, 30, 30]) });
    expect(state.players.find((p) => p.id === table.playerIds[0])!.points).toBe(-4);

    state = run(state, { type: "SUBMIT_TABLE_RESULTS", roundIndex: 0, tableId: table.id, results: orderedResults(table.playerIds, [31, 30, 30, 30]) });
    expect(state.players.find((p) => p.id === table.playerIds[0])!.points).toBe(5);
    expect(state.players.find((p) => p.id === table.playerIds[3])!.points).toBe(1);
  });

  it("ignores minutes when the clock is off for the stage", () => {
    let state = startedWith([6, 3, 2, 1], CLOCK);
    const format = structuredClone(state.format!);
    format.stages[0].clockEnabled = false;
    state = run(state, { type: "UPDATE_FORMAT", format, tiers: state.tiers! });
    const table = state.rounds[0].tables[0];
    state = run(state, { type: "SUBMIT_TABLE_RESULTS", roundIndex: 0, tableId: table.id, results: orderedResults(table.playerIds, [50, 50, 50, 50]) });
    expect(state.rounds[0].tables[0].results.every((r) => r.penaltyPoints === 0)).toBe(true);
  });

  it("updates the points of rounds that have no results yet", () => {
    let state = startedWith([6, 3, 2, 1], null);
    const format = structuredClone(state.format!);
    format.placementPoints = [10, 5, 2, 0];
    state = run(state, { type: "UPDATE_FORMAT", format, tiers: state.tiers! });
    expect(state.rounds[0].placementPoints).toEqual([10, 5, 2, 0]);
  });
});

// ===== CLASSIC / COLOSSEUM COMPATIBILITY =====

describe("classic and colosseum templates", () => {
  it("classic qualifying rounds cycle A, B, C with the original pool sizes", () => {
    let state = run(createInitialState(), { type: "SELECT_MODE", mode: "classic" }, { type: "ADD_PLAYERS", names: names(8) }, { type: "START_TOURNAMENT" });
    const labels: string[] = [];
    const sizes: number[] = [];
    for (let r = 0; r < 3; r++) {
      state = completeLatestRound(run(state, { type: "GENERATE_ROUND" }));
      const round = state.rounds[state.rounds.length - 1];
      labels.push(round.leaderTier!);
      sizes.push(round.availableLeaders!.length);
      expect(round.placementPoints).toEqual([6, 3, 2, 1]);
    }
    expect(labels).toEqual(["A", "B", "C"]);
    const cTier = LEADER_LIST.filter((l) => l.tier === "C").length;
    expect(sizes).toEqual([7, 7, cTier]);
  });

  it("classic rounds follow edited tiers", () => {
    let state = run(createInitialState(), { type: "SELECT_MODE", mode: "classic" }, { type: "ADD_PLAYERS", names: names(4) });
    const tiers = tiersFromPreset("bloodlines-s-e");
    const format = structuredClone(state.format!);
    format.stages[0].tierRules = [{ tierCodes: ["S"], selection: "all" }];
    state = run(state, { type: "UPDATE_FORMAT", format, tiers }, { type: "START_TOURNAMENT" }, { type: "GENERATE_ROUND" });
    expect(state.rounds[0].leaderTier).toBe("S");
    expect(state.rounds[0].availableLeaders).toHaveLength(5);
  });

  it("colosseum group rounds carry the tier but no drawn pool", () => {
    let state = run(createInitialState(), { type: "SELECT_MODE", mode: "colosseum" }, { type: "ADD_PLAYERS", names: names(16) }, { type: "START_TOURNAMENT" });
    state = run(state, { type: "PROCEED_TO_QUALIFYING" });
    expect(state.rounds).toHaveLength(4);
    expect(state.rounds.map((r) => r.leaderTier)).toEqual(["A", "B", "C", "A"]);
    expect(state.rounds.every((r) => r.availableLeaders === undefined)).toBe(true);
  });

  it("colosseum batch submits do not double count tables scored earlier", () => {
    let state = run(createInitialState(), { type: "SELECT_MODE", mode: "colosseum" }, { type: "ADD_PLAYERS", names: names(16) }, { type: "START_TOURNAMENT" }, { type: "PROCEED_TO_QUALIFYING" });
    const first = state.rounds[0].tables[0];
    state = run(state, { type: "SUBMIT_TABLE_RESULTS", roundIndex: 0, tableId: first.id, results: orderedResults(first.playerIds) });
    state = run(state, {
      type: "BATCH_SUBMIT_TABLE_RESULTS",
      roundIndex: 0,
      tables: state.rounds[0].tables.map((t) => ({ tableId: t.id, results: orderedResults(t.playerIds) })),
    });
    const total = state.players.reduce((sum, p) => sum + p.points, 0);
    expect(total).toBe(4 * (6 + 3 + 2 + 1));
  });

  it("old saves get a format and the Classic A/B/C tiers", () => {
    const legacy = { ...createInitialState(), phase: "qualifying" } as TournamentState;
    delete legacy.format;
    delete legacy.tiers;
    const loaded = normalizeLoadedState(legacy);
    expect(loaded.format?.templateId).toBe("classic");
    expect(loaded.tiers?.map((t) => t.code)).toEqual(["A", "B", "C"]);
  });
});
