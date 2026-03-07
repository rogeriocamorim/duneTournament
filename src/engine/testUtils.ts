import type { Table, TableResult } from "./types";
import { LEADERS } from "./types";

// ===== TEST DATA GENERATION =====

/** List of Dune-themed first names for auto-generated players */
const FIRST_NAMES = [
  "Atreides", "Harkonnen", "Corrino", "Fenring", "Ecaz", "Richese",
  "Moritani", "Thorvald", "Vernius", "Tuek", "Halleck", "Idaho",
  "Hawat", "Yueh", "Stilgar", "Chatt", "Jamis", "Harah",
  "Alia", "Irulan", "Wensicia", "Farad", "Shaddam", "Elrood",
  "Mohiam", "Margot", "Scytale", "Bijaz", "Edric", "Tyekanik",
  "Korba", "Lichna", "Otheym", "Javid", "Nayla", "Sheeana",
  "Taraza", "Odrade", "Lucilla", "Bellonda", "Murbella", "Logno",
  "Teg", "Bashar", "Waff", "Turok", "Bene", "Gesserit",
  "Sardaukar", "Fremen",
];

const LAST_NAMES = [
  "Muad'Dib", "Usul", "Lisan al-Gaib", "Kwisatz", "Mahdi", "Shai-Hulud",
  "Coriolis", "Sietch", "Arrakeen", "Carthag", "Giedi", "Caladan",
  "Kaitain", "Wallach", "Rossak", "Chapterhouse", "Tleilax", "Junction",
  "Salusa", "Secundus", "Harmonthep", "Gamont", "Grumman", "Hagal",
  "Lankiveil", "Poritrin", "Richese", "Balut", "Bela", "Tegeuse",
];

/** Generate a unique player name */
function generatePlayerName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[index % LAST_NAMES.length];
  // Add a suffix for uniqueness when we cycle through
  const cycle = Math.floor(index / Math.min(FIRST_NAMES.length, LAST_NAMES.length));
  return cycle > 0 ? `${first} ${last} ${cycle + 1}` : `${first} ${last}`;
}

/** Generate an array of player names for registration auto-fill */
export function generateTestPlayerNames(count: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(generatePlayerName(i));
  }
  return names;
}

/**
 * Generate random results for a single table.
 * Assigns random positions (1..N, unique), random VP (2-12), and random leaders
 * from the available pool if provided.
 */
export function generateRandomTableResults(
  table: Table,
  availableLeaders?: string[],
): TableResult[] {
  const playerCount = table.playerIds.length;

  // Shuffle positions 1..N
  const positions = Array.from({ length: playerCount }, (_, i) => i + 1);
  shuffleArray(positions);

  // Pick random leaders (one per player, no duplicates within the table)
  const leaderPool = availableLeaders ?? LEADERS;
  const shuffledLeaders = [...leaderPool];
  shuffleArray(shuffledLeaders);

  return table.playerIds.map((playerId, i) => ({
    playerId,
    position: positions[i],
    vp: 2 + Math.floor(Math.random() * 11), // 2-12 VP
    leader: shuffledLeaders[i % shuffledLeaders.length],
  }));
}

/** Fisher-Yates shuffle (in place) */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
