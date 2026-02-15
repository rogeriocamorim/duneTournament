export function isValidPlayerCount(count: number): boolean {
  return count >= 8 && count % 4 === 0;
}

export function validatePlayerNames(names: string[]): { valid: boolean; error?: string } {
  if (names.length === 0) {
    return { valid: false, error: 'At least one player is required' };
  }

  if (!isValidPlayerCount(names.length)) {
    return { 
      valid: false, 
      error: `Player count must be a multiple of 4 and at least 8. You have ${names.length} players.` 
    };
  }

  const uniqueNames = new Set(names.map(n => n.trim().toLowerCase()));
  if (uniqueNames.size !== names.length) {
    return { valid: false, error: 'All player names must be unique' };
  }

  const emptyNames = names.filter(n => n.trim() === '');
  if (emptyNames.length > 0) {
    return { valid: false, error: 'Player names cannot be empty' };
  }

  return { valid: true };
}

export function validateTableResults(results: any[]): { valid: boolean; error?: string } {
  if (results.length !== 4) {
    return { valid: false, error: 'Each table must have exactly 4 results' };
  }

  const placements = results.map(r => r.placement);
  const uniquePlacements = new Set(placements);
  
  if (uniquePlacements.size !== 4) {
    return { valid: false, error: 'All placements must be unique (1st, 2nd, 3rd, 4th)' };
  }

  if (!placements.includes(1) || !placements.includes(2) || 
      !placements.includes(3) || !placements.includes(4)) {
    return { valid: false, error: 'Must have one player in each position (1-4)' };
  }

  for (const result of results) {
    if (result.victoryPoints < 0) {
      return { valid: false, error: 'Victory points cannot be negative' };
    }
  }

  return { valid: true };
}
