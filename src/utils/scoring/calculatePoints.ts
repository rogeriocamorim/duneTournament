import type { RoundResult } from '../../types/player';
import { POINTS_BY_PLACEMENT } from '../constants';

export function calculatePlayerPoints(results: RoundResult[]): number {
  return results.reduce((total, result) => total + result.points, 0);
}

export function calculatePlayerVictoryPoints(results: RoundResult[]): number {
  return results.reduce((total, result) => total + result.victoryPoints, 0);
}

export function countPlacementsByPosition(results: RoundResult[], position: 1 | 2 | 3 | 4): number {
  return results.filter(r => r.placement === position).length;
}

export function getPointsForPlacement(placement: 1 | 2 | 3 | 4): number {
  return POINTS_BY_PLACEMENT[placement];
}
