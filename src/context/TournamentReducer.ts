import type { Tournament, TournamentState, TournamentAction } from '../types/tournament';
import type { Player, RoundResult } from '../types/player';
import type { Round, TableResult } from '../types/round';
import { MAX_ROUNDS } from '../utils/constants';
import { getPointsForPlacement } from '../utils/scoring/calculatePoints';
import { generatePairings } from '../utils/pairing/pairingAlgorithm';
import { saveTournament } from '../utils/storage/localStorage';

export const initialState: TournamentState = {
  tournament: null,
  loading: false,
  error: null,
};

export function tournamentReducer(
  state: TournamentState,
  action: TournamentAction
): TournamentState {
  switch (action.type) {
    case 'CREATE_TOURNAMENT': {
      const { name, playerNames } = action.payload;
      
      const players: Player[] = playerNames.map((playerName, index) => ({
        id: `player-${index + 1}`,
        name: playerName,
        totalPoints: 0,
        totalVictoryPoints: 0,
        firstPlaces: 0,
        secondPlaces: 0,
        thirdPlaces: 0,
        fourthPlaces: 0,
        roundResults: [],
        opponentIds: new Set<string>(),
      }));

      const tournament: Tournament = {
        id: `tournament-${Date.now()}`,
        name,
        players,
        rounds: [],
        currentRound: 0,
        maxRounds: MAX_ROUNDS,
        status: 'setup',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveTournament(tournament);
      
      return {
        ...state,
        tournament,
        error: null,
      };
    }

    case 'START_ROUND': {
      if (!state.tournament) return state;

      const { roundNumber } = action.payload;
      const pairingResult = generatePairings(state.tournament.players, roundNumber);

      if (!pairingResult.success) {
        return {
          ...state,
          error: pairingResult.error || 'Failed to generate pairings',
        };
      }

      const newRound: Round = {
        roundNumber,
        tables: pairingResult.tables,
        completed: false,
        startedAt: new Date().toISOString(),
      };

      const updatedTournament: Tournament = {
        ...state.tournament,
        rounds: [...state.tournament.rounds, newRound],
        currentRound: roundNumber,
        status: 'in-progress',
        updatedAt: new Date().toISOString(),
      };

      saveTournament(updatedTournament);

      return {
        ...state,
        tournament: updatedTournament,
        error: null,
      };
    }

    case 'COMPLETE_ROUND': {
      if (!state.tournament) return state;

      const { roundNumber, tables } = action.payload;
      const roundIndex = state.tournament.rounds.findIndex(r => r.roundNumber === roundNumber);
      
      if (roundIndex === -1) return state;

      // Update player stats based on results
      const updatedPlayers = state.tournament.players.map(player => {
        const playerTable = tables.find(table => 
          table.results?.some((r: TableResult) => r.playerId === player.id)
        );

        if (!playerTable || !playerTable.results) return player;

        const result = playerTable.results.find((r: TableResult) => r.playerId === player.id);
        if (!result) return player;

        const points = getPointsForPlacement(result.placement);
        
        // Get opponent IDs from this table
        const opponentIds = playerTable.playerIds.filter((id: string) => id !== player.id);
        
        const roundResult: RoundResult = {
          roundNumber,
          tableNumber: playerTable.tableNumber,
          placement: result.placement,
          points,
          victoryPoints: result.victoryPoints,
          opponentIds,
        };

        const newOpponentIds = new Set(player.opponentIds);
        opponentIds.forEach((id: string) => newOpponentIds.add(id));

        return {
          ...player,
          totalPoints: player.totalPoints + points,
          totalVictoryPoints: player.totalVictoryPoints + result.victoryPoints,
          firstPlaces: player.firstPlaces + (result.placement === 1 ? 1 : 0),
          secondPlaces: player.secondPlaces + (result.placement === 2 ? 1 : 0),
          thirdPlaces: player.thirdPlaces + (result.placement === 3 ? 1 : 0),
          fourthPlaces: player.fourthPlaces + (result.placement === 4 ? 1 : 0),
          roundResults: [...player.roundResults, roundResult],
          opponentIds: newOpponentIds,
        };
      });

      // Mark round as completed
      const updatedRounds = [...state.tournament.rounds];
      updatedRounds[roundIndex] = {
        ...updatedRounds[roundIndex],
        tables: tables,
        completed: true,
        completedAt: new Date().toISOString(),
      };

      const isFinished = roundNumber === MAX_ROUNDS;

      const updatedTournament: Tournament = {
        ...state.tournament,
        players: updatedPlayers,
        rounds: updatedRounds,
        status: isFinished ? 'finished' : 'round-complete',
        updatedAt: new Date().toISOString(),
      };

      saveTournament(updatedTournament);

      return {
        ...state,
        tournament: updatedTournament,
        error: null,
      };
    }

    case 'SET_STATUS': {
      if (!state.tournament) return state;

      const updatedTournament: Tournament = {
        ...state.tournament,
        status: action.payload,
        updatedAt: new Date().toISOString(),
      };

      saveTournament(updatedTournament);

      return {
        ...state,
        tournament: updatedTournament,
      };
    }

    case 'IMPORT_TOURNAMENT': {
      const tournament = action.payload;
      saveTournament(tournament);
      
      return {
        ...state,
        tournament,
        error: null,
      };
    }

    case 'RESET_TOURNAMENT': {
      return initialState;
    }

    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload,
      };
    }

    case 'CLEAR_ERROR': {
      return {
        ...state,
        error: null,
      };
    }

    default:
      return state;
  }
}
