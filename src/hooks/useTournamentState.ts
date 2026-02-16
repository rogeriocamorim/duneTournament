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
  getStandings,
  getFinalStandings,
} from "../engine/tournament";

const STORAGE_KEY = "dune_tournament_state";

// ===== ACTIONS =====

type Action =
  | { type: "ADD_PLAYER"; name: string }
  | { type: "REMOVE_PLAYER"; id: string }
  | { type: "SET_TOURNAMENT_NAME"; name: string }
  | { type: "START_TOURNAMENT" }
  | { type: "GENERATE_ROUND" }
  | { type: "SUBMIT_TABLE_RESULTS"; roundIndex: number; tableId: number; results: TableResult[] }
  | { type: "ADVANCE_ROUND" }
  | { type: "START_TOP8" }
  | { type: "GENERATE_TOP8_ROUND" }
  | { type: "IMPORT_STATE"; state: TournamentState }
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
      const newState = structuredClone(state);
      const round = newState.rounds[action.roundIndex];
      if (!round) return state;

      const table = round.tables.find((t) => t.id === action.tableId);
      if (!table) return state;

      table.results = action.results;
      table.isComplete = true;

      // Check if all tables in round are complete
      round.isComplete = round.tables.every((t) => t.isComplete);

      // If round is complete, apply results
      if (round.isComplete) {
        return applyResults(newState, action.roundIndex);
      }

      return newState;
    }

    case "ADVANCE_ROUND": {
      // Check if we've finished qualifying
      const completedQualifying = state.rounds.filter(
        (r) => r.type === "qualifying" && r.isComplete
      ).length;

      if (completedQualifying >= state.settings.totalQualifyingRounds) {
        return { ...state, phase: "top8" };
      }
      return state;
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
        // Generate Winners Final & Losers Final
        const { winners, losers } = generateFinalsRound6(lastRound);
        const newRound: Round = {
          number: state.rounds.length + 1,
          tables: [winners, losers],
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
        // Generate Grand Final
        const winnersTable = lastRound.tables[0];
        const losersTable = lastRound.tables[1];
        const grandFinalTable = generateGrandFinal(winnersTable, losersTable);
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

  const advanceRound = useCallback(() => {
    dispatch({ type: "ADVANCE_ROUND" });
  }, []);

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

  return {
    state,
    standings,
    addPlayer,
    removePlayer,
    setTournamentName,
    startTournament,
    generateRound,
    submitTableResults,
    advanceRound,
    startTop8,
    generateTop8Round,
    importState,
    exportState,
    resetTournament,
  };
}
