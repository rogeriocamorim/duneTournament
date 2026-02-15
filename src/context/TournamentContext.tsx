import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { TournamentState, TournamentAction, Tournament } from '../types/tournament';
import { tournamentReducer, initialState } from './TournamentReducer';
import { loadTournament, clearTournament } from '../utils/storage/localStorage';

interface TournamentContextType {
  state: TournamentState;
  dispatch: React.Dispatch<TournamentAction>;
  createTournament: (name: string, playerNames: string[]) => void;
  startRound: (roundNumber: number) => void;
  completeRound: (roundNumber: number, tables: any[]) => void;
  setStatus: (status: any) => void;
  importTournament: (tournament: Tournament) => void;
  resetTournament: () => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tournamentReducer, initialState);

  // Load tournament from localStorage on mount
  useEffect(() => {
    const savedTournament = loadTournament();
    if (savedTournament) {
      dispatch({ type: 'IMPORT_TOURNAMENT', payload: savedTournament });
    }
  }, []);

  const createTournament = (name: string, playerNames: string[]) => {
    dispatch({ type: 'CREATE_TOURNAMENT', payload: { name, playerNames } });
  };

  const startRound = (roundNumber: number) => {
    dispatch({ type: 'START_ROUND', payload: { roundNumber } });
  };

  const completeRound = (roundNumber: number, tables: any[]) => {
    dispatch({ type: 'COMPLETE_ROUND', payload: { roundNumber, tables } });
  };

  const setStatus = (status: any) => {
    dispatch({ type: 'SET_STATUS', payload: status });
  };

  const importTournament = (tournament: Tournament) => {
    dispatch({ type: 'IMPORT_TOURNAMENT', payload: tournament });
  };

  const resetTournament = () => {
    clearTournament();
    dispatch({ type: 'RESET_TOURNAMENT' });
  };

  return (
    <TournamentContext.Provider
      value={{
        state,
        dispatch,
        createTournament,
        startRound,
        completeRound,
        setStatus,
        importTournament,
        resetTournament,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within TournamentProvider');
  }
  return context;
}
