// ===== CORE TYPES =====

export type TournamentMode = "classic" | "colosseum" | "custom";

export interface Player {
  id: string;
  name: string;
  points: number;
  totalVP: number;
  wins: number;        // count of 1st-place finishes (tiebreaker after points)
  efficiency: number;  // lower = better (sum of game round finishes)
  opponents: string[]; // ids of players already faced
  groupId?: number;    // Colosseum mode: group 0-7
}

export interface TableResult {
  playerId: string;
  position: number; // 1-4
  vp: number;
  leader?: string;        // leader picked for this game
  seatPosition?: number;  // Colosseum mode: seat at table
  pickOrder?: number;     // Colosseum mode: leader pick order
  minutesUsed?: number;   // Chess clock: minutes this player used in the game
  penaltyPoints?: number; // Chess clock: tournament points deducted for overtime
}

export interface Table {
  id: number;
  playerIds: string[];
  results: TableResult[];
  isComplete: boolean;
}

export type StatsPhase = "all" | "qualifying" | "bracket";

export interface Round {
  number: number;
  tables: Table[];
  isComplete: boolean;
  type: "qualifying" | "semifinal" | "winners-final" | "losers-final" | "grand-final" | "stage";
  availableLeaders?: string[]; // leader names available for this round
  leaderTier?: LeaderTier;     // tier label used for leader selection this round (e.g. "A" or "S+A")
  tierCodes?: string[];        // tier codes the leader pool was drawn from
  placementPoints?: number[];  // tournament points for 1st..4th, fixed when the round is generated
  stageIndex?: number;         // index into format.stages (custom mode)
  roundInStage?: number;       // 1-based round number within its stage (custom mode)
}

export interface TournamentState {
  mode: TournamentMode;
  metadata: {
    version: string;
    timestamp: string;
    tournamentName: string;
    jsonbinId?: string;  // JSONBin master pointer ID (shareable)
    jsonbinKey?: string; // JSONBin access key (private, for updates)
  };
  players: Player[];
  rounds: Round[];
  phase: "home" | "registration" | "group-draw" | "qualifying" | "knockout-draw" | "top8" | "finished";
  currentRound: number;
  settings: {
    totalQualifyingRounds: number;
    topCut: number;
    dramaticReveal: boolean;
    testMode: boolean;
  };
  /** Tournament structure, scoring, clock and per-stage tier rules */
  format?: TournamentFormat;
  /** Leader tiers for this tournament (copied from a preset, then editable) */
  tiers?: TierDef[];
  /** Custom mode: index of the stage being played */
  currentStage?: number;
  /** Custom mode: player ids entering each stage, in seed order */
  stageEntrants?: string[][];
}

// ===== TOURNAMENT FORMAT =====

/** How players are distributed onto tables of 4 */
export type PairingMethod =
  | "swiss-golf"    // rank by standings, snake across tables, avoid rematches
  | "random"        // random tables, avoid rematches where possible
  | "seeded-snake"  // rank by standings, snake across tables (1,8,9,16 / 2,7,10,15 ...)
  | "seeded-block"  // rank by standings, top 4 together, next 4 together ...
  | "groups-fixed"  // fixed groups of 8 with the Colosseum schedule
  | "manual";       // organizer assigns every table

/** Which kind of stage this is */
export type StageKind =
  | "rounds"             // generic stage: N rounds with a pairing method
  | "classic-bracket"    // Top 16 semifinal → redemption → grand final
  | "colosseum-bracket"; // Colosseum knockout draw → semifinal 2 → grand final

/** Who enters a stage (ignored for the first stage, which takes every registered player) */
export interface Advancement {
  kind: "all" | "top-n" | "table-winners";
  /** top-n: number of players that advance */
  n?: number;
  /** table-winners: best N of every table in the previous stage's last round */
  perTable?: number;
}

/** Which tiers supply the leader pool for a round */
export interface TierRule {
  /** 1-based round within the stage; omit to apply to every round without its own rule */
  roundInStage?: number;
  tierCodes: string[];
  /** "all" = every leader of the tiers, "random-n" = draw poolSize leaders */
  selection: "all" | "random-n";
  poolSize?: number;
  /** Pick ONE of tierCodes at random instead of combining them */
  randomOneOf?: boolean;
}

export interface StageConfig {
  id: string;
  name: string;
  kind: StageKind;
  rounds: number;
  advancement: Advancement;
  pairing: PairingMethod;
  /** Tournament points for 1st..4th in this stage (falls back to the format default) */
  placementPoints?: number[];
  /** true = stage ranking uses all points so far, false = only points scored in this stage */
  carryPoints: boolean;
  /** Use the chess clock in this stage (default true when the clock is enabled) */
  clockEnabled?: boolean;
  /** Override of the clock budget for this stage */
  clockBudgetMinutes?: number | null;
  tierRules: TierRule[];
}

export interface ClockConfig {
  enabled: boolean;
  /** Minutes each player may use per game */
  budgetMinutes: number;
  /** Tournament points lost per minute over budget */
  penaltyPerMinute: number;
  /** Maximum penalty per game (null = no cap) */
  penaltyCap: number | null;
  /** started-minute: 30.5 min over a 30 budget = 1 minute; full-minute: = 0 minutes */
  rounding: "started-minute" | "full-minute";
}

export interface TournamentFormat {
  templateId: string;
  /** Default tournament points for 1st..4th */
  placementPoints: number[];
  clock: ClockConfig;
  stages: StageConfig[];
}

export interface TierDef {
  code: string;
  label: string;
  color: string;
  /** Leader ids (LeaderInfo.id) in this tier */
  leaderIds: string[];
}

export const POINTS_MAP: Record<number, number> = {
  1: 6,
  2: 3,
  3: 2,
  4: 1,
};

export const DEFAULT_STATE: TournamentState = {
  mode: "classic",
  metadata: {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    tournamentName: "Dune Bloodlines Open",
  },
  players: [],
  rounds: [],
  phase: "home",
  currentRound: 0,
  settings: {
    totalQualifyingRounds: 5,
    topCut: 16,
    dramaticReveal: true,
    testMode: false,
  },
};

// ===== LEADERS (Base + Ix + Uprising + Bloodlines) =====

/** Tier code ("A", "S", ...) or a combined label such as "S+A"; "none" = untiered */
export type LeaderTier = string;

export interface LeaderInfo {
  id: string;
  name: string;
  tier: LeaderTier;
  expansion: "base" | "ix" | "uprising" | "bloodlines";
  imageSlug: string;
  isCommunity?: boolean;
}

export const LEADER_LIST: LeaderInfo[] = [
  // ── Base Game ──
  { id: "paulAtreides",      name: "Paul Atreides",                  tier: "none", expansion: "base",       imageSlug: "dune-imperium-leader-paul-atreides" },
  { id: "letoAtreides",      name: "Duke Leto Atreides",             tier: "C",    expansion: "base",       imageSlug: "dune-imperium-leader-dune-leto-atreides" },
  { id: "memnonThorvald",    name: "Earl Memnon Thorvald",           tier: "none", expansion: "base",       imageSlug: "dune-imperium-leader-earl-memnon-thorvald" },
  { id: "glossuRabban",      name: 'Glossu "The Beast" Rabban',      tier: "A",    expansion: "base",       imageSlug: "dune-imperium-leader-glossu-the-beast-rabban" },
  { id: "vladimirHarkonnen", name: "Baron Vladimir Harkonnen",       tier: "C",    expansion: "base",       imageSlug: "dune-imperium-leader-baron-vladimir-harkonnen" },
  { id: "helenaRichese",     name: "Helena Richese",                 tier: "none", expansion: "base",       imageSlug: "dune-imperium-leader-helena-richese" },
  { id: "arianaThorvald",    name: "Countess Ariana Thorvald",       tier: "none", expansion: "base",       imageSlug: "dune-imperium-leader-countess-ariana-thorvald" },
  { id: "ilbanRichese",      name: "Count Ilban Richese",            tier: "none", expansion: "base",       imageSlug: "dune-imperium-leader-count-ilban-richese" },
  { id: "armandEcaz",        name: "Archduke Armand Ecaz",           tier: "C",    expansion: "base",       imageSlug: "rise-of-ix-leader-archduke-armand-ecaz" },
  // ── Ix Expansion ──
  { id: "tessiaVernius",     name: "Tessia Vernius",                 tier: "A",    expansion: "ix",         imageSlug: "rise-of-ix-leader-tessia-vernius" },
  { id: "ilesaEcaz_com",     name: "Ilesa Ecaz (Community)",         tier: "A",    expansion: "ix",         imageSlug: "rise-of-ix-leader-ilesa-ecaz", isCommunity: true },
  // ── Uprising Expansion ──
  { id: "stabanTuek",        name: "Staban Tuek",                    tier: "A",    expansion: "uprising",   imageSlug: "uprising-leader-staban-tuek" },
  { id: "amberMetulli",      name: "Lady Amber Metulli",             tier: "B",    expansion: "uprising",   imageSlug: "uprising-leader-lady-amber-metulli" },
  { id: "gurneyHalleck",     name: "Gurney Halleck",                 tier: "B",    expansion: "uprising",   imageSlug: "uprising-leader-gurney-halleck" },
  { id: "margotFenring",     name: "Lady Margot Fenring",            tier: "C",    expansion: "uprising",   imageSlug: "uprising-leader-lady-margot-fenring" },
  { id: "irulanCorrino",     name: "Princess Irulan",                tier: "B",    expansion: "uprising",   imageSlug: "uprising-leader-princess-irulan" },
  { id: "jessica",           name: "Lady Jessica",                   tier: "C",    expansion: "uprising",   imageSlug: "uprising-leader-lady-jessica" },
  { id: "feydRauthaHarkonnen", name: "Feyd-Rautha Harkonnen",        tier: "C",    expansion: "uprising",   imageSlug: "uprising-leader-feyd-rautha-harkonnen" },
  { id: "shaddamCorrino",    name: "Shaddam IV",                     tier: "C",    expansion: "uprising",   imageSlug: "uprising-leader-shaddam-corrino-iv" },
  { id: "muadDib",           name: "Muad'Dib",                       tier: "B",    expansion: "uprising",   imageSlug: "uprising-leader-muad-dib" },
  { id: "yunaMoritani",      name: "Princess Yuna Moritani",         tier: "C",    expansion: "uprising",   imageSlug: "rise-of-ix-leader-princess-yuna-moritani" },
  // ── Bloodlines Expansion ──
  { id: "bl_Chani",          name: "Chani",                          tier: "B",    expansion: "bloodlines", imageSlug: "bloodlines-leader-chani" },
  { id: "bl_Duncan",         name: "Duncan Idaho",                   tier: "B",    expansion: "bloodlines", imageSlug: "bloodlines-leader-duncan-idaho" },
  { id: "bl_Esmar",          name: "Esmar Tuek",                     tier: "A",    expansion: "bloodlines", imageSlug: "bloodlines-leader-esmar-tuek" },
  { id: "bl_Hasimir",        name: "Count Hasimir Fenring",          tier: "A",    expansion: "bloodlines", imageSlug: "bloodlines-leader-count-hasimir-fenring" },
  { id: "bl_Kota",           name: "Kota Odax of Ix",                tier: "A",    expansion: "bloodlines", imageSlug: "bloodlines-leader-kota-odax-of-ix" },
  { id: "bl_Liet",           name: "Liet Kynes",                     tier: "none", expansion: "bloodlines", imageSlug: "bloodlines-leader-liet-kynes" },
  { id: "liet_com",          name: "Liet Kynes (Community)",         tier: "A",    expansion: "bloodlines", imageSlug: "bloodlines-leader-liet-kynes", isCommunity: true },
  { id: "bl_Mohiam",         name: "Gaius Helen Mohiam",             tier: "B",    expansion: "bloodlines", imageSlug: "bloodlines-leader-gaius-helen-mohiam" },
  { id: "bl_Piter",          name: "Piter De Vries",                 tier: "none", expansion: "bloodlines", imageSlug: "bloodlines-leader-piter-de-vries" },
  { id: "bl_Piter_com",      name: "Piter De Vries (Community)",     tier: "A",    expansion: "bloodlines", imageSlug: "bloodlines-leader-piter-de-vries", isCommunity: true },
  { id: "bl_Yrkoon",         name: "Steersman Y'rkoon",              tier: "B",    expansion: "bloodlines", imageSlug: "bloodlines-leader-steersman-y-rkoon" },
  // ── Community leaders (TTS mod) ──
  { id: "rhomburVernius_com", name: "Prince Rhombur Vernius (Community)", tier: "none", expansion: "ix",     imageSlug: "rise-of-ix-leader-prince-rhombur-vernius", isCommunity: true },
  { id: "arianaThorvald_com", name: "Ariana Thorvald (Community)",    tier: "none", expansion: "base",       imageSlug: "dune-imperium-leader-countess-ariana-thorvald", isCommunity: true },
  { id: "paulAtreides_com",  name: "Paul Atreides (Community)",       tier: "none", expansion: "base",       imageSlug: "dune-imperium-leader-paul-atreides", isCommunity: true },
];

/** TTS mod leader ids that map to a different id here */
export const LEADER_ID_ALIASES: Record<string, string> = {
  bl_Liet_com: "liet_com",
};

/** Lookup leader info by id (TTS ids accepted) */
export function getLeaderById(id: string): LeaderInfo | undefined {
  const resolved = LEADER_ID_ALIASES[id] ?? id;
  return LEADER_LIST.find((l) => l.id === resolved);
}

/** Flat list of leader display names (for dropdowns) */
export const LEADERS: string[] = LEADER_LIST.map((l) => l.name);

/** Lookup leader info by name */
export function getLeaderInfo(name: string): LeaderInfo | undefined {
  return LEADER_LIST.find((l) => l.name === name);
}

/** Get leaders filtered by tier. Uses the tournament tiers when given, else the built-in A/B/C tiers. */
export function getLeadersByTier(tier: LeaderTier, tiers?: TierDef[]): LeaderInfo[] {
  if (tiers) {
    const codes = tier.split("+");
    const ids = new Set(tiers.filter((t) => codes.includes(t.code)).flatMap((t) => t.leaderIds));
    return LEADER_LIST.filter((l) => ids.has(l.id));
  }
  return LEADER_LIST.filter((l) => l.tier === tier);
}

/** Get the local image URL for a leader card */
export function getLeaderImageUrl(leader: LeaderInfo): string {
  return `${import.meta.env.BASE_URL}leaders/${leader.imageSlug}.webp`;
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
  roundsAvailable: number; // rounds the leader was in the pool
  winRate: number; // wins / roundsAvailable
}

// ===== RESET PROTECTION =====

/** Encoded reset passphrase (base64). Enough to guard against accidental resets. */
const RESET_KEY = "cmVzZXRkdW5l";

/** Verify a passphrase against the stored value. Synchronous, no crypto needed. */
export function verifyResetPassphrase(input: string): boolean {
  try {
    return input === atob(RESET_KEY);
  } catch {
    return false;
  }
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
    wins: number;
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
