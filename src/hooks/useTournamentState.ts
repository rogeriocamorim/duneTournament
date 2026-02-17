import { useReducer, useCallback, useEffect } from "react";
import type { TournamentState, Round, TableResult } from "../engine/types";
import { DEFAULT_STATE } from "../engine/types";
import {
  createPlayer,
  initializePlayerIds,
  generateSwissPairing,
  generateSemifinals,
  generateFinalsRound6,
  generateGrandFinal,
  applyResults,
  revertTableResults,
  applyTableResults,
  getStandings,
  getFinalStandings,
} from "../engine/tournament";
import { createStandingsGist } from "../utils/gistService";
import type { StandingsSnapshot } from "../utils/gistService";
import { createMasterPointer, updateMasterPointer } from "../utils/jsonbinService";

const STORAGE_KEY = "dune_tournament_state";

// ===== ACTIONS =====

type Action =
  | { type: "ADD_PLAYER"; name: string }
  | { type: "REMOVE_PLAYER"; id: string }
  | { type: "SET_TOURNAMENT_NAME"; name: string }
  | { type: "START_TOURNAMENT" }
  | { type: "GENERATE_ROUND" }
  | { type: "SUBMIT_TABLE_RESULTS"; roundIndex: number; tableId: number; results: TableResult[] }
  | { type: "START_TOP8" }
  | { type: "GENERATE_TOP8_ROUND" }
  | { type: "IMPORT_STATE"; state: TournamentState }
  | { type: "TOGGLE_DRAMATIC_REVEAL" }
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
      if (state.players.length < 4) return state;
      return {
        ...state,
        phase: "qualifying",
        currentRound: 0,
      };
    }

    case "GENERATE_ROUND": {
      const tables = generateSwissPairing(state);
      const roundNumber = state.rounds.length + 1;
      const newRound: Round = {
        number: roundNumber,
        tables,
        isComplete: false,
        type: "qualifying",
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

      // If this table was previously complete and scored, revert old scoring first
      const wasRoundComplete = round.isComplete;
      if (table.isComplete && table.results.length > 0 && wasRoundComplete) {
        newState = revertTableResults(newState, action.roundIndex, action.tableId);
        // Re-read table reference after revert (structuredClone in revert)
        const revertedRound = newState.rounds[action.roundIndex];
        const revertedTable = revertedRound.tables.find((t) => t.id === action.tableId);
        if (revertedTable) {
          revertedTable.results = action.results;
          revertedTable.isComplete = true;
        }
        // Re-check round completeness
        revertedRound.isComplete = revertedRound.tables.every((t) => t.isComplete);
        // Apply new scoring for this table
        if (revertedRound.isComplete) {
          newState = applyTableResults(newState, action.roundIndex, action.tableId);
        }
        return newState;
      }

      table.results = action.results;
      table.isComplete = true;

      // Check if all tables in round are complete
      round.isComplete = round.tables.every((t) => t.isComplete);

      // If round is complete, apply results for ALL tables
      if (round.isComplete) {
        return applyResults(newState, action.roundIndex);
      }

      return newState;
    }

    case "START_TOP8": {
      const tables = generateSemifinals(state);
      if (tables.length === 0) return state;

      const newRound: Round = {
        number: state.rounds.length + 1,
        tables,
        isComplete: false,
        type: "semifinal",
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
        // Generate 2 Redemption tables from semifinal results
        const tables = generateFinalsRound6(lastRound);
        const newRound: Round = {
          number: state.rounds.length + 1,
          tables,
          isComplete: false,
          type: "winners-final",
        };
        return {
          ...state,
          rounds: [...state.rounds, newRound],
          currentRound: newRound.number,
        };
      }

      if (lastRound.type === "winners-final") {
        // Generate Grand Final: Elite winners (from semis) + Redemption winners
        const semiRound = state.rounds.find((r) => r.type === "semifinal");
        if (!semiRound) return state;

        const grandFinalTable = generateGrandFinal(semiRound, lastRound);
        const newRound: Round = {
          number: state.rounds.length + 1,
          tables: [grandFinalTable],
          isComplete: false,
          type: "grand-final",
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

  const generateRound = useCallback(() => {
    dispatch({ type: "GENERATE_ROUND" });
  }, []);

  const submitTableResults = useCallback(
    (roundIndex: number, tableId: number, results: TableResult[]) => {
      dispatch({ type: "SUBMIT_TABLE_RESULTS", roundIndex, tableId, results });
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

  const standings = state.phase === "finished"
    ? getFinalStandings(state)
    : getStandings(state.players);

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
      : getStandings(state.players);

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
        totalVP: player.totalVP,
        efficiency: player.efficiency,
      })),
    };

    // Create standings Gist
    const standingsGistId = await createStandingsGist(snapshot);

    // If first time sharing, create master pointer
    if (!state.metadata.jsonbinId || !state.metadata.jsonbinKey) {
      const { binId, masterKey } = await createMasterPointer(
        standingsGistId,
        state.metadata.tournamentName
      );
      
      // Store JSONBin info in state
      dispatch({ type: "SET_JSONBIN_INFO", binId, binKey: masterKey });
      
      // Return shareable URL
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}?view=${binId}`;
    }

    // Update existing master pointer
    await updateMasterPointer(
      state.metadata.jsonbinId,
      state.metadata.jsonbinKey,
      standingsGistId,
      state.metadata.tournamentName
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
    generateRound,
    submitTableResults,
    startTop8,
    generateTop8Round,
    importState,
    exportState,
    resetTournament,
    toggleDramaticReveal,
    generateShareableLink,
  };
}
