import { useState, useCallback, useEffect, useRef } from "react";
import type { TournamentState, TournamentMode, TableResult, TierDef, TournamentFormat } from "../engine/types";
import type { TournamentAction } from "../engine/reducer";
import { tournamentReducer, createInitialState, normalizeLoadedState } from "../engine/reducer";
import { getStandings, getFinalStandings } from "../engine/tournament";
import { buildStandingsSnapshot } from "../engine/snapshot";
import { createStandingsBin, updateStandingsBin } from "../utils/jsonbinService";
import {
  ApiError,
  createTournament,
  getTournament,
  isApiMode,
  postAction,
} from "../api/client";

const STORAGE_KEY = "dune_tournament_state";
const TOURNAMENT_ID_KEY = "dune_tournament_id";

// ===== PERSISTENCE =====

function loadState(): TournamentState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return normalizeLoadedState(JSON.parse(stored) as TournamentState);
    }
  } catch {
    // Ignore parse errors
  }
  return createInitialState();
}

function readStoredTournamentId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("t");
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem(TOURNAMENT_ID_KEY);
  } catch {
    return null;
  }
}

function storeTournamentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(TOURNAMENT_ID_KEY, id);
    else localStorage.removeItem(TOURNAMENT_ID_KEY);
  } catch {
    // Storage unavailable
  }
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("t", id);
  else url.searchParams.delete("t");
  window.history.replaceState(null, "", url.toString());
}

// ===== HOOK =====

/**
 * Tournament state + actions. In API mode (VITE_API_URL set) every action is
 * sent to the server, which runs the same reducer and stores the result in the
 * database. Otherwise the reducer runs locally and state lives in localStorage.
 */
export function useTournamentState() {
  const apiMode = isApiMode();
  const [state, setState] = useState<TournamentState>(() =>
    apiMode ? createInitialState() : loadState()
  );
  const [tournamentId, setTournamentId] = useState<string | null>(() =>
    apiMode ? readStoredTournamentId() : null
  );
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(apiMode && readStoredTournamentId() !== null);

  // Server actions run strictly one after another
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const idRef = useRef(tournamentId);
  useEffect(() => {
    idRef.current = tournamentId;
  }, [tournamentId]);

  // ── Load the selected tournament from the server ──
  useEffect(() => {
    if (!apiMode || !tournamentId) return;
    let cancelled = false;
    setLoading(true);
    getTournament(tournamentId)
      .then((record) => {
        if (cancelled) return;
        setState(normalizeLoadedState(record.state));
        setShareSlug(record.shareSlug);
        setApiError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          // Tournament was deleted — back to the home screen
          setTournamentId(null);
          storeTournamentId(null);
          setState(createInitialState());
        } else {
          setApiError(err instanceof ApiError ? err : new ApiError(0, String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiMode, tournamentId]);

  // ── Local mode: persist to localStorage on every state change ──
  useEffect(() => {
    if (apiMode) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [apiMode, state]);

  const dispatch = useCallback((action: TournamentAction) => {
    if (!apiMode) {
      setState((prev) => tournamentReducer(prev, action));
      return;
    }
    const run = async () => {
      const id = idRef.current;
      if (!id) {
        // No server tournament yet: only UI toggles apply locally
        setState((prev) => tournamentReducer(prev, action));
        return;
      }
      setBusy(true);
      try {
        const record = await postAction(id, action);
        setState(normalizeLoadedState(record.state));
        setShareSlug(record.shareSlug);
        setApiError(null);
      } catch (err) {
        setApiError(err instanceof ApiError ? err : new ApiError(0, String(err)));
      } finally {
        setBusy(false);
      }
    };
    queueRef.current = queueRef.current.then(run, run);
  }, [apiMode]);

  // ── Local mode: auto-sync to JSONBin when rounds change (debounced 2s) ──
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (apiMode) return;
    if (!state.metadata.jsonbinId || state.rounds.length === 0) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      updateStandingsBin(state.metadata.jsonbinId!, buildStandingsSnapshot(state)).catch((err) => {
        console.warn("Auto-sync to JSONBin failed:", err);
      });
    }, 2000);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [apiMode, state.rounds, state.players, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Server tournament selection =====

  const openTournament = useCallback((id: string) => {
    idRef.current = id;
    storeTournamentId(id);
    setTournamentId(id);
  }, []);

  const closeTournament = useCallback(() => {
    idRef.current = null;
    storeTournamentId(null);
    setTournamentId(null);
    setShareSlug(null);
    setState(createInitialState());
  }, []);

  const createFromTemplate = useCallback(async (templateId: string, tierPresetId?: string, name?: string) => {
    if (!apiMode) {
      dispatch({ type: "CREATE_FROM_TEMPLATE", templateId, tierPresetId, name });
      return;
    }
    setBusy(true);
    try {
      const record = await createTournament({ templateId, tierPresetId, name });
      idRef.current = record.id;
      storeTournamentId(record.id);
      setTournamentId(record.id);
      setShareSlug(record.shareSlug);
      setState(normalizeLoadedState(record.state));
      setApiError(null);
    } catch (err) {
      setApiError(err instanceof ApiError ? err : new ApiError(0, String(err)));
    } finally {
      setBusy(false);
    }
  }, [apiMode, dispatch]);

  // ===== Action creators =====

  const selectMode = useCallback((mode: TournamentMode) => {
    void createFromTemplate(mode === "colosseum" ? "colosseum" : mode === "custom" ? "swiss-top8" : "classic");
  }, [createFromTemplate]);

  const updateFormat = useCallback((format: TournamentFormat, tiers: TierDef[]) => {
    dispatch({ type: "UPDATE_FORMAT", format, tiers });
  }, [dispatch]);

  const addPlayer = useCallback((name: string) => {
    dispatch({ type: "ADD_PLAYER", name });
  }, [dispatch]);

  const addPlayers = useCallback((names: string[]) => {
    dispatch({ type: "ADD_PLAYERS", names });
  }, [dispatch]);

  const removePlayer = useCallback((id: string) => {
    dispatch({ type: "REMOVE_PLAYER", id });
  }, [dispatch]);

  const renamePlayer = useCallback((id: string, name: string) => {
    dispatch({ type: "RENAME_PLAYER", id, name });
  }, [dispatch]);

  const dropPlayer = useCallback((id: string) => {
    dispatch({ type: "DROP_PLAYER", id });
  }, [dispatch]);

  const setTournamentName = useCallback((name: string) => {
    dispatch({ type: "SET_TOURNAMENT_NAME", name });
  }, [dispatch]);

  const startTournament = useCallback(() => {
    dispatch({ type: "START_TOURNAMENT" });
  }, [dispatch]);

  const generateRound = useCallback((tables?: string[][]) => {
    dispatch({ type: "GENERATE_ROUND", tables });
  }, [dispatch]);

  const advanceStage = useCallback(() => {
    dispatch({ type: "ADVANCE_STAGE" });
  }, [dispatch]);

  const submitTableResults = useCallback(
    (roundIndex: number, tableId: number, results: TableResult[]) => {
      dispatch({ type: "SUBMIT_TABLE_RESULTS", roundIndex, tableId, results });
    },
    [dispatch]
  );

  const batchSubmitTableResults = useCallback(
    (roundIndex: number, tables: { tableId: number; results: TableResult[] }[]) => {
      dispatch({ type: "BATCH_SUBMIT_TABLE_RESULTS", roundIndex, tables });
    },
    [dispatch]
  );

  const startTop8 = useCallback(() => {
    dispatch({ type: "START_TOP8" });
  }, [dispatch]);

  const generateTop8Round = useCallback(() => {
    dispatch({ type: "GENERATE_TOP8_ROUND" });
  }, [dispatch]);

  const importState = useCallback(async (newState: TournamentState) => {
    if (!apiMode) {
      dispatch({ type: "IMPORT_STATE", state: newState });
      return;
    }
    // API mode: an import becomes a new tournament on the server
    setBusy(true);
    try {
      const record = await createTournament({ state: newState });
      idRef.current = record.id;
      storeTournamentId(record.id);
      setTournamentId(record.id);
      setShareSlug(record.shareSlug);
      setState(normalizeLoadedState(record.state));
      setApiError(null);
    } catch (err) {
      setApiError(err instanceof ApiError ? err : new ApiError(0, String(err)));
    } finally {
      setBusy(false);
    }
  }, [apiMode, dispatch]);

  const resetTournament = useCallback(() => {
    if (apiMode) {
      // Server data is kept; leave it and go back to the tournament list
      closeTournament();
      return;
    }
    dispatch({ type: "RESET" });
  }, [apiMode, closeTournament, dispatch]);

  const toggleDramaticReveal = useCallback(() => {
    dispatch({ type: "TOGGLE_DRAMATIC_REVEAL" });
  }, [dispatch]);

  const toggleTestMode = useCallback(() => {
    dispatch({ type: "TOGGLE_TEST_MODE" });
  }, [dispatch]);

  // ── Colosseum-specific action creators ──

  const setGroupAssignments = useCallback((assignments: Map<string, number>) => {
    dispatch({ type: "SET_GROUP_ASSIGNMENTS", assignments: Object.fromEntries(assignments) });
  }, [dispatch]);

  const proceedToQualifying = useCallback(() => {
    dispatch({ type: "PROCEED_TO_QUALIFYING" });
  }, [dispatch]);

  const startKnockoutDraw = useCallback(() => {
    dispatch({ type: "START_KNOCKOUT_DRAW" });
  }, [dispatch]);

  const confirmKnockoutDraw = useCallback((tables: string[][]) => {
    dispatch({ type: "CONFIRM_KNOCKOUT_DRAW", tables });
  }, [dispatch]);

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
    const baseUrl = window.location.origin + window.location.pathname;

    // API mode: spectators read the live tournament from the server
    if (apiMode && shareSlug) {
      return `${baseUrl}?live=${shareSlug}`;
    }

    const snapshot = buildStandingsSnapshot(state);

    // If we have an existing bin, try to update it first
    if (state.metadata.jsonbinId) {
      try {
        await updateStandingsBin(state.metadata.jsonbinId, snapshot);
        return `${baseUrl}?view=${state.metadata.jsonbinId}`;
      } catch {
        // Bin might be stale/expired — fall through to create a new one
        console.warn("Failed to update existing bin, creating a new one...");
      }
    }

    // Create new JSONBin
    const binId = await createStandingsBin(
      snapshot,
      state.metadata.tournamentName
    );

    // Store JSONBin ID in state
    dispatch({ type: "SET_JSONBIN_INFO", binId, binKey: "" });

    return `${baseUrl}?view=${binId}`;
  }, [apiMode, shareSlug, state, dispatch]);

  return {
    state,
    standings,
    // Server mode
    apiMode,
    tournamentId,
    apiError,
    clearApiError: () => setApiError(null),
    busy,
    loading,
    openTournament,
    closeTournament,
    createFromTemplate,
    // Actions
    selectMode,
    updateFormat,
    addPlayer,
    addPlayers,
    removePlayer,
    renamePlayer,
    dropPlayer,
    setTournamentName,
    startTournament,
    generateRound,
    advanceStage,
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
