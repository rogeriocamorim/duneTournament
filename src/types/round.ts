export interface Round {
  roundNumber: number;
  tables: Table[];
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface Table {
  tableNumber: number;
  playerIds: string[];
  results?: TableResult[];
}

export interface TableResult {
  playerId: string;
  placement: 1 | 2 | 3 | 4;
  victoryPoints: number;
}
