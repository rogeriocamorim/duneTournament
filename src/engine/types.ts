// ===== CORE TYPES =====

export interface Player {
  id: string;
  name: string;
  points: number;
  totalVP: number;
  efficiency: number; // lower = better (sum of game round finishes)
  opponents: string[]; // ids of players already faced
}

export interface TableResult {
  playerId: string;
  position: number; // 1-4
  vp: number;
  leader?: string; // leader picked for this game
}

export interface Table {
  id: number;
  playerIds: string[];
  results: TableResult[];
  isComplete: boolean;
}

export interface Round {
  number: number;
  tables: Table[];
  isComplete: boolean;
  type: "qualifying" | "semifinal" | "winners-final" | "losers-final" | "grand-final";
}

export interface TournamentState {
  metadata: {
    version: string;
    timestamp: string;
    tournamentName: string;
  };
  players: Player[];
  rounds: Round[];
  phase: "registration" | "qualifying" | "top8" | "finished";
  currentRound: number;
  settings: {
    totalQualifyingRounds: number;
    topCut: number;
    dramaticReveal: boolean;
  };
}

export const POINTS_MAP: Record<number, number> = {
  1: 5,
  2: 3,
  3: 2,
  4: 1,
};

export const DEFAULT_STATE: TournamentState = {
  metadata: {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    tournamentName: "Dune Bloodlines Open",
  },
  players: [],
  rounds: [],
  phase: "registration",
  currentRound: 0,
  settings: {
    totalQualifyingRounds: 4,
    topCut: 16,
    dramaticReveal: false,
  },
};

// ===== LEADERS (Base + Ix + Uprising + Bloodlines) =====

export type LeaderTier = "A" | "B" | "C" | "none";

export interface LeaderInfo {
  id: string;
  name: string;
  tier: LeaderTier;
  expansion: "base" | "ix" | "uprising" | "bloodlines";
}

export const LEADER_LIST: LeaderInfo[] = [
  // ── Base Game ──
  { id: "paulAtreides",      name: "Paul Atreides",                  tier: "none", expansion: "base" },
  { id: "letoAtreides",      name: "Duke Leto Atreides",             tier: "B",    expansion: "base" },
  { id: "memnonThorvald",    name: "Earl Memnon Thorvald",           tier: "none", expansion: "base" },
  { id: "glossuRabban",      name: 'Glossu "The Beast" Rabban',      tier: "A",    expansion: "base" },
  { id: "vladimirHarkonnen", name: "Baron Vladimir Harkonnen",       tier: "B",    expansion: "base" },
  { id: "helenaRichese",     name: "Helena Richese",                 tier: "none", expansion: "base" },
  { id: "arianaThorvald",    name: "Countess Ariana Thorvald",       tier: "none", expansion: "base" },
  { id: "ilbanRichese",      name: "Count Ilban Richese",            tier: "none", expansion: "base" },
  { id: "armandEcaz",        name: "Archduke Armand Ecaz",           tier: "B",    expansion: "base" },
  // ── Ix Expansion ──
  { id: "tessiaVernius",     name: "Tessia Vernius",                 tier: "A",    expansion: "ix" },
  { id: "ilesaEcaz_com",     name: "Ilesa Ecaz (Community)",         tier: "A",    expansion: "ix" },
  // ── Uprising Expansion ──
  { id: "stabanTuek",        name: "Staban Tuek",                    tier: "A",    expansion: "uprising" },
  { id: "amberMetulli",      name: "Lady Amber Metulli",             tier: "B",    expansion: "uprising" },
  { id: "gurneyHalleck",     name: "Gurney Halleck",                 tier: "B",    expansion: "uprising" },
  { id: "margotFenring",     name: "Lady Margot Fenring",            tier: "C",    expansion: "uprising" },
  { id: "irulanCorrino",     name: "Princess Irulan",                tier: "B",    expansion: "uprising" },
  { id: "jessica",           name: "Lady Jessica",                   tier: "C",    expansion: "uprising" },
  { id: "feydRauthaHarkonnen", name: "Feyd-Rautha Harkonnen",        tier: "C",    expansion: "uprising" },
  { id: "shaddamCorrino",    name: "Shaddam IV",                     tier: "C",    expansion: "uprising" },
  { id: "muadDib",           name: "Muad'Dib",                       tier: "C",    expansion: "uprising" },
  { id: "yunaMoritani",      name: "Princess Yuna Moritani",         tier: "B",    expansion: "uprising" },
  // ── Bloodlines Expansion ──
  { id: "bl_Chani",          name: "Chani",                          tier: "C",    expansion: "bloodlines" },
  { id: "bl_Duncan",         name: "Duncan Idaho",                   tier: "C",    expansion: "bloodlines" },
  { id: "bl_Esmar",          name: "Esmar Tuek",                     tier: "A",    expansion: "bloodlines" },
  { id: "bl_Hasimir",        name: "Count Hasimir Fenring",          tier: "A",    expansion: "bloodlines" },
  { id: "bl_Kota",           name: "Kota Odax of Ix",                tier: "A",    expansion: "bloodlines" },
  { id: "bl_Liet",           name: "Liet Kynes",                     tier: "none", expansion: "bloodlines" },
  { id: "liet_com",          name: "Liet Kynes (Community)",         tier: "A",    expansion: "bloodlines" },
  { id: "bl_Mohiam",         name: "Gaius Helen Mohiam",             tier: "C",    expansion: "bloodlines" },
  { id: "bl_Piter",          name: "Piter De Vries",                 tier: "none", expansion: "bloodlines" },
  { id: "bl_Piter_com",      name: "Piter De Vries (Community)",     tier: "A",    expansion: "bloodlines" },
  { id: "bl_Yrkoon",         name: "Steersman Y'rkoon",              tier: "C",    expansion: "bloodlines" },
];

/** Flat list of leader display names (for dropdowns) */
export const LEADERS: string[] = LEADER_LIST.map((l) => l.name);

/** Lookup leader info by name */
export function getLeaderInfo(name: string): LeaderInfo | undefined {
  return LEADER_LIST.find((l) => l.name === name);
}

/** Get leaders filtered by tier */
export function getLeadersByTier(tier: LeaderTier): LeaderInfo[] {
  return LEADER_LIST.filter((l) => l.tier === tier);
}

// ===== LEADER STATS =====

export interface LeaderStat {
  leader: string;
  tier: LeaderTier;
  plays: number;
  wins: number; // 1st place finishes
  top2: number; // 1st + 2nd place finishes
  totalVP: number;
  avgPosition: number;
  winRate: number;
}

// ===== JSON IMPORT/EXPORT SCHEMA =====

export interface ExportSchema {
  metadata: {
    version: string;
    timestamp: string;
    tournamentName: string;
  };
  players: {
    id: string;
    name: string;
    points: number;
    totalVP: number;
    efficiency: number;
  }[];
  history: {
    round: number;
    tables: {
      id: number;
      playerIds: string[];
      results: Record<string, number>;
    }[];
  }[];
  settings: {
    totalRounds: number;
    topCut: number;
  };
}
