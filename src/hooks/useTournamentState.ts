import { useReducer, useCallback, useEffect } from "react";
import type { TournamentState, Round, TableResult } from "../engine/types";
import { DEFAULT_STATE } from "../engine/types";
import {
  createPlayer,
  initializePlayerIds,
  generateSwissPairing,
  assignGroups,
  revertTableResults,
  applyTableResults,
  getStandings,
  getFinalStandings,
  getTierForRound,
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
  | { type: "ADD_PLAYER"; name: string }
  | { type: "REMOVE_PLAYER"; id: string }
  | { type: "SET_TOURNAMENT_NAME"; name: string }
  | { type: "START_TOURNAMENT" }
  | { type: "PROCEED_TO_QUALIFYING" }
  | { type: "SET_GROUP_ASSIGNMENTS"; assignments: Map<string, number> }
  | { type: "GENERATE_ROUND" }
  | { type: "SUBMIT_TABLE_RESULTS"; roundIndex: number; tableId: number; results: TableResult[] }
  | { type: "BATCH_SUBMIT_TABLE_RESULTS"; roundIndex: number; tables: { tableId: number; results: TableResult[] }[] }
  | { type: "START_TOP8" }
  | { type: "START_KNOCKOUT_DRAW" }
  | { type: "CONFIRM_KNOCKOUT_DRAW"; sf1aIds: string[]; sf1bIds: string[]; elimAIds: string[]; elimBIds: string[] }
  | { type: "GENERATE_TOP8_ROUND" }
  | { type: "IMPORT_STATE"; state: TournamentState }
  | { type: "TOGGLE_DRAMATIC_REVEAL" }
  | { type: "TOGGLE_TEST_MODE" }
  | { type: "SET_JSONBIN_INFO"; binId: string; binKey: string }
  | { type: "RESET" };

// ===== REDUCER =====

function tournamentReducer(state: TournamentState, action: Action): TournamentState {
  switch (action.type) {
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
      if (state.players.length < 8 || state.players.length % 8 !== 0) return state;
      const groupedPlayers = assignGroups(state.players);
      return {
        ...state,
        players: groupedPlayers,
        phase: "group-draw",
        currentRound: 0,
      };
    }

    case "SET_GROUP_ASSIGNMENTS": {
      // Apply manual group assignments from spinner wheel
      const updatedPlayers = state.players.map((p) => ({
        ...p,
        groupId: action.assignments.get(p.id) ?? p.groupId ?? 0,
      }));
      // Generate all 4 rounds with the new assignments
      let newState = { ...state, players: updatedPlayers, phase: "qualifying" as const };
      for (let i = 0; i < state.settings.totalQualifyingRounds; i++) {
        const tables = generateSwissPairing({ ...newState, currentRound: i });
        const roundNumber = i + 1;
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
        newState = { ...newState, rounds: [...newState.rounds, newRound], currentRound: roundNumber };
      }
      return newState;
    }

    case "PROCEED_TO_QUALIFYING": {
      // Pre-generate all 4 rounds so players can enter results in any order
      let newState = { ...state, phase: "qualifying" as const };
      for (let i = 0; i < state.settings.totalQualifyingRounds; i++) {
        const tables = generateSwissPairing({ ...newState, currentRound: i });
        const roundNumber = i + 1;
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
        newState = { ...newState, rounds: [...newState.rounds, newRound], currentRound: roundNumber };
      }
      return newState;
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

      // If table was previously complete, revert its scoring first
      if (table.isComplete && table.results.length > 0) {
        newState = revertTableResults(newState, action.roundIndex, action.tableId);
      }

      // Set new results
      const updatedTable = newState.rounds[action.roundIndex].tables.find((t) => t.id === action.tableId)!;
      updatedTable.results = action.results;
      updatedTable.isComplete = true;

      // Apply scoring for this table immediately
      newState = applyTableResults(newState, action.roundIndex, action.tableId);

      // Update round completeness
      newState.rounds[action.roundIndex].isComplete =
        newState.rounds[action.roundIndex].tables.every((t) => t.isComplete);

      return newState;
    }

    case "BATCH_SUBMIT_TABLE_RESULTS": {
      let newState = structuredClone(state);
      const batchRound = newState.rounds[action.roundIndex];
      if (!batchRound) return state;

      for (const { tableId, results } of action.tables) {
        // Revert if previously complete
        const existingTable = newState.rounds[action.roundIndex].tables.find((t) => t.id === tableId);
        if (existingTable?.isComplete && existingTable.results.length > 0) {
          newState = revertTableResults(newState, action.roundIndex, tableId);
        }
        const t = newState.rounds[action.roundIndex].tables.find((t) => t.id === tableId);
        if (!t) continue;
        t.results = results;
        t.isComplete = true;
        newState = applyTableResults(newState, action.roundIndex, tableId);
      }

      newState.rounds[action.roundIndex].isComplete =
        newState.rounds[action.roundIndex].tables.every((t) => t.isComplete);

      return newState;
    }

    case "START_KNOCKOUT_DRAW": {
      return { ...state, phase: "knockout-draw" as const };
    }

    case "CONFIRM_KNOCKOUT_DRAW": {
      // SF1 A + SF1 B: group winners (A tier)
      // Elim A + Elim B: runner-ups (A tier)
      const aLeaders = selectRoundLeaders("A");
      const knockoutRound: Round = {
        number: state.rounds.length + 1,
        tables: [
          { id: 1, playerIds: action.sf1aIds, results: [], isComplete: false },
          { id: 2, playerIds: action.sf1bIds, results: [], isComplete: false },
          { id: 3, playerIds: action.elimAIds, results: [], isComplete: false },
          { id: 4, playerIds: action.elimBIds, results: [], isComplete: false },
        ],
        isComplete: false,
        type: "semifinal",
        availableLeaders: aLeaders.map((l) => l.name),
        leaderTier: "A",
      };
      return {
        ...state,
        rounds: [...state.rounds, knockoutRound],
        currentRound: knockoutRound.number,
        phase: "top8",
      };
    }

    case "START_TOP8": {
      // Legacy fallback — goes straight to knockout-draw instead
      return { ...state, phase: "knockout-draw" as const };
    }

    case "GENERATE_TOP8_ROUND": {
      const lastRound = state.rounds[state.rounds.length - 1];
      if (!lastRound || !lastRound.isComplete) return state;

      if (lastRound.type === "semifinal") {
        // SF1A = table 0, SF1B = table 1, ElimA = table 2, ElimB = table 3
        const [sf1aTable, sf1bTable, elimATable, elimBTable] = lastRound.tables;

        const getWinner = (t: typeof sf1aTable) =>
          [...t.results].sort((a, b) => a.position - b.position)[0]?.playerId;
        const getLosers = (t: typeof sf1aTable) =>
          [...t.results].sort((a, b) => a.position - b.position).slice(1).map(r => r.playerId);

        const sf1aLosers = getLosers(sf1aTable);
        const sf1bLosers = getLosers(sf1bTable);
        const elimAWinner = getWinner(elimATable);
        const elimBWinner = getWinner(elimBTable);

        // 8 players for SF2: 3+3 losers + 2 elim winners, randomly split into 2 tables of 4
        const pool = [...sf1aLosers, ...sf1bLosers, elimAWinner, elimBWinner].filter(Boolean) as string[];
        const shuffledPool = [...pool];
        for (let i = shuffledPool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]];
        }

        const bLeaders = selectRoundLeaders("B");
        const sf2Round: Round = {
          number: state.rounds.length + 1,
          tables: [
            { id: 1, playerIds: shuffledPool.slice(0, 4), results: [], isComplete: false },
            { id: 2, playerIds: shuffledPool.slice(4, 8), results: [], isComplete: false },
          ],
          isComplete: false,
          type: "winners-final",
          availableLeaders: bLeaders.map((l) => l.name),
          leaderTier: "B",
        };
        return { ...state, rounds: [...state.rounds, sf2Round], currentRound: sf2Round.number };
      }

      if (lastRound.type === "winners-final") {
        // SF2A = table 0, SF2B = table 1
        const sf2aWinner = [...lastRound.tables[0].results].sort((a, b) => a.position - b.position)[0]?.playerId;
        const sf2bWinner = [...lastRound.tables[1].results].sort((a, b) => a.position - b.position)[0]?.playerId;

        // SF1 winners from the semifinal round
        const sfRound = state.rounds.find((r) => r.type === "semifinal");
        const sf1aWinner = sfRound ? [...sfRound.tables[0].results].sort((a, b) => a.position - b.position)[0]?.playerId : undefined;
        const sf1bWinner = sfRound ? [...sfRound.tables[1].results].sort((a, b) => a.position - b.position)[0]?.playerId : undefined;

        const finalPlayers = [sf1aWinner, sf1bWinner, sf2aWinner, sf2bWinner].filter(Boolean) as string[];

        const cLeaders = selectRoundLeaders("C");
        const finalRound: Round = {
          number: state.rounds.length + 1,
          tables: [{ id: 1, playerIds: finalPlayers, results: [], isComplete: false }],
          isComplete: false,
          type: "grand-final",
          availableLeaders: cLeaders.map((l) => l.name),
          leaderTier: "C",
        };
        return { ...state, rounds: [...state.rounds, finalRound], currentRound: finalRound.number };
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

  const proceedToQualifying = useCallback(() => {
    dispatch({ type: "PROCEED_TO_QUALIFYING" });
  }, []);

  const setGroupAssignments = useCallback((assignments: Map<string, number>) => {
    dispatch({ type: "SET_GROUP_ASSIGNMENTS", assignments });
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
    dispatch({ type: "START_KNOCKOUT_DRAW" });
  }, []);

  const confirmKnockoutDraw = useCallback((sf1aIds: string[], sf1bIds: string[], elimAIds: string[], elimBIds: string[]) => {
    dispatch({ type: "CONFIRM_KNOCKOUT_DRAW", sf1aIds, sf1bIds, elimAIds, elimBIds });
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
    addPlayer,
    removePlayer,
    setTournamentName,
    startTournament,
    proceedToQualifying,
    setGroupAssignments,
    generateRound,
    submitTableResults,
    batchSubmitTableResults,
    startTop8,
    confirmKnockoutDraw,
    generateTop8Round,
    importState,
    exportState,
    resetTournament,
    toggleDramaticReveal,
    toggleTestMode,
    generateShareableLink,
  };
}
