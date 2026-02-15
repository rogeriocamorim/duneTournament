import type { Player, PlayerStanding } from '../../types/player';

export function calculateStandings(players: Player[]): PlayerStanding[] {
  // Sort players by: 1) Total points, 2) Total VP, 3) Number of 1st places
  const sorted = [...players].sort((a, b) => {
    // Primary: Total points (descending)
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    
    // Secondary: Total victory points (descending)
    if (b.totalVictoryPoints !== a.totalVictoryPoints) {
      return b.totalVictoryPoints - a.totalVictoryPoints;
    }
    
    // Tertiary: Number of 1st places (descending)
    if (b.firstPlaces !== a.firstPlaces) {
      return b.firstPlaces - a.firstPlaces;
    }
    
    // If still tied, maintain alphabetical order
    return a.name.localeCompare(b.name);
  });

  // Assign ranks and detect ties
  const standings: PlayerStanding[] = [];
  let currentRank = 1;
  
  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i];
    const prevPlayer = i > 0 ? sorted[i - 1] : null;
    
    // Check if tied with previous player
    const isTied = prevPlayer !== null &&
      player.totalPoints === prevPlayer.totalPoints &&
      player.totalVictoryPoints === prevPlayer.totalVictoryPoints &&
      player.firstPlaces === prevPlayer.firstPlaces;
    
    if (!isTied && i > 0) {
      currentRank = i + 1;
    }
    
    standings.push({
      player,
      rank: currentRank,
      tied: isTied || (i < sorted.length - 1 && isNextPlayerTied(player, sorted[i + 1])),
    });
  }

  return standings;
}

function isNextPlayerTied(current: Player, next: Player): boolean {
  return current.totalPoints === next.totalPoints &&
    current.totalVictoryPoints === next.totalVictoryPoints &&
    current.firstPlaces === next.firstPlaces;
}

export function sortPlayersByStandings(players: Player[]): Player[] {
  return calculateStandings(players).map(s => s.player);
}
