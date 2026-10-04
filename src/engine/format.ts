import type {
  ClockConfig,
  Player,
  Round,
  StageConfig,
  TierDef,
  TierRule,
  TournamentFormat,
  TournamentMode,
  TournamentState,
} from "./types";
import { LEADER_ID_ALIASES, LEADER_LIST, getLeaderById } from "./types";
import { createGolfPods, generateColosseumPairing, snakeDraftOrder } from "./tournament";

// ===== DEFAULTS =====

export const DEFAULT_PLACEMENT_POINTS: number[] = [6, 3, 2, 1];

export const DEFAULT_CLOCK: ClockConfig = {
  enabled: false,
  budgetMinutes: 60,
  penaltyPerMinute: 1,
  penaltyCap: null,
  rounding: "started-minute",
};

/** Every table seats exactly this many players */
export const TABLE_SIZE = 4;

// ===== TIER PRESETS =====

export interface TierPreset {
  id: string;
  name: string;
  description: string;
  tiers: TierDef[];
}

export const TIER_COLORS: Record<string, string> = {
  S: "#a855f7",
  A: "#ef4444",
  B: "#c5a059",
  C: "#38bdf8",
  D: "#22c55e",
  E: "#94a3b8",
};

const FALLBACK_TIER_COLOR = "#c5a059";

function classicTier(code: string, label: string): TierDef {
  return {
    code,
    label,
    color: TIER_COLORS[code] ?? FALLBACK_TIER_COLOR,
    leaderIds: LEADER_LIST.filter((l) => l.tier === code).map((l) => l.id),
  };
}

export const TIER_PRESETS: TierPreset[] = [
  {
    id: "bloodlines-s-e",
    name: "Bloodlines S–E (TTS)",
    description: "The six community tiers used by the Bloodlines TTS mod.",
    tiers: [
      { code: "S", label: "S Tier", color: TIER_COLORS.S, leaderIds: ["stabanTuek", "bl_Piter_com", "bl_Kota", "bl_Hasimir", "liet_com"] },
      { code: "A", label: "A Tier", color: TIER_COLORS.A, leaderIds: ["ilesaEcaz_com", "tessiaVernius", "bl_Esmar", "rhomburVernius_com"] },
      { code: "B", label: "B Tier", color: TIER_COLORS.B, leaderIds: ["bl_Yrkoon", "bl_Chani", "gurneyHalleck", "amberMetulli", "margotFenring"] },
      { code: "C", label: "C Tier", color: TIER_COLORS.C, leaderIds: ["feydRauthaHarkonnen", "irulanCorrino", "muadDib", "bl_Duncan", "ilbanRichese"] },
      { code: "D", label: "D Tier", color: TIER_COLORS.D, leaderIds: ["armandEcaz", "bl_Mohiam", "vladimirHarkonnen", "letoAtreides", "arianaThorvald_com", "paulAtreides_com"] },
      { code: "E", label: "E Tier", color: TIER_COLORS.E, leaderIds: ["shaddamCorrino", "yunaMoritani", "jessica"] },
    ],
  },
  {
    id: "classic-abc",
    name: "Classic A/B/C",
    description: "The original three tournament tiers.",
    tiers: [classicTier("A", "A Tier"), classicTier("B", "B Tier"), classicTier("C", "C Tier")],
  },
];

/** Deep copy of a preset's tiers (unknown preset → Classic A/B/C) */
export function tiersFromPreset(presetId: string): TierDef[] {
  const preset = TIER_PRESETS.find((p) => p.id === presetId) ?? TIER_PRESETS[1];
  return structuredClone(preset.tiers);
}

// ===== FORMAT TEMPLATES =====

export interface FormatTemplate {
  id: string;
  name: string;
  description: string;
  mode: TournamentMode;
  /** Tier preset used when a tournament is created from this template */
  tierPresetId: string;
  format: TournamentFormat;
}

function cycleRules(codes: string[], rounds: number, selection: TierRule["selection"], poolSize?: number): TierRule[] {
  return Array.from({ length: rounds }, (_, i) => ({
    roundInStage: i + 1,
    tierCodes: [codes[i % codes.length]],
    selection,
    poolSize,
  }));
}

/** Classic qualifying rule set: A, B, C cycle; C shows the whole tier, A/B draw 7 */
function classicQualifyingRules(rounds: number): TierRule[] {
  return cycleRules(["A", "B", "C"], rounds, "random-n", 7).map((r) =>
    r.tierCodes[0] === "C" ? { ...r, selection: "all" as const, poolSize: undefined } : r
  );
}

export const FORMAT_TEMPLATES: FormatTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Swiss qualifying rounds, then the Top 16 double-chance bracket.",
    mode: "classic",
    tierPresetId: "classic-abc",
    format: {
      templateId: "classic",
      placementPoints: [...DEFAULT_PLACEMENT_POINTS],
      clock: { ...DEFAULT_CLOCK },
      stages: [
        {
          id: "qualifying",
          name: "Qualifying",
          kind: "rounds",
          rounds: 5,
          advancement: { kind: "all" },
          pairing: "swiss-golf",
          carryPoints: true,
          tierRules: classicQualifyingRules(5),
        },
        {
          id: "bracket",
          name: "Top 16 Bracket",
          kind: "classic-bracket",
          rounds: 3,
          advancement: { kind: "top-n", n: 16 },
          pairing: "seeded-snake",
          carryPoints: true,
          tierRules: [
            { roundInStage: 1, tierCodes: ["C"], selection: "all" },
            { roundInStage: 2, tierCodes: ["C"], selection: "all" },
            { roundInStage: 3, tierCodes: ["A", "B", "C"], selection: "random-n", poolSize: 7, randomOneOf: true },
          ],
        },
      ],
    },
  },
  {
    id: "colosseum",
    name: "Colosseum",
    description: "Groups of 8 with a fixed 4-round schedule, then the knockout bracket.",
    mode: "colosseum",
    tierPresetId: "classic-abc",
    format: {
      templateId: "colosseum",
      placementPoints: [...DEFAULT_PLACEMENT_POINTS],
      clock: { ...DEFAULT_CLOCK },
      stages: [
        {
          id: "groups",
          name: "Group Stage",
          kind: "rounds",
          rounds: 4,
          advancement: { kind: "all" },
          pairing: "groups-fixed",
          carryPoints: true,
          tierRules: cycleRules(["A", "B", "C"], 4, "all"),
        },
        {
          id: "knockout",
          name: "Knockout",
          kind: "colosseum-bracket",
          rounds: 3,
          advancement: { kind: "top-n", n: 16 },
          pairing: "manual",
          carryPoints: true,
          tierRules: [
            { roundInStage: 1, tierCodes: ["A"], selection: "all" },
            { roundInStage: 2, tierCodes: ["B"], selection: "all" },
            { roundInStage: 3, tierCodes: ["C"], selection: "all" },
          ],
        },
      ],
    },
  },
  {
    id: "swiss-top8",
    name: "Swiss + Top 8",
    description: "4 Swiss rounds with TTS tier pairs, Top 8 semifinal, then the 2 best of each semifinal table play the final.",
    mode: "custom",
    tierPresetId: "bloodlines-s-e",
    format: {
      templateId: "swiss-top8",
      placementPoints: [...DEFAULT_PLACEMENT_POINTS],
      clock: { ...DEFAULT_CLOCK },
      stages: [
        {
          id: "qualifying",
          name: "Qualifying",
          kind: "rounds",
          rounds: 4,
          advancement: { kind: "all" },
          pairing: "swiss-golf",
          carryPoints: true,
          tierRules: [
            { roundInStage: 1, tierCodes: ["S", "A"], selection: "random-n", poolSize: 5 },
            { roundInStage: 2, tierCodes: ["A", "B"], selection: "random-n", poolSize: 5 },
            { roundInStage: 3, tierCodes: ["B", "C"], selection: "random-n", poolSize: 5 },
            { roundInStage: 4, tierCodes: ["C", "D"], selection: "random-n", poolSize: 5 },
          ],
        },
        {
          id: "semifinal",
          name: "Semifinal",
          kind: "rounds",
          rounds: 1,
          advancement: { kind: "top-n", n: 8 },
          pairing: "seeded-snake",
          carryPoints: false,
          tierRules: [{ tierCodes: ["S", "A"], selection: "all" }],
        },
        {
          id: "final",
          name: "Final",
          kind: "rounds",
          rounds: 1,
          advancement: { kind: "table-winners", perTable: 2 },
          pairing: "seeded-block",
          carryPoints: false,
          tierRules: [{ tierCodes: ["S"], selection: "all" }],
        },
      ],
    },
  },
  {
    id: "swiss-top4",
    name: "Swiss + Final Table",
    description: "3 Swiss rounds, then the Top 4 play one final table.",
    mode: "custom",
    tierPresetId: "bloodlines-s-e",
    format: {
      templateId: "swiss-top4",
      placementPoints: [...DEFAULT_PLACEMENT_POINTS],
      clock: { ...DEFAULT_CLOCK },
      stages: [
        {
          id: "qualifying",
          name: "Qualifying",
          kind: "rounds",
          rounds: 3,
          advancement: { kind: "all" },
          pairing: "swiss-golf",
          carryPoints: true,
          tierRules: [{ tierCodes: ["A", "B", "C"], selection: "random-n", poolSize: 7, randomOneOf: true }],
        },
        {
          id: "final",
          name: "Final",
          kind: "rounds",
          rounds: 1,
          advancement: { kind: "top-n", n: 4 },
          pairing: "seeded-block",
          carryPoints: false,
          tierRules: [{ tierCodes: ["S", "A"], selection: "all" }],
        },
      ],
    },
  },
];

export function getFormatTemplate(id: string): FormatTemplate | undefined {
  return FORMAT_TEMPLATES.find((t) => t.id === id);
}

/** A blank generic stage for the settings editor */
export function createStage(index: number, tierCodes: string[]): StageConfig {
  return {
    id: `stage-${Date.now().toString(36)}-${index}`,
    name: index === 0 ? "Qualifying" : `Stage ${index + 1}`,
    kind: "rounds",
    rounds: 1,
    advancement: index === 0 ? { kind: "all" } : { kind: "top-n", n: 8 },
    pairing: index === 0 ? "swiss-golf" : "seeded-snake",
    carryPoints: index === 0,
    tierRules: [{ tierCodes: tierCodes.slice(0, 1), selection: "all" }],
  };
}

// ===== STATE MIGRATION =====

/**
 * Make sure a state has a format and tiers. States saved before formats existed
 * get the template of their mode and the Classic A/B/C tiers, which reproduces
 * their original behavior. Mutates and returns the state.
 */
export function ensureFormat(state: TournamentState): TournamentState {
  if (!state.mode) state.mode = "classic";
  if (!state.format) {
    const template = getFormatTemplate(state.mode === "colosseum" ? "colosseum" : "classic")!;
    const format = structuredClone(template.format);
    if (state.mode === "classic" && state.settings?.totalQualifyingRounds) {
      format.stages[0].rounds = state.settings.totalQualifyingRounds;
      format.stages[0].tierRules = classicQualifyingRules(state.settings.totalQualifyingRounds);
    }
    state.format = format;
  }
  if (!state.tiers) {
    state.tiers = tiersFromPreset("classic-abc");
  }
  return state;
}

/** The parts of a state needed to read its configuration */
export type FormatContext = Pick<TournamentState, "mode" | "format" | "tiers">;

/** Format of a state, falling back to its mode's template (never mutates) */
export function getFormat(state: FormatContext): TournamentFormat {
  if (state.format) return state.format;
  return getFormatTemplate(state.mode === "colosseum" ? "colosseum" : "classic")!.format;
}

/** Tiers of a state, falling back to Classic A/B/C (never mutates) */
export function getTiers(state: FormatContext): TierDef[] {
  return state.tiers ?? TIER_PRESETS[1].tiers;
}

// ===== STAGE LOOKUP =====

/**
 * Stage index a round belongs to. Custom rounds store it; in Classic and
 * Colosseum qualifying rounds are stage 0 and bracket rounds stage 1.
 */
export function getRoundStageIndex(round: Round): number {
  if (round.stageIndex !== undefined) return round.stageIndex;
  return round.type === "qualifying" ? 0 : 1;
}

/** Round number within its stage for Classic/Colosseum bracket rounds */
const BRACKET_ROUND_IN_STAGE: Record<string, number> = {
  "semifinal": 1,
  "winners-final": 2,
  "losers-final": 2,
  "grand-final": 3,
};

export function getRoundInStage(round: Round, rounds: Round[]): number {
  if (round.roundInStage !== undefined) return round.roundInStage;
  if (round.type === "qualifying") {
    return rounds.filter((r) => r.type === "qualifying" && r.number <= round.number).length;
  }
  return BRACKET_ROUND_IN_STAGE[round.type] ?? 1;
}

// ===== TIER RULES / LEADER POOLS =====

/** Rule for a given round of a stage: exact round match first, then the stage default */
export function resolveTierRule(stage: StageConfig | undefined, roundInStage: number): TierRule | undefined {
  if (!stage) return undefined;
  return (
    stage.tierRules.find((r) => r.roundInStage === roundInStage) ??
    stage.tierRules.find((r) => r.roundInStage === undefined)
  );
}

export interface LeaderPool {
  tierCodes: string[];
  /** Display label, e.g. "S+A" */
  label: string;
  /** Leader display names */
  leaders: string[];
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Leader display names of every leader in the given tiers (deduplicated, tier order) */
export function getTierLeaderNames(tiers: TierDef[], codes: string[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const code of codes) {
    const tier = tiers.find((t) => t.code === code);
    if (!tier) continue;
    for (const id of tier.leaderIds) {
      const info = getLeaderById(LEADER_ID_ALIASES[id] ?? id);
      if (!info || seen.has(info.id)) continue;
      seen.add(info.id);
      names.push(info.name);
    }
  }
  return names;
}

/** Draw the leader pool for a round according to a tier rule */
export function selectLeadersForRule(
  tiers: TierDef[],
  rule: TierRule,
  rng: () => number = Math.random,
): LeaderPool {
  const candidates = rule.tierCodes.filter((c) => tiers.some((t) => t.code === c));
  const codes = rule.randomOneOf && candidates.length > 0
    ? [candidates[Math.floor(rng() * candidates.length)]]
    : candidates;
  const leaders = getTierLeaderNames(tiers, codes);
  shuffleInPlace(leaders, rng);
  const size = rule.selection === "random-n" && rule.poolSize && rule.poolSize > 0
    ? Math.min(rule.poolSize, leaders.length)
    : leaders.length;
  return { tierCodes: codes, label: codes.join("+"), leaders: leaders.slice(0, size) };
}

/**
 * Leader pool fields for a new round. Returns an empty object when the stage
 * has no rule for this round (no leader restriction).
 */
export function buildRoundLeaderFields(
  state: TournamentState,
  stageIndex: number,
  roundInStage: number,
  options: { includePool: boolean } = { includePool: true },
): Pick<Round, "availableLeaders" | "leaderTier" | "tierCodes"> {
  const stage = getFormat(state).stages[stageIndex];
  const rule = resolveTierRule(stage, roundInStage);
  if (!rule || rule.tierCodes.length === 0) return {};
  const pool = selectLeadersForRule(getTiers(state), rule);
  if (pool.tierCodes.length === 0) return {};
  return {
    leaderTier: pool.label,
    tierCodes: pool.tierCodes,
    ...(options.includePool ? { availableLeaders: pool.leaders } : {}),
  };
}

// ===== SCORING / CLOCK =====

/** Placement points for a stage (stage override, else format default) */
export function resolvePlacementPoints(state: FormatContext, stageIndex: number): number[] {
  const format = getFormat(state);
  const stage = format.stages[stageIndex];
  return [...(stage?.placementPoints ?? format.placementPoints ?? DEFAULT_PLACEMENT_POINTS)];
}

/** Tournament points earned for a finishing position in a round */
export function pointsForPosition(round: Round, position: number): number {
  const table = round.placementPoints ?? DEFAULT_PLACEMENT_POINTS;
  return table[position - 1] ?? 0;
}

/** Effective clock for a stage, or null when no clock applies */
export function resolveClock(state: FormatContext, stageIndex: number): ClockConfig | null {
  const format = getFormat(state);
  if (!format.clock?.enabled) return null;
  const stage = format.stages[stageIndex];
  if (stage?.clockEnabled === false) return null;
  const budget = stage?.clockBudgetMinutes ?? format.clock.budgetMinutes;
  return { ...format.clock, budgetMinutes: budget };
}

/** Clock for the stage a round belongs to */
export function resolveRoundClock(state: FormatContext, round: Round): ClockConfig | null {
  return resolveClock(state, getRoundStageIndex(round));
}

/**
 * Tournament points lost for using `minutesUsed` against the clock budget.
 * started-minute: any part of a minute over counts as a full minute.
 */
export function computeClockPenalty(minutesUsed: number | undefined, clock: ClockConfig | null): number {
  if (!clock || minutesUsed === undefined || minutesUsed === null || Number.isNaN(minutesUsed)) return 0;
  const over = Math.max(0, minutesUsed - clock.budgetMinutes);
  // Round to avoid floating point noise (e.g. 30.1 - 30 = 0.10000000000000142)
  const overRounded = Math.round(over * 1000) / 1000;
  const minutes = clock.rounding === "full-minute" ? Math.floor(overRounded) : Math.ceil(overRounded);
  const penalty = minutes * clock.penaltyPerMinute;
  return clock.penaltyCap !== null && clock.penaltyCap !== undefined
    ? Math.min(penalty, clock.penaltyCap)
    : penalty;
}

/** Total clock penalty points a player has received */
export function getPenaltyTotal(playerId: string, rounds: Round[]): number {
  let total = 0;
  for (const round of rounds) {
    for (const table of round.tables) {
      if (!table.isComplete) continue;
      const result = table.results.find((r) => r.playerId === playerId);
      if (result?.penaltyPoints) total += result.penaltyPoints;
    }
  }
  return total;
}

// ===== FORMAT VALIDATION =====

export interface StageProjection {
  stageIndex: number;
  players: number;
  tables: number;
  errors: string[];
}

/** Player count entering a stage, given the previous stage's count */
function projectedEntrants(stage: StageConfig, previous: number, isFirst: boolean): number {
  if (isFirst || stage.advancement.kind === "all") return previous;
  if (stage.advancement.kind === "top-n") return Math.min(stage.advancement.n ?? 0, previous);
  const perTable = Math.min(stage.advancement.perTable ?? 1, TABLE_SIZE);
  return Math.floor(previous / TABLE_SIZE) * perTable;
}

/**
 * Project how many players and tables every stage will have, and list problems
 * (tables must always seat exactly 4).
 */
export function projectStages(format: TournamentFormat, playerCount: number): StageProjection[] {
  const result: StageProjection[] = [];
  let previous = playerCount;
  format.stages.forEach((stage, i) => {
    const players = projectedEntrants(stage, previous, i === 0);
    const errors: string[] = [];
    if (stage.rounds < 1) errors.push("Needs at least 1 round.");
    if (stage.kind === "rounds") {
      if (players < TABLE_SIZE) errors.push(`Needs at least ${TABLE_SIZE} players (has ${players}).`);
      else if (players % TABLE_SIZE !== 0) errors.push(`${players} players cannot be seated at tables of ${TABLE_SIZE}.`);
      if (stage.pairing === "groups-fixed" && players % 8 !== 0) errors.push("Fixed groups need a multiple of 8 players.");
    }
    if (stage.kind === "classic-bracket" && players < 16) errors.push("The Top 16 bracket needs at least 16 players.");
    if (stage.kind === "colosseum-bracket" && i === 0) errors.push("The knockout bracket cannot be the first stage.");
    if (i > 0 && stage.advancement.kind === "top-n" && (stage.advancement.n ?? 0) > previous) {
      errors.push(`Top ${stage.advancement.n} is more than the ${previous} players in the previous stage.`);
    }
    const placement = stage.placementPoints ?? format.placementPoints;
    if (placement.length !== TABLE_SIZE) errors.push("Placement points need a value for 1st to 4th.");
    result.push({
      stageIndex: i,
      players,
      tables: stage.kind === "rounds" ? Math.floor(players / TABLE_SIZE) : 0,
      errors,
    });
    previous = players;
  });
  return result;
}

/** All problems with a format for a given player count (empty = valid) */
export function validateFormat(format: TournamentFormat, playerCount: number, mode: TournamentMode): string[] {
  const errors: string[] = [];
  if (format.stages.length === 0) errors.push("Add at least one stage.");
  if (mode === "custom" && format.stages.some((s) => s.kind !== "rounds")) {
    errors.push("Custom tournaments only support round-based stages.");
  }
  for (const p of projectStages(format, playerCount)) {
    for (const e of p.errors) errors.push(`${format.stages[p.stageIndex].name}: ${e}`);
  }
  return errors;
}

// ===== CUSTOM STAGE ENGINE =====

/** Player ids entering a stage, restricted to players still registered */
export function getStageEntrants(state: TournamentState, stageIndex: number): string[] {
  const ids = state.stageEntrants?.[stageIndex] ?? [];
  const active = new Set(state.players.map((p) => p.id));
  return ids.filter((id) => active.has(id));
}

export function getStageRounds(state: TournamentState, stageIndex: number): Round[] {
  return state.rounds.filter((r) => r.stageIndex === stageIndex);
}

interface StageStats {
  points: number;
  wins: number;
  totalVP: number;
  efficiency: number;
}

/**
 * Stage standings. With carryPoints the ranking uses every point scored so far;
 * otherwise only points scored inside the stage count. Ties fall back to the
 * stage seed order.
 */
export function getStageStandings(state: TournamentState, stageIndex: number): Player[] {
  const stage = getFormat(state).stages[stageIndex];
  const entrants = getStageEntrants(state, stageIndex);
  const seed = new Map(entrants.map((id, i) => [id, i]));
  const playerMap = new Map(state.players.map((p) => [p.id, p]));
  const entrantPlayers = entrants.map((id) => playerMap.get(id)!).filter(Boolean);

  let ranked: Player[];
  let vpRounds: Round[];
  if (stage?.carryPoints) {
    ranked = entrantPlayers.map((p) => ({ ...p }));
    vpRounds = state.rounds;
  } else {
    vpRounds = getStageRounds(state, stageIndex).filter((r) => r.isComplete);
    const stats = new Map<string, StageStats>(entrants.map((id) => [id, { points: 0, wins: 0, totalVP: 0, efficiency: 0 }]));
    for (const round of vpRounds) {
      for (const table of round.tables) {
        if (!table.isComplete) continue;
        for (const result of table.results) {
          const s = stats.get(result.playerId);
          if (!s) continue;
          s.points += pointsForPosition(round, result.position) - (result.penaltyPoints ?? 0);
          s.totalVP += result.vp;
          s.efficiency += result.position;
          if (result.position === 1) s.wins++;
        }
      }
    }
    ranked = entrantPlayers.map((p) => ({ ...p, ...stats.get(p.id)! }));
  }

  const vpShare = new Map<string, number>();
  for (const p of ranked) vpShare.set(p.id, vpSharePct(p.id, vpRounds));

  return ranked.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const share = (vpShare.get(b.id) ?? 0) - (vpShare.get(a.id) ?? 0);
    if (share !== 0) return share;
    if (b.totalVP !== a.totalVP) return b.totalVP - a.totalVP;
    if (a.efficiency !== b.efficiency) return a.efficiency - b.efficiency;
    return (seed.get(a.id) ?? 0) - (seed.get(b.id) ?? 0);
  });
}

/** Mean VP share % over completed tables (same rule as tournament.getVpSharePct) */
function vpSharePct(playerId: string, rounds: Round[]): number {
  let total = 0;
  let games = 0;
  for (const round of rounds) {
    if (!round.isComplete) continue;
    for (const table of round.tables) {
      if (!table.isComplete || table.results.length === 0) continue;
      const mine = table.results.find((r) => r.playerId === playerId);
      if (!mine) continue;
      const sum = table.results.reduce((acc, r) => acc + r.vp, 0);
      if (sum > 0) total += (mine.vp / sum) * 100;
      games++;
    }
  }
  return games > 0 ? total / games : 0;
}

/** Ids advancing from stage `fromIndex` into the next stage, in seed order */
export function computeAdvancement(state: TournamentState, fromIndex: number): string[] {
  const format = getFormat(state);
  const next = format.stages[fromIndex + 1];
  if (!next) return [];
  const standings = getStageStandings(state, fromIndex).map((p) => p.id);
  const adv = next.advancement;

  if (adv.kind === "all") return standings;
  if (adv.kind === "top-n") return standings.slice(0, adv.n ?? standings.length);

  // table-winners: best `perTable` of every table in the stage's last round
  const perTable = Math.min(adv.perTable ?? 1, TABLE_SIZE);
  const lastRound = [...getStageRounds(state, fromIndex)].sort((a, b) => b.number - a.number)[0];
  if (!lastRound) return [];
  const rank = new Map(standings.map((id, i) => [id, i]));
  const qualifiers: { id: string; position: number }[] = [];
  for (const table of lastRound.tables) {
    const sorted = [...table.results].sort((a, b) => a.position - b.position);
    for (const r of sorted.slice(0, perTable)) qualifiers.push({ id: r.playerId, position: r.position });
  }
  const active = new Set(state.players.map((p) => p.id));
  return qualifiers
    .filter((q) => active.has(q.id))
    .sort((a, b) => a.position - b.position || (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map((q) => q.id);
}

/** Whether every round of a custom stage has been generated and completed */
export function isStageComplete(state: TournamentState, stageIndex: number): boolean {
  const stage = getFormat(state).stages[stageIndex];
  if (!stage) return false;
  const rounds = getStageRounds(state, stageIndex);
  return rounds.length >= stage.rounds && rounds.every((r) => r.isComplete);
}

/** Assign random groups of 8 to the given players (in place on state.players) */
function assignStageGroups(state: TournamentState, ids: string[], rng: () => number): void {
  const shuffled = [...ids];
  shuffleInPlace(shuffled, rng);
  const groupOf = new Map(shuffled.map((id, i) => [id, Math.floor(i / 8)]));
  state.players = state.players.map((p) => (groupOf.has(p.id) ? { ...p, groupId: groupOf.get(p.id) } : p));
}

/** Initialise custom stage 0 with every registered player (registration order = seed order) */
export function startCustomTournament(state: TournamentState, rng: () => number = Math.random): TournamentState {
  const next = structuredClone(state);
  const ids = next.players.map((p) => p.id);
  next.currentStage = 0;
  next.stageEntrants = [ids];
  if (getFormat(next).stages[0]?.pairing === "groups-fixed") assignStageGroups(next, ids, rng);
  next.phase = "qualifying";
  next.currentRound = 0;
  return next;
}

/** Move a custom tournament into its next stage */
export function advanceCustomStage(state: TournamentState, rng: () => number = Math.random): TournamentState {
  const current = state.currentStage ?? 0;
  if (!isStageComplete(state, current)) return state;
  const format = getFormat(state);
  if (current + 1 >= format.stages.length) {
    return { ...state, phase: "finished" };
  }
  const entrants = computeAdvancement(state, current);
  const next = structuredClone(state);
  next.currentStage = current + 1;
  next.stageEntrants = [...(next.stageEntrants ?? []).slice(0, current + 1), entrants];
  if (format.stages[current + 1].pairing === "groups-fixed") assignStageGroups(next, entrants, rng);
  return next;
}

/** Check organizer-entered tables: every entrant exactly once, all tables of 4 */
export function validateManualTables(tables: string[][], entrants: string[]): string | null {
  const seen = new Set<string>();
  for (const t of tables) {
    if (t.length !== TABLE_SIZE) return `Every table needs exactly ${TABLE_SIZE} players.`;
    for (const id of t) {
      if (seen.has(id)) return "A player is seated at more than one table.";
      seen.add(id);
    }
  }
  if (seen.size !== entrants.length || entrants.some((id) => !seen.has(id))) {
    return "Every player of the stage must be seated exactly once.";
  }
  return null;
}

/**
 * Generate the next round of the current custom stage. `manualTables` is
 * required when the stage uses manual pairing. Returns the state unchanged when
 * the stage has no rounds left or the input is invalid.
 */
export function generateCustomRound(
  state: TournamentState,
  manualTables?: string[][],
  rng: () => number = Math.random,
): TournamentState {
  const stageIndex = state.currentStage ?? 0;
  const stage = getFormat(state).stages[stageIndex];
  if (!stage) return state;
  const stageRounds = getStageRounds(state, stageIndex);
  if (stageRounds.length >= stage.rounds) return state;
  if (stageRounds.some((r) => !r.isComplete)) return state;

  const entrants = getStageEntrants(state, stageIndex);
  if (entrants.length < TABLE_SIZE || entrants.length % TABLE_SIZE !== 0) return state;

  const roundInStage = stageRounds.length + 1;
  const ranked = getStageStandings(state, stageIndex).map((p) => p.id);
  const playerMap = new Map(state.players.map((p) => [p.id, p]));
  let pods: string[][];

  switch (stage.pairing) {
    case "manual": {
      if (!manualTables || validateManualTables(manualTables, entrants)) return state;
      pods = manualTables.map((t) => [...t]);
      break;
    }
    case "random": {
      const shuffled = [...entrants];
      shuffleInPlace(shuffled, rng);
      pods = createGolfPods(shuffled, playerMap);
      break;
    }
    case "seeded-snake": {
      const order = snakeDraftOrder(ranked.length);
      pods = Array.from({ length: ranked.length / TABLE_SIZE }, () => [] as string[]);
      ranked.forEach((id, i) => pods[order[i]].push(id));
      break;
    }
    case "seeded-block": {
      pods = [];
      for (let i = 0; i < ranked.length; i += TABLE_SIZE) pods.push(ranked.slice(i, i + TABLE_SIZE));
      break;
    }
    case "groups-fixed": {
      const temp: TournamentState = {
        ...state,
        players: state.players.filter((p) => entrants.includes(p.id)),
        currentRound: roundInStage - 1,
      };
      pods = generateColosseumPairing(temp).map((t) => t.playerIds);
      break;
    }
    case "swiss-golf":
    default:
      pods = createGolfPods(ranked, playerMap);
      break;
  }

  const roundNumber = state.rounds.length + 1;
  const newRound: Round = {
    number: roundNumber,
    tables: pods.map((playerIds, i) => ({ id: i + 1, playerIds, results: [], isComplete: false })),
    isComplete: false,
    type: stageIndex === 0 ? "qualifying" : "stage",
    stageIndex,
    roundInStage,
    placementPoints: resolvePlacementPoints(state, stageIndex),
    ...buildRoundLeaderFields(state, stageIndex, roundInStage),
  };

  return {
    ...state,
    rounds: [...state.rounds, newRound],
    currentRound: roundNumber,
  };
}

/**
 * Final ranking of a custom tournament: players are grouped by the last stage
 * they reached (deepest first) and ranked inside it by that stage's standings.
 */
export function getCustomFinalStandings(state: TournamentState): Player[] {
  const lastStage = state.currentStage ?? 0;
  const placed = new Set<string>();
  const result: Player[] = [];
  const playerMap = new Map(state.players.map((p) => [p.id, p]));

  for (let i = lastStage; i >= 0; i--) {
    for (const p of getStageStandings(state, i)) {
      if (placed.has(p.id)) continue;
      placed.add(p.id);
      result.push(playerMap.get(p.id)!);
    }
  }
  const rest = state.players.filter((p) => !placed.has(p.id));
  rest.sort((a, b) => b.points - a.points || b.wins - a.wins || b.totalVP - a.totalVP);
  return [...result, ...rest];
}

// ===== DISPLAY HELPERS =====

/** Badge color for a tier label ("A", "S+A" → color of the first tier) */
export function getTierColor(tiers: TierDef[] | undefined, label: string | undefined): string {
  if (!label) return FALLBACK_TIER_COLOR;
  const first = label.split("+")[0];
  return tiers?.find((t) => t.code === first)?.color ?? TIER_COLORS[first] ?? FALLBACK_TIER_COLOR;
}

/** Human readable name of the stage a round belongs to */
export function getRoundStageName(state: FormatContext, round: Round): string {
  if (state.mode === "custom") {
    const stage = getFormat(state).stages[getRoundStageIndex(round)];
    return stage ? `${stage.name} — Round ${round.roundInStage ?? 1}` : `Round ${round.number}`;
  }
  switch (round.type) {
    case "qualifying": return "Qualifying";
    case "semifinal": return "Semifinal";
    case "winners-final": return "Winners & Losers Finals";
    case "grand-final": return "Grand Final";
    default: return round.type;
  }
}

/** Round-dependent props for TableCard (leader pool, tiers, points, clock) */
export function getTableCardRoundProps(state: FormatContext, round: Round) {
  const isColosseum = state.mode === "colosseum";
  return {
    availableLeaders: isColosseum ? undefined : round.availableLeaders,
    leaderTier: isColosseum ? undefined : round.leaderTier,
    tiers: getTiers(state),
    placementPoints: round.placementPoints ?? DEFAULT_PLACEMENT_POINTS,
    clock: resolveRoundClock(state, round),
    mode: state.mode,
  };
}

/** Short description of a tier rule, e.g. "S+A", "A/B/C" (one of) */
export function describeTierRule(rule: TierRule | undefined): string {
  if (!rule || rule.tierCodes.length === 0) return "Any";
  return rule.tierCodes.join(rule.randomOneOf ? "/" : "+");
}
