import type { Player } from './player';
import type { Round } from './round';

export interface Tournament {
  id: string;
  name: string;
  players: Player[];
  rounds: Round[];
  currentRound: number;
  maxRounds: number;
  status: TournamentStatus;
  createdAt: string;
  updatedAt: string;
}

export type TournamentStatus = 
  | 'setup' 
  | 'draft' 
  | 'in-progress' 
  | 'round-complete' 
  | 'finished';

export interface TournamentState {
  tournament: Tournament | null;
  loading: boolean;
  error: string | null;
}

export type TournamentAction =
  | { type: 'CREATE_TOURNAMENT'; payload: { name: string; playerNames: string[] } }
  | { type: 'START_ROUND'; payload: { roundNumber: number } }
  | { type: 'COMPLETE_ROUND'; payload: { roundNumber: number; tables: any[] } }
  | { type: 'SET_STATUS'; payload: TournamentStatus }
  | { type: 'UPDATE_STANDINGS' }
  | { type: 'IMPORT_TOURNAMENT'; payload: Tournament }
  | { type: 'RESET_TOURNAMENT' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };
