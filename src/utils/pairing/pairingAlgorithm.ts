import type { Player } from '../../types/player';
import type { Table } from '../../types/round';
import { sortPlayersByStandings } from '../scoring/calculateStandings';

export interface PairingResult {
  success: boolean;
  tables: Table[];
  error?: string;
}

export function generatePairings(
  players: Player[],
  roundNumber: number
): PairingResult {
  if (roundNumber === 1) {
    return generateRound1Pairings(players);
  }
  
  return generateSwissPairings(players, roundNumber);
}

function generateRound1Pairings(players: Player[]): PairingResult {
  // Simple random shuffle and group by 4
  const shuffled = shuffleArray([...players]);
  const tables: Table[] = [];
  
  for (let i = 0; i < shuffled.length; i += 4) {
    tables.push({
      tableNumber: Math.floor(i / 4) + 1,
      playerIds: shuffled.slice(i, i + 4).map(p => p.id),
    });
  }
  
  return { success: true, tables };
}

function generateSwissPairings(
  players: Player[],
  _roundNumber: number
): PairingResult {
  // Sort by standings (points, VP, 1st places)
  const sorted = sortPlayersByStandings(players);
  
  const tables: Table[] = [];
  const assigned = new Set<string>();
  
  let tableNumber = 1;
  
  // Try to create tables with backtracking
  while (assigned.size < sorted.length) {
    const remainingPlayers = sorted.filter(p => !assigned.has(p.id));
    
    if (remainingPlayers.length < 4) {
      return {
        success: false,
        tables: [],
        error: 'Unable to create valid pairings (insufficient players)'
      };
    }
    
    // Look at next 8 players for flexibility in pairing
    const candidates = remainingPlayers.slice(0, Math.min(8, remainingPlayers.length));
    const tablePlayerIds = findValidTable(candidates, assigned);
    
    if (!tablePlayerIds) {
      return {
        success: false,
        tables: [],
        error: 'Could not generate valid pairings without repeats. This is rare but can happen.'
      };
    }
    
    tables.push({
      tableNumber: tableNumber++,
      playerIds: tablePlayerIds,
    });
    
    tablePlayerIds.forEach(id => assigned.add(id));
  }
  
  return { success: true, tables };
}

function findValidTable(
  candidates: Player[],
  alreadyAssigned: Set<string>
): string[] | null {
  const result: string[] = [];
  
  function backtrack(index: number): boolean {
    if (result.length === 4) return true;
    if (index >= candidates.length) return false;
    
    const player = candidates[index];
    
    // Skip if already assigned in this round
    if (alreadyAssigned.has(player.id)) {
      return backtrack(index + 1);
    }
    
    // Check if this player has faced anyone currently in result
    const hasConflict = result.some(id => player.opponentIds.has(id));
    
    if (!hasConflict) {
      result.push(player.id);
      if (backtrack(index + 1)) return true;
      result.pop();
    }
    
    return backtrack(index + 1);
  }
  
  return backtrack(0) ? result : null;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
