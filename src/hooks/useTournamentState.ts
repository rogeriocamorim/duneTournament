import { useReducer, useCallback, useEffect } from "react";
import type { TournamentState, TournamentMode, Round, TableResult } from "../engine/types";
import { DEFAULT_STATE } from "../engine/types";
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
  getStandings,
  getFinalStandings,
  getTierForRound,
  randomTier,
  selectRoundLeaders,
  migrateLeaderNames,
  backfillPlayerWins,
  getVpSharePct,
} from "../engine/tournament";
import type { StandingsSnapshot } from "../utils/gistService";
import { createStandingsBin, updateStandingsBin } from "../utils/jsonbinService";

const STORAGE_KEY = "dune_tournament_state";

// ===== ACTIONS =====

type Action =
  | { type: "SELECT_MODE"; mode: TournamentMode }
  | { type: "ADD_PLAYER"; name: string }
  | { type: "REMOVE_PLAYER"; id: string }
  | { type: "SET_TOURNAMENT_NAME"; name: string }
  | { type: "START_TOURNAMENT" }
  | { type: "GENERATE_ROUND" }
  | { type: "SUBMIT_TABLE_RESULTS"; roundIndex: number; tableId: number; results: TableResult[] }
  | { type: "BATCH_SUBMIT_TABLE_RESULTS"; roundIndex: number; tables: { tableId: number; results: TableResult[] }[] }
  | { type: "START_TOP8" }
  | { type: "GENERATE_TOP8_ROUND" }
  | { type: "IMPORT_STATE"; state: TournamentState }
  | { type: "TOGGLE_DRAMATIC_REVEAL" }
  | { type: "TOGGLE_TEST_MODE" }
  | { type: "SET_JSONBIN_INFO"; binId: string; binKey: string }
  // ── Colosseum-specific actions ──
  | { type: "SET_GROUP_ASSIGNMENTS"; assignments: Map<string, number> }
  | { type: "PROCEED_TO_QUALIFYING" }
  | { type: "START_KNOCKOUT_DRAW" }
  | { type: "CONFIRM_KNOCKOUT_DRAW"; tables: string[][] }
  | { type: "RESET" };

// ===== REDUCER =====

function tournamentReducer(state: TournamentState, action: Action): TournamentState {
  switch (action.type) {
    case "SELECT_MODE": {
      const tournamentName = action.mode === "colosseum"
        ? "The Colosseum \u2014 Uprising \u2022 Bloodlines"
        : "Dune Bloodlines Open";
      const totalQualifyingRounds = action.mode === "colosseum" ? 4 : 5;
      return {
        ...state,
        mode: action.mode,
        phase: "registration",
        metadata: { ...state.metadata, tournamentName, timestamp: new Date().toISOString() },
        settings: { ...state.settings, totalQualifyingRounds },
      };
    }

    case "ADD_PLAYER": {
      const player = createPlayer(action.name);
      return {
        ...state,
        players: [...state.players, player],
        metadata: { ...state.metadata, timestamp: new Date().toISOString() },
      };
    }

    case "REMOVE_PLAYER": {
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
      };
    }

    case "SET_TOURNAMENT_NAME": {
      return {
        ...state,
        metadata: { ...state.metadata, tournamentName: action.name },
      };
    }

    case "START_TOURNAMENT": {
      if (state.mode === "colosseum") {
        // Colosseum: need multiples of 8, minimum 16
        if (state.players.length < 16 || state.players.length % 8 !== 0) return state;
        const groupedPlayers = assignGroups(state.players);
        return {
          ...state,
          players: groupedPlayers,
          phase: "group-draw",
          currentRound: 0,
        };
      }
      // Classic: need multiples of 4
      if (state.players.length < 4 || state.players.length % 4 !== 0) return state;
      return {
        ...state,
        phase: "qualifying",
        currentRound: 0,
      };
    }

    case "GENERATE_ROUND": {
      const tables = generateSwissPairing(state);
      const roundNumber = state.rounds.length + 1;
      const tier = getTierForRound(roundNumber, false);
      const leaders = selectRoundLeaders(tier);
      const newRound: Round = {
        number: roundNumber,
        tables,
        isComplete: false,
        type: "qualifying",
        availableLeaders: leaders.map((l) => l.name),
        leaderTier: tier,
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

      // If this table was previously complete, revert old scoring first
      if (table.isComplete && table.results.length > 0) {
        newState = revertTableResults(newState, action.roundIndex, action.tableId);
        const revertedRound = newState.rounds[action.roundIndex];
        const revertedTable = revertedRound.tables.find((t) => t.id === action.tableId);
        if (revertedTable) {
          revertedTable.results = action.results;
          revertedTable.isComplete = true;
        }
        revertedRound.isComplete = revertedRound.tables.every((t) => t.isComplete);
        // Apply new scoring for this table
        newState = applyTableResults(newState, action.roundIndex, action.tableId);
        return newState;
      }

      table.results = action.results;
      table.isComplete = true;
      round.isComplete = round.tables.every((t) => t.isComplete);

      if (state.mode === "colosseum") {
        // Colosseum: apply scoring per-table immediately
        newState = applyTableResults(newState, action.roundIndex, action.tableId);
      } else {
        // Classic: apply results for ALL tables only when round is complete
        if (round.isComplete) {
          return applyResults(newState, action.roundIndex);
        }
      }

      return newState;
    }

    case "BATCH_SUBMIT_TABLE_RESULTS": {
      let newState = structuredClone(state);
      const batchRound = newState.rounds[action.roundIndex];
      if (!batchRound) return state;

      for (const { tableId, results } of action.tables) {
        const table = batchRound.tables.find((t) => t.id === tableId);
        if (!table) continue;
        table.results = results;
        table.isComplete = true;
      }

      batchRound.isComplete = batchRound.tables.every((t) => t.isComplete);

      if (batchRound.isComplete) {
        return applyResults(newState, action.roundIndex);
      }

      return newState;
    }

    case "START_TOP8": {
      if (state.mode === "colosseum") {
        // Colosseum: go to knockout draw phase
        return { ...state, phase: "knockout-draw" };
      }
      // Classic: generate semifinal tables directly
      const tables = generateSemifinals(state);
      if (tables.length === 0) return state;

      const cLeaders = selectRoundLeaders("C");
      const newRound: Round = {
        number: state.rounds.length + 1,
        tables,
        isComplete: false,
        type: "semifinal",
        availableLeaders: cLeaders.map((l) => l.name),
        leaderTier: "C",
      };
      return {
        ...state,
        rounds: [...state.rounds, newRound],
        currentRound: newRound.number,
        phase: "top8",
      };
    }

    case "GENERATE_TOP8_ROUND": {
      const lastRound = state.rounds[state.rounds.length - 1];
      if (!lastRound || !lastRound.isComplete) return state;

      if (lastRound.type === "semifinal") {
        if (state.mode === "colosseum") {
          // Colosseum SF2: collect losers from SF1 + eliminator winners
          const sortByResult = (table: { results: TableResult[] }) =>
            [...table.results].sort((a, b) => a.position - b.position);

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
          const bLeaders = selectRoundLeaders("B");
          const newRound: Round = {
            number: state.rounds.length + 1,
            tables: sf2Tables,
            isComplete: false,
            type: "winners-final",
            availableLeaders: bLeaders.map((l) => l.name),
            leaderTier: "B",
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
        const cLeadersRedemption = selectRoundLeaders("C");
        const redemptionRound: Round = {
          number: state.rounds.length + 1,
          tables: redemptionTables,
          isComplete: false,
          type: "winners-final",
          availableLeaders: cLeadersRedemption.map((l) => l.name),
          leaderTier: "C",
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
          const sortByResult = (table: { results: TableResult[] }) =>
            [...table.results].sort((a, b) => a.position - b.position);

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
          const cLeadersGF = selectRoundLeaders("C");
          const gfRound: Round = {
            number: state.rounds.length + 1,
            tables: [grandFinalTable],
            isComplete: false,
            type: "grand-final",
            availableLeaders: cLeadersGF.map((l) => l.name),
            leaderTier: "C",
          };
          return {
            ...state,
            rounds: [...state.rounds, gfRound],
            currentRound: gfRound.number,
          };
        }
        // Classic: Generate Grand Final from Redemption round
        const grandFinalTable = generateGrandFinal(lastRound);
        const grandFinalTier = randomTier();
        const grandFinalLeaders = selectRoundLeaders(grandFinalTier);
        const newRound: Round = {
          number: state.rounds.length + 1,
          tables: [grandFinalTable],
          isComplete: false,
          type: "grand-final",
          availableLeaders: grandFinalLeaders.map((l) => l.name),
          leaderTier: grandFinalTier,
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

    case "IMPORT_STATE": {
      initializePlayerIds(action.state.players);
      migrateLeaderNames(action.state);
      // Ensure wins field exists and is computed for imported states
      for (const p of action.state.players) {
        p.wins = p.wins ?? 0;
      }
      backfillPlayerWins(action.state);
      // Backfill mode for old states without it
      if (!action.state.mode) {
        action.state.mode = "classic";
      }
      return action.state;
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
        groupId: action.assignments.get(p.id) ?? p.groupId ?? 0,
      }));

      // Pre-generate all 4 qualifying rounds
      const rounds: Round[] = [];
      let tempState: TournamentState = { ...state, players: newPlayers, currentRound: 0 };
      for (let i = 0; i < 4; i++) {
        tempState = { ...tempState, currentRound: i };
        const tables = generateColosseumPairing(tempState);
        const roundNumber = i + 1;
        const tierCycle: ("B" | "C" | "A")[] = ["B", "C", "A", "B"];
        const tier = tierCycle[i];
        const leaders = selectRoundLeaders(tier);
        rounds.push({
          number: roundNumber,
          tables,
          isComplete: false,
          type: "qualifying",
          availableLeaders: leaders.map((l) => l.name),
          leaderTier: tier,
        });
      }

      return {
        ...state,
        players: newPlayers,
        rounds,
        phase: "qualifying",
        currentRound: 1,
      };
    }

    case "PROCEED_TO_QUALIFYING": {
      if (state.mode !== "colosseum") return state;
      // Use existing group assignments to pre-generate all 4 rounds
      const rounds: Round[] = [];
      let tempState: TournamentState = { ...state, currentRound: 0 };
      for (let i = 0; i < 4; i++) {
        tempState = { ...tempState, currentRound: i };
        const tables = generateColosseumPairing(tempState);
        const roundNumber = i + 1;
        const tierCycle: ("B" | "C" | "A")[] = ["B", "C", "A", "B"];
        const tier = tierCycle[i];
        const leaders = selectRoundLeaders(tier);
        rounds.push({
          number: roundNumber,
          tables,
          isComplete: false,
          type: "qualifying",
          availableLeaders: leaders.map((l) => l.name),
          leaderTier: tier,
        });
      }
      return {
        ...state,
        rounds,
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
      const aLeaders = selectRoundLeaders("A");
      const newRound: Round = {
        number: state.rounds.length + 1,
        tables: knockoutTables,
        isComplete: false,
        type: "semifinal",
        availableLeaders: aLeaders.map((l) => l.name),
        leaderTier: "A",
      };
      return {
        ...state,
        rounds: [...state.rounds, newRound],
        currentRound: newRound.number,
        phase: "top8",
      };
    }

    case "RESET": {
      return { ...DEFAULT_STATE, metadata: { ...DEFAULT_STATE.metadata, timestamp: new Date().toISOString() } };
    }

    default:
      return state;
  }
}

// ===== HOOK =====

function loadState(): TournamentState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TournamentState;
      initializePlayerIds(parsed.players);
      migrateLeaderNames(parsed);

      // Backfill wins for states saved before the wins field existed
      const needsBackfill = parsed.players.some((p) => p.wins === undefined || p.wins === null);
      if (needsBackfill) {
        // Ensure the field exists on all players before backfilling
        for (const p of parsed.players) {
          p.wins = p.wins ?? 0;
        }
        backfillPlayerWins(parsed);
      }

      // Backfill mode for old states without it
      if (!parsed.mode) {
        parsed.mode = "classic";
      }
      // Backfill phase for old states that don't have "home"
      if (parsed.phase === "registration" && parsed.players.length === 0 && !parsed.mode) {
        parsed.phase = "home";
      }

      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_STATE, metadata: { ...DEFAULT_STATE.metadata, timestamp: new Date().toISOString() } };
}

export function useTournamentState() {
  const [state, dispatch] = useReducer(tournamentReducer, null, loadState);

  // Persist to localStorage on every state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // ===== Action creators =====

  const selectMode = useCallback((mode: TournamentMode) => {
    dispatch({ type: "SELECT_MODE", mode });
  }, []);

  const addPlayer = useCallback((name: string) => {
    dispatch({ type: "ADD_PLAYER", name });
  }, []);

  const removePlayer = useCallback((id: string) => {
    dispatch({ type: "REMOVE_PLAYER", id });
  }, []);

  const setTournamentName = useCallback((name: string) => {
    dispatch({ type: "SET_TOURNAMENT_NAME", name });
  }, []);

  const startTournament = useCallback(() => {
    dispatch({ type: "START_TOURNAMENT" });
  }, []);

  const generateRound = useCallback(() => {
    dispatch({ type: "GENERATE_ROUND" });
  }, []);

  const submitTableResults = useCallback(
    (roundIndex: number, tableId: number, results: TableResult[]) => {
      dispatch({ type: "SUBMIT_TABLE_RESULTS", roundIndex, tableId, results });
    },
    []
  );

  const batchSubmitTableResults = useCallback(
    (roundIndex: number, tables: { tableId: number; results: TableResult[] }[]) => {
      dispatch({ type: "BATCH_SUBMIT_TABLE_RESULTS", roundIndex, tables });
    },
    []
  );

  const startTop8 = useCallback(() => {
    dispatch({ type: "START_TOP8" });
  }, []);

  const generateTop8Round = useCallback(() => {
    dispatch({ type: "GENERATE_TOP8_ROUND" });
  }, []);

  const importState = useCallback((newState: TournamentState) => {
    dispatch({ type: "IMPORT_STATE", state: newState });
  }, []);

  const resetTournament = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const toggleDramaticReveal = useCallback(() => {
    dispatch({ type: "TOGGLE_DRAMATIC_REVEAL" });
  }, []);

  const toggleTestMode = useCallback(() => {
    dispatch({ type: "TOGGLE_TEST_MODE" });
  }, []);

  // ── Colosseum-specific action creators ──

  const setGroupAssignments = useCallback((assignments: Map<string, number>) => {
    dispatch({ type: "SET_GROUP_ASSIGNMENTS", assignments });
  }, []);

  const proceedToQualifying = useCallback(() => {
    dispatch({ type: "PROCEED_TO_QUALIFYING" });
  }, []);

  const startKnockoutDraw = useCallback(() => {
    dispatch({ type: "START_KNOCKOUT_DRAW" });
  }, []);

  const confirmKnockoutDraw = useCallback((tables: string[][]) => {
    dispatch({ type: "CONFIRM_KNOCKOUT_DRAW", tables });
  }, []);

  const standings = state.phase === "finished"
    ? getFinalStandings(state)
    : getStandings(state.players, state.rounds);

  // Export as JSON
  const exportState = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.metadata.tournamentName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  // Generate shareable link for spectators
  const generateShareableLink = useCallback(async (): Promise<string> => {
    // Build standings snapshot
    const currentStandings = state.phase === "finished"
      ? getFinalStandings(state)
      : getStandings(state.players, state.rounds);

    const snapshot: StandingsSnapshot = {
      metadata: {
        tournamentName: state.metadata.tournamentName,
        timestamp: new Date().toISOString(),
        currentRound: state.currentRound,
        totalRounds: state.settings.totalQualifyingRounds,
        phase: state.phase,
      },
      standings: currentStandings.map((player, index) => ({
        rank: index + 1,
        name: player.name,
        points: player.points,
        wins: player.wins,
        totalVP: player.totalVP,
        vpSharePct: getVpSharePct(player.id, state.rounds),
        efficiency: player.efficiency,
      })),
    };

    // If first time sharing, create new JSONBin
    if (!state.metadata.jsonbinId) {
      const binId = await createStandingsBin(
        snapshot,
        state.metadata.tournamentName
      );
      
      // Store JSONBin ID in state
      dispatch({ type: "SET_JSONBIN_INFO", binId, binKey: "" });
      
      // Return shareable URL
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}?view=${binId}`;
    }

    // Update existing JSONBin with new standings
    await updateStandingsBin(
      state.metadata.jsonbinId,
      snapshot
    );

    // Return same shareable URL
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?view=${state.metadata.jsonbinId}`;
  }, [state, dispatch]);

  return {
    state,
    standings,
    selectMode,
    addPlayer,
    removePlayer,
    setTournamentName,
    startTournament,
    generateRound,
    submitTableResults,
    batchSubmitTableResults,
    startTop8,
    generateTop8Round,
    importState,
    exportState,
    resetTournament,
    toggleDramaticReveal,
    toggleTestMode,
    generateShareableLink,
    // Colosseum-specific
    setGroupAssignments,
    proceedToQualifying,
    startKnockoutDraw,
    confirmKnockoutDraw,
  };
}
