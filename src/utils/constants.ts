export const POINTS_BY_PLACEMENT = {
  1: 5,
  2: 3,
  3: 2,
  4: 1,
} as const;

export const MAX_ROUNDS = 4;
export const PLAYERS_PER_TABLE = 4;

export const VALID_PLAYER_COUNTS = [8, 16, 20, 24, 28, 32];

export const DUNE_QUOTES = [
  "The spice must flow...",
  "Fear is the mind-killer",
  "He who controls the spice controls the universe",
  "The mystery of life isn't a problem to solve, but a reality to experience",
  "Without change, something sleeps inside us",
  "Deep in the human unconscious is a pervasive need for a logical universe that makes sense",
];

export const ANIMATION_DURATIONS = {
  tableFadeIn: 500,
  playerNameReveal: 300,
  tableDelay: 2000,
  pageTransition: 400,
} as const;
