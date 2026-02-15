import type { Tournament } from '../../types/tournament';

const STORAGE_KEY = 'dune-tournament';

export function saveTournament(tournament: Tournament): void {
  try {
    // Convert Sets to Arrays for JSON serialization
    const serializable = {
      ...tournament,
      players: tournament.players.map(p => ({
        ...p,
        opponentIds: Array.from(p.opponentIds),
      })),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.error('Failed to save tournament to localStorage:', error);
  }
}

export function loadTournament(): Tournament | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    
    // Convert Arrays back to Sets
    return {
      ...parsed,
      players: parsed.players.map((p: any) => ({
        ...p,
        opponentIds: new Set(p.opponentIds || []),
      })),
    };
  } catch (error) {
    console.error('Failed to load tournament from localStorage:', error);
    return null;
  }
}

export function clearTournament(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear tournament from localStorage:', error);
  }
}

export function hasSavedTournament(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
