export interface Player {
  id: string;
  name: string;
  totalPoints: number;
  totalVictoryPoints: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  fourthPlaces: number;
  roundResults: RoundResult[];
  opponentIds: Set<string>;
}

export interface RoundResult {
  roundNumber: number;
  tableNumber: number;
  placement: 1 | 2 | 3 | 4;
  points: number;
  victoryPoints: number;
  opponentIds: string[];
}

export interface PlayerStanding {
  player: Player;
  rank: number;
  tied: boolean;
}
