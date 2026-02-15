import type { Tournament } from '../../types/tournament';

export function exportTournamentToJson(tournament: Tournament): void {
  try {
    // Convert Sets to Arrays for JSON
    const serializable = {
      ...tournament,
      players: tournament.players.map(p => ({
        ...p,
        opponentIds: Array.from(p.opponentIds),
      })),
    };
    
    const json = JSON.stringify(serializable, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `dune-tournament-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export tournament:', error);
    throw new Error('Failed to export tournament data');
  }
}

export function importTournamentFromJson(file: File): Promise<Tournament> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const parsed = JSON.parse(json);
        
        // Validate basic structure
        if (!parsed.id || !parsed.players || !Array.isArray(parsed.players)) {
          throw new Error('Invalid tournament file format');
        }
        
        // Convert Arrays back to Sets
        const tournament: Tournament = {
          ...parsed,
          players: parsed.players.map((p: any) => ({
            ...p,
            opponentIds: new Set(p.opponentIds || []),
          })),
        };
        
        resolve(tournament);
      } catch (error) {
        reject(new Error('Failed to parse tournament file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read tournament file'));
    };
    
    reader.readAsText(file);
  });
}
