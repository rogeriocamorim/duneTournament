import type { Player, Round, TierDef, TournamentFormat, TournamentMode, TournamentState } from "./types";
import { getFinalStandings, getStandings, getVpSharePct } from "./tournament";
import { getPenaltyTotal } from "./format";

// ===== SPECTATOR SNAPSHOT =====

export interface StandingsSnapshot {
  metadata: {
    tournamentName: string;
    timestamp: string;
    currentRound: number;
    totalRounds: number;
    phase: string;
    mode?: TournamentMode;
  };
  standings: {
    rank: number;
    name: string;
    points: number;
    wins: number;
    totalVP: number;
    vpSharePct: number;
    efficiency: number;
    penaltyPoints?: number;
  }[];
  /** Full round data — enables tables, leader stats, seats in spectator view */
  rounds?: Round[];
  /** Full player data — enables group standings in spectator view */
  players?: Player[];
  /** Tournament tiers (for tier colors and leader pools) */
  tiers?: TierDef[];
  /** Tournament format (stage names, clock) */
  format?: TournamentFormat;
}

/** Read-only view of a tournament for spectators */
export function buildStandingsSnapshot(state: TournamentState): StandingsSnapshot {
  const standings = state.phase === "finished"
    ? getFinalStandings(state)
    : getStandings(state.players, state.rounds);

  const totalRounds = state.mode === "custom" && state.format
    ? state.format.stages.reduce((sum, s) => sum + s.rounds, 0)
    : state.settings.totalQualifyingRounds;

  return {
    metadata: {
      tournamentName: state.metadata.tournamentName,
      timestamp: state.metadata.timestamp || new Date().toISOString(),
      currentRound: state.currentRound,
      totalRounds,
      phase: state.phase,
      mode: state.mode,
    },
    standings: standings.map((player, index) => ({
      rank: index + 1,
      name: player.name,
      points: player.points,
      wins: player.wins,
      totalVP: player.totalVP,
      vpSharePct: getVpSharePct(player.id, state.rounds),
      efficiency: player.efficiency,
      penaltyPoints: getPenaltyTotal(player.id, state.rounds),
    })),
    rounds: state.rounds,
    players: state.players,
    tiers: state.tiers,
    format: state.format,
  };
}
