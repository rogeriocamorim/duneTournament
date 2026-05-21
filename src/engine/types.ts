// ===== CORE TYPES =====

export type TournamentMode = "classic" | "colosseum";

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
  type: "qualifying" | "semifinal" | "winners-final" | "losers-final" | "grand-final";
  availableLeaders?: string[]; // leader names available for this round
  leaderTier?: LeaderTier;     // tier used for leader selection this round
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

export type LeaderTier = "A" | "B" | "C" | "none";

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

const RESET_PASSPHRASE_HASH =
  "95561cf41e5eeac118ed1ff4498f8a5a5ad99f273ad6f88d050955b22de94957";

/** SHA-256 hash using pure JS (works on HTTP origins where crypto.subtle is unavailable). */
async function sha256(message: string): Promise<string> {
  // Prefer native Web Crypto when available (HTTPS / localhost)
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: simple JS SHA-256 implementation
  const utf8 = new TextEncoder().encode(message);
  const K: number[] = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const pad = new Uint8Array(((utf8.length + 9 + 63) & ~63));
  pad.set(utf8);
  pad[utf8.length] = 0x80;
  const dv = new DataView(pad.buffer);
  dv.setUint32(pad.length - 4, utf8.length * 8, false);
  let [h0, h1, h2, h3, h4, h5, h6, h7] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  for (let off = 0; off < pad.length; off += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i-15], 7) ^ rr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rr(w[i-2], 17) ^ rr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => (v >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

/** Verify a passphrase against the stored SHA-256 hash. */
export async function verifyResetPassphrase(input: string): Promise<boolean> {
  const hashHex = await sha256(input);
  return hashHex === RESET_PASSPHRASE_HASH;
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
