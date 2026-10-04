import type {
  Round,
  TableResult,
  TierDef,
  TournamentFormat,
  TournamentMode,
  TournamentState,
} from "./types";
import { DEFAULT_STATE } from "./types";
import {
  createPlayer,
  initializePlayerIds,
  generateSwissPairing,
  generateColosseumPairing,
  assignGroups,
  generateSemifinals,
  generateFinalsRound6,
  generateGrandFinal,
  applyResults,
  revertTableResults,
  applyTableResults,
  migrateLeaderNames,
  backfillPlayerWins,
} from "./tournament";
import {
  advanceCustomStage,
  buildRoundLeaderFields,
  computeClockPenalty,
  ensureFormat,
  generateCustomRound,
  getFormatTemplate,
  getRoundStageIndex,
  resolvePlacementPoints,
  resolveRoundClock,
  startCustomTournament,
  tiersFromPreset,
  validateFormat,
} from "./format";

// ===== ACTIONS =====

export type TournamentAction =
  | { type: "SELECT_MODE"; mode: TournamentMode }
  | { type: "CREATE_FROM_TEMPLATE"; templateId: string; tierPresetId?: string; name?: string }
  | { type: "UPDATE_FORMAT"; format: TournamentFormat; tiers: TierDef[] }
  | { type: "ADD_PLAYER"; name: string }
  | { type: "ADD_PLAYERS"; names: string[] }
  | { type: "REMOVE_PLAYER"; id: string }
  | { type: "RENAME_PLAYER"; id: string; name: string }
  | { type: "DROP_PLAYER"; id: string }
  | { type: "SET_TOURNAMENT_NAME"; name: string }
  | { type: "START_TOURNAMENT" }
  | { type: "GENERATE_ROUND"; tables?: string[][] }
  | { type: "SUBMIT_TABLE_RESULTS"; roundIndex: number; tableId: number; results: TableResult[] }
  | { type: "BATCH_SUBMIT_TABLE_RESULTS"; roundIndex: number; tables: { tableId: number; results: TableResult[] }[] }
  | { type: "START_TOP8" }
  | { type: "GENERATE_TOP8_ROUND" }
  | { type: "ADVANCE_STAGE" }
  | { type: "IMPORT_STATE"; state: TournamentState }
  | { type: "TOGGLE_DRAMATIC_REVEAL" }
  | { type: "TOGGLE_TEST_MODE" }
  | { type: "SET_JSONBIN_INFO"; binId: string; binKey: string }
  // ── Colosseum-specific actions ──
  | { type: "SET_GROUP_ASSIGNMENTS"; assignments: Record<string, number> }
  | { type: "PROCEED_TO_QUALIFYING" }
  | { type: "START_KNOCKOUT_DRAW" }
  | { type: "CONFIRM_KNOCKOUT_DRAW"; tables: string[][] }
  | { type: "RESET" };

// ===== HELPERS =====

function now(): string {
  return new Date().toISOString();
}

/** Fresh empty state */
export function createInitialState(): TournamentState {
  return { ...DEFAULT_STATE, metadata: { ...DEFAULT_STATE.metadata, timestamp: now() } };
}

/** New registration-phase state from a format template */
function fromTemplate(
  state: TournamentState,
  templateId: string,
  tierPresetId?: string,
  name?: string,
): TournamentState {
  const template = getFormatTemplate(templateId);
  if (!template) return state;
  const defaultName = template.mode === "colosseum"
    ? "The Colosseum — Uprising • Bloodlines"
    : template.mode === "classic"
    ? "Dune Bloodlines Open"
    : `Dune Bloodlines ${template.name}`;
  return {
    ...state,
    mode: template.mode,
    phase: "registration",
    format: structuredClone(template.format),
    tiers: tiersFromPreset(tierPresetId ?? template.tierPresetId),
    currentStage: undefined,
    stageEntrants: undefined,
    metadata: { ...state.metadata, tournamentName: name?.trim() || defaultName, timestamp: now() },
    settings: {
      ...state.settings,
      totalQualifyingRounds: template.format.stages[0]?.rounds ?? state.settings.totalQualifyingRounds,
      dramaticReveal: template.mode !== "colosseum",
    },
  };
}

/** Attach clock penalties (from minutes used) to submitted results */
function withPenalties(state: TournamentState, round: Round, results: TableResult[]): TableResult[] {
  const clock = resolveRoundClock(state, round);
  return results.map((r) => {
    const minutesUsed = clock && r.minutesUsed !== undefined && r.minutesUsed !== null ? r.minutesUsed : undefined;
    return {
      ...r,
      minutesUsed,
      penaltyPoints: computeClockPenalty(minutesUsed, clock),
    };
  });
}

/** Leader pool + placement points for a Classic/Colosseum round */
function legacyRoundFields(
  state: TournamentState,
  stageIndex: number,
  roundInStage: number,
): Pick<Round, "availableLeaders" | "leaderTier" | "tierCodes" | "placementPoints"> {
  return {
    placementPoints: resolvePlacementPoints(state, stageIndex),
    // Colosseum games pick leaders online: show the tier, not a drawn pool
    ...buildRoundLeaderFields(state, stageIndex, roundInStage, { includePool: state.mode !== "colosseum" }),
  };
}

/** Pre-generate the Colosseum group rounds */
function colosseumQualifyingRounds(state: TournamentState): Round[] {
  const rounds: Round[] = [];
  const stage = state.format?.stages[0];
  const count = stage?.rounds ?? 4;
  for (let i = 0; i < count; i++) {
    const tables = generateColosseumPairing({ ...state, currentRound: i });
    rounds.push({
      number: i + 1,
      tables,
      isComplete: false,
      type: "qualifying",
      ...legacyRoundFields(state, 0, i + 1),
    });
  }
  return rounds;
}

function sortByResult(table: { results: TableResult[] }): TableResult[] {
  return [...table.results].sort((a, b) => a.position - b.position);
}

// ===== REDUCER =====

/**
 * Pure tournament state machine shared by the browser (local mode) and the
 * API server. Randomness (pairings, leader pools) happens here.
 */
export function tournamentReducer(state: TournamentState, action: TournamentAction): TournamentState {
  switch (action.type) {
    case "SELECT_MODE": {
      return fromTemplate(state, action.mode === "colosseum" ? "colosseum" : action.mode === "custom" ? "swiss-top8" : "classic");
    }

    case "CREATE_FROM_TEMPLATE": {
      return fromTemplate(state, action.templateId, action.tierPresetId, action.name);
    }

    case "UPDATE_FORMAT": {
      const format = structuredClone(action.format);
      const tiers = structuredClone(action.tiers);
      const next: TournamentState = {
        ...state,
        format,
        tiers,
        metadata: { ...state.metadata, timestamp: now() },
        settings: {
          ...state.settings,
          totalQualifyingRounds: state.mode === "classic"
            ? format.stages[0]?.rounds ?? state.settings.totalQualifyingRounds
            : state.settings.totalQualifyingRounds,
        },
      };
      // Rounds without any result yet pick up the new placement points
      next.rounds = state.rounds.map((round) => {
        if (round.isComplete || round.tables.some((t) => t.isComplete && t.results.length > 0)) return round;
        return { ...round, placementPoints: resolvePlacementPoints(next, getRoundStageIndex(round)) };
      });
      return next;
    }

    case "ADD_PLAYER": {
      const player = createPlayer(action.name);
      return {
        ...state,
        players: [...state.players, player],
        metadata: { ...state.metadata, timestamp: now() },
      };
    }

    case "ADD_PLAYERS": {
      const players = action.names.filter((n) => n.trim()).map((n) => createPlayer(n));
      return {
        ...state,
        players: [...state.players, ...players],
        metadata: { ...state.metadata, timestamp: now() },
      };
    }

    case "REMOVE_PLAYER": {
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
      };
    }

    case "RENAME_PLAYER": {
      const trimmed = action.name.trim();
      if (!trimmed) return state;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.id ? { ...p, name: trimmed } : p
        ),
        metadata: { ...state.metadata, timestamp: now() },
      };
    }

    case "DROP_PLAYER": {
      // Remove player from active roster; past round results are preserved
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
        metadata: { ...state.metadata, timestamp: now() },
      };
    }

    case "SET_TOURNAMENT_NAME": {
      return {
        ...state,
        metadata: { ...state.metadata, tournamentName: action.name },
      };
    }

    case "START_TOURNAMENT": {
      const withFormat = ensureFormat(structuredClone(state));
      if (withFormat.mode === "custom") {
        if (validateFormat(withFormat.format!, withFormat.players.length, "custom").length > 0) return state;
        return startCustomTournament(withFormat);
      }
      if (withFormat.mode === "colosseum") {
        // Colosseum: need multiples of 8, minimum 16
        if (withFormat.players.length < 16 || withFormat.players.length % 8 !== 0) return state;
        const groupedPlayers = assignGroups(withFormat.players);
        return {
          ...withFormat,
          players: groupedPlayers,
          phase: "group-draw",
          currentRound: 0,
        };
      }
      // Classic: need multiples of 4
      if (withFormat.players.length < 4 || withFormat.players.length % 4 !== 0) return state;
      return {
        ...withFormat,
        phase: "qualifying",
        currentRound: 0,
      };
    }

    case "GENERATE_ROUND": {
      if (state.mode === "custom") {
        return generateCustomRound(state, action.tables);
      }
      const tables = generateSwissPairing(state);
      const roundNumber = state.rounds.length + 1;
      const newRound: Round = {
        number: roundNumber,
        tables,
        isComplete: false,
        type: "qualifying",
        ...legacyRoundFields(state, 0, roundNumber),
      };
      return {
        ...state,
        rounds: [...state.rounds, newRound],
        currentRound: roundNumber,
      };
    }

    case "SUBMIT_TABLE_RESULTS": {
      let newState = structuredClone(state);
      const round = newState.rounds[action.roundIndex];
      if (!round) return state;

      const table = round.tables.find((t) => t.id === action.tableId);
      if (!table) return state;

      const results = withPenalties(newState, round, action.results);
      // Colosseum scores each table as soon as it is entered; other modes
      // score the whole round once every table is complete.
      const scoresPerTable = newState.mode === "colosseum";
      const wasScored = table.isComplete && table.results.length > 0 && (scoresPerTable || round.isComplete);

      // If this table was already scored, revert old scoring first
      if (wasScored) {
        newState = revertTableResults(newState, action.roundIndex, action.tableId);
        const revertedRound = newState.rounds[action.roundIndex];
        const revertedTable = revertedRound.tables.find((t) => t.id === action.tableId);
        if (revertedTable) {
          revertedTable.results = results;
          revertedTable.isComplete = true;
        }
        revertedRound.isComplete = revertedRound.tables.every((t) => t.isComplete);
        // Apply new scoring for this table
        return applyTableResults(newState, action.roundIndex, action.tableId);
      }

      table.results = results;
      table.isComplete = true;
      round.isComplete = round.tables.every((t) => t.isComplete);

      if (scoresPerTable) {
        newState = applyTableResults(newState, action.roundIndex, action.tableId);
      } else if (round.isComplete) {
        return applyResults(newState, action.roundIndex);
      }

      return newState;
    }

    case "BATCH_SUBMIT_TABLE_RESULTS": {
      let newState = structuredClone(state);
      if (!newState.rounds[action.roundIndex]) return state;
      const scoresPerTable = newState.mode === "colosseum";

      for (const { tableId, results } of action.tables) {
        // applyTableResults returns a new state, so look the round up every time
        const batchRound = newState.rounds[action.roundIndex];
        const table = batchRound.tables.find((t) => t.id === tableId);
        if (!table || table.isComplete) continue;
        table.results = withPenalties(newState, batchRound, results);
        table.isComplete = true;
        if (scoresPerTable) newState = applyTableResults(newState, action.roundIndex, tableId);
      }

      const roundAfter = newState.rounds[action.roundIndex];
      roundAfter.isComplete = roundAfter.tables.every((t) => t.isComplete);

      if (roundAfter.isComplete && !scoresPerTable) {
        return applyResults(newState, action.roundIndex);
      }

      return newState;
    }

    case "START_TOP8": {
      if (state.mode === "custom") return state;
      if (state.mode === "colosseum") {
        // Colosseum: go to knockout draw phase
        return { ...state, phase: "knockout-draw" };
      }
      // Classic: generate semifinal tables directly
      const tables = generateSemifinals(state);
      if (tables.length === 0) return state;

      const newRound: Round = {
        number: state.rounds.length + 1,
        tables,
        isComplete: false,
        type: "semifinal",
        ...legacyRoundFields(state, 1, 1),
      };
      return {
        ...state,
        rounds: [...state.rounds, newRound],
        currentRound: newRound.number,
        phase: "top8",
      };
    }

    case "GENERATE_TOP8_ROUND": {
      if (state.mode === "custom") return state;
      const lastRound = state.rounds[state.rounds.length - 1];
      if (!lastRound || !lastRound.isComplete) return state;

      if (lastRound.type === "semifinal") {
        if (state.mode === "colosseum") {
          // Colosseum SF2: collect losers from SF1 + eliminator winners
          // SF1A and SF1B are tables 1,2; ElimA and ElimB are tables 3,4
          const sf1a = lastRound.tables[0];
          const sf1b = lastRound.tables[1];
          const elimA = lastRound.tables[2];
          const elimB = lastRound.tables[3];

          const sf1aLosers = sortByResult(sf1a).slice(1).map((r) => r.playerId);
          const sf1bLosers = sortByResult(sf1b).slice(1).map((r) => r.playerId);
          const elimAWinner = sortByResult(elimA)[0].playerId;
          const elimBWinner = sortByResult(elimB)[0].playerId;

          // 8 players → 2 tables of 4
          const pool = [...sf1aLosers, ...sf1bLosers, elimAWinner, elimBWinner];
          // Shuffle for randomness
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          const sf2Tables = [
            { id: 1, playerIds: pool.slice(0, 4), results: [] as TableResult[], isComplete: false },
            { id: 2, playerIds: pool.slice(4, 8), results: [] as TableResult[], isComplete: false },
          ];
          const newRound: Round = {
            number: state.rounds.length + 1,
            tables: sf2Tables,
            isComplete: false,
            type: "winners-final",
            ...legacyRoundFields(state, 1, 2),
          };
          return {
            ...state,
            rounds: [...state.rounds, newRound],
            currentRound: newRound.number,
          };
        }
        // Classic: Generate 3 Redemption tables: bye (2p) + 2 Lower Finals (4p each)
        const redemptionTables = generateFinalsRound6(lastRound);
        // Auto-mark bye table (table 1) as complete — no game played
        redemptionTables[0].isComplete = true;
        const redemptionRound: Round = {
          number: state.rounds.length + 1,
          tables: redemptionTables,
          isComplete: false,
          type: "winners-final",
          ...legacyRoundFields(state, 1, 2),
        };
        return {
          ...state,
          rounds: [...state.rounds, redemptionRound],
          currentRound: redemptionRound.number,
        };
      }

      if (lastRound.type === "winners-final") {
        if (state.mode === "colosseum") {
          // Colosseum Grand Final: SF1A winner + SF1B winner + SF2A winner + SF2B winner
          const sfRound = state.rounds.find((r) => r.type === "semifinal");
          if (!sfRound) return state;

          const sf1aWinner = sortByResult(sfRound.tables[0])[0].playerId;
          const sf1bWinner = sortByResult(sfRound.tables[1])[0].playerId;
          const sf2aWinner = sortByResult(lastRound.tables[0])[0].playerId;
          const sf2bWinner = sortByResult(lastRound.tables[1])[0].playerId;

          const grandFinalTable = {
            id: 1,
            playerIds: [sf1aWinner, sf1bWinner, sf2aWinner, sf2bWinner],
            results: [] as TableResult[],
            isComplete: false,
          };
          const gfRound: Round = {
            number: state.rounds.length + 1,
            tables: [grandFinalTable],
            isComplete: false,
            type: "grand-final",
            ...legacyRoundFields(state, 1, 3),
          };
          return {
            ...state,
            rounds: [...state.rounds, gfRound],
            currentRound: gfRound.number,
          };
        }
        // Classic: Generate Grand Final from Redemption round
        const grandFinalTable = generateGrandFinal(lastRound);
        const newRound: Round = {
          number: state.rounds.length + 1,
          tables: [grandFinalTable],
          isComplete: false,
          type: "grand-final",
          ...legacyRoundFields(state, 1, 3),
        };
        return {
          ...state,
          rounds: [...state.rounds, newRound],
          currentRound: newRound.number,
        };
      }

      if (lastRound.type === "grand-final") {
        return { ...state, phase: "finished" };
      }

      return state;
    }

    case "ADVANCE_STAGE": {
      if (state.mode !== "custom") return state;
      return advanceCustomStage(state);
    }

    case "IMPORT_STATE": {
      const imported = structuredClone(action.state);
      initializePlayerIds(imported.players);
      migrateLeaderNames(imported);
      // Ensure wins field exists and is computed for imported states
      for (const p of imported.players) {
        p.wins = p.wins ?? 0;
      }
      backfillPlayerWins(imported);
      return ensureFormat(imported);
    }

    case "TOGGLE_DRAMATIC_REVEAL": {
      return {
        ...state,
        settings: {
          ...state.settings,
          dramaticReveal: !state.settings.dramaticReveal,
        },
      };
    }

    case "TOGGLE_TEST_MODE": {
      return {
        ...state,
        settings: {
          ...state.settings,
          testMode: !state.settings.testMode,
        },
      };
    }

    case "SET_JSONBIN_INFO": {
      return {
        ...state,
        metadata: {
          ...state.metadata,
          jsonbinId: action.binId,
          jsonbinKey: action.binKey,
        },
      };
    }

    // ── Colosseum-specific actions ──

    case "SET_GROUP_ASSIGNMENTS": {
      if (state.mode !== "colosseum") return state;
      // Apply manual group assignments from spinner wheel
      const newPlayers = state.players.map((p) => ({
        ...p,
        groupId: action.assignments[p.id] ?? p.groupId ?? 0,
      }));
      const withPlayers: TournamentState = { ...state, players: newPlayers, currentRound: 0 };
      return {
        ...state,
        players: newPlayers,
        rounds: colosseumQualifyingRounds(withPlayers),
        phase: "qualifying",
        currentRound: 1,
      };
    }

    case "PROCEED_TO_QUALIFYING": {
      if (state.mode !== "colosseum") return state;
      // Use existing group assignments to pre-generate all rounds
      return {
        ...state,
        rounds: colosseumQualifyingRounds({ ...state, currentRound: 0 }),
        phase: "qualifying",
        currentRound: 1,
      };
    }

    case "START_KNOCKOUT_DRAW": {
      if (state.mode !== "colosseum") return state;
      return { ...state, phase: "knockout-draw" };
    }

    case "CONFIRM_KNOCKOUT_DRAW": {
      if (state.mode !== "colosseum") return state;
      // action.tables: array of 4 arrays of player IDs (SF1A, SF1B, ElimA, ElimB)
      const knockoutTables = action.tables.map((playerIds, idx) => ({
        id: idx + 1,
        playerIds,
        results: [],
        isComplete: false,
      }));
      const newRound: Round = {
        number: state.rounds.length + 1,
        tables: knockoutTables,
        isComplete: false,
        type: "semifinal",
        ...legacyRoundFields(state, 1, 1),
      };
      return {
        ...state,
        rounds: [...state.rounds, newRound],
        currentRound: newRound.number,
        phase: "top8",
      };
    }

    case "RESET": {
      return createInitialState();
    }

    default:
      return state;
  }
}

/**
 * Normalize a stored state (localStorage, database, import): fix ids,
 * leader names, wins, mode and format. Mutates and returns the state.
 */
export function normalizeLoadedState(parsed: TournamentState): TournamentState {
  initializePlayerIds(parsed.players);
  migrateLeaderNames(parsed);

  // Backfill wins for states saved before the wins field existed
  const needsBackfill = parsed.players.some((p) => p.wins === undefined || p.wins === null);
  if (needsBackfill) {
    for (const p of parsed.players) {
      p.wins = p.wins ?? 0;
    }
    backfillPlayerWins(parsed);
  }

  // Backfill mode for old states without it
  if (!parsed.mode) {
    parsed.mode = "classic";
  }
  // Strip leader selection data from Colosseum rounds (old states may have it)
  // Keep leaderTier for display purposes (tier badge on round buttons)
  if (parsed.mode === "colosseum") {
    for (const round of parsed.rounds) {
      delete round.availableLeaders;
    }
  }
  // Home screen states do not get a format until a template is chosen
  if (parsed.phase !== "home") ensureFormat(parsed);
  return parsed;
}
