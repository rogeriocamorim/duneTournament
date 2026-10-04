import { randomBytes, randomUUID } from "node:crypto";
import type { Player, Round, Table, TableResult, TierDef, TournamentState } from "../../src/engine/types.ts";
import type { DbClient, Db } from "./db.ts";
import { insertRows } from "./db.ts";

// ===== TOURNAMENT PERSISTENCE =====
// A TournamentState is stored across normalized tables. Saving replaces the
// child rows of the tournament inside the caller's transaction.

export interface TournamentRecord {
  id: string;
  shareSlug: string;
  state: TournamentState;
}

export interface TournamentSummary {
  id: string;
  name: string;
  mode: string;
  phase: string;
  playerCount: number;
  shareSlug: string;
  updatedAt: string;
}

/** Short url-safe slug for spectator links */
function newShareSlug(): string {
  return randomBytes(6).toString("base64url");
}

/** Leader ids known to the database (tier rows may only reference these) */
async function knownLeaderIds(client: DbClient): Promise<Set<string>> {
  const res = await client.query<{ id: string }>("SELECT id FROM leaders");
  return new Set(res.rows.map((r) => r.id));
}

export async function insertTournament(client: DbClient, state: TournamentState): Promise<TournamentRecord> {
  const id = randomUUID();
  const shareSlug = newShareSlug();
  await client.query(
    `INSERT INTO tournaments (id, share_slug, name, mode, phase, current_round, current_stage, settings, format, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, shareSlug, state.metadata.tournamentName, state.mode, state.phase, state.currentRound,
      state.currentStage ?? null, JSON.stringify(state.settings), state.format ? JSON.stringify(state.format) : null,
      JSON.stringify(state.metadata)],
  );
  await writeChildren(client, id, state);
  return { id, shareSlug, state };
}

export async function updateTournament(client: DbClient, id: string, state: TournamentState): Promise<void> {
  await client.query(
    `UPDATE tournaments SET name = $2, mode = $3, phase = $4, current_round = $5, current_stage = $6,
       settings = $7, format = $8, metadata = $9, version = version + 1, updated_at = now()
     WHERE id = $1`,
    [id, state.metadata.tournamentName, state.mode, state.phase, state.currentRound, state.currentStage ?? null,
      JSON.stringify(state.settings), state.format ? JSON.stringify(state.format) : null, JSON.stringify(state.metadata)],
  );
  // Children cascade from these tables
  await client.query("DELETE FROM tournament_tiers WHERE tournament_id = $1", [id]);
  await client.query("DELETE FROM players WHERE tournament_id = $1", [id]);
  await client.query("DELETE FROM stage_entrants WHERE tournament_id = $1", [id]);
  await client.query("DELETE FROM rounds WHERE tournament_id = $1", [id]);
  await writeChildren(client, id, state);
}

async function writeChildren(client: DbClient, id: string, state: TournamentState): Promise<void> {
  const leaders = await knownLeaderIds(client);
  const tiers = state.tiers ?? [];

  await insertRows(client, "tournament_tiers", ["tournament_id", "code", "position", "label", "color"],
    tiers.map((t, i) => [id, t.code, i, t.label, t.color]));
  await insertRows(client, "tournament_tier_leaders", ["tournament_id", "tier_code", "leader_id", "position"],
    tiers.flatMap((t) => [...new Set(t.leaderIds)].filter((l) => leaders.has(l)).map((l, i) => [id, t.code, l, i])));

  await insertRows(client, "players",
    ["tournament_id", "id", "position", "name", "points", "total_vp", "wins", "efficiency", "group_id", "opponents"],
    state.players.map((p, i) => [id, p.id, i, p.name, p.points, p.totalVP, p.wins ?? 0, p.efficiency, p.groupId ?? null, p.opponents ?? []]));

  await insertRows(client, "stage_entrants", ["tournament_id", "stage_index", "seed", "player_id"],
    (state.stageEntrants ?? []).flatMap((ids, stage) => ids.map((pid, seed) => [id, stage, seed, pid])));

  await insertRows(client, "rounds",
    ["tournament_id", "number", "type", "is_complete", "stage_index", "round_in_stage", "leader_tier", "tier_codes", "available_leaders", "placement_points"],
    state.rounds.map((r) => [id, r.number, r.type, r.isComplete, r.stageIndex ?? null, r.roundInStage ?? null,
      r.leaderTier ?? null, r.tierCodes ?? null, r.availableLeaders ?? null, r.placementPoints ?? null]));

  await insertRows(client, "round_tables", ["tournament_id", "round_number", "table_id", "is_complete", "player_ids"],
    state.rounds.flatMap((r) => r.tables.map((t) => [id, r.number, t.id, t.isComplete, t.playerIds])));

  await insertRows(client, "table_results",
    ["tournament_id", "round_number", "table_id", "player_id", "position", "vp", "leader", "seat_position", "pick_order", "minutes_used", "penalty_points"],
    state.rounds.flatMap((r) => r.tables.flatMap((t) => t.results.map((res) => [
      id, r.number, t.id, res.playerId, res.position, res.vp, res.leader ?? null, res.seatPosition ?? null,
      res.pickOrder ?? null, res.minutesUsed ?? null, res.penaltyPoints ?? 0,
    ]))));
}

interface TournamentRow {
  id: string;
  share_slug: string;
  mode: TournamentState["mode"];
  phase: TournamentState["phase"];
  current_round: number;
  current_stage: number | null;
  settings: TournamentState["settings"];
  format: TournamentState["format"] | null;
  metadata: TournamentState["metadata"];
}

/** Load a tournament; `forUpdate` locks the row until the transaction ends */
export async function loadTournament(
  client: DbClient | Db,
  id: string,
  options: { forUpdate?: boolean } = {},
): Promise<TournamentRecord | null> {
  const res = await client.query<TournamentRow>(
    `SELECT id, share_slug, mode, phase, current_round, current_stage, settings, format, metadata
     FROM tournaments WHERE id = $1 ${options.forUpdate ? "FOR UPDATE" : ""}`,
    [id],
  );
  const row = res.rows[0];
  if (!row) return null;
  return { id: row.id, shareSlug: row.share_slug, state: await assemble(client, row) };
}

export async function findIdBySlug(db: Db, slug: string): Promise<string | null> {
  const res = await db.query<{ id: string }>("SELECT id FROM tournaments WHERE share_slug = $1", [slug]);
  return res.rows[0]?.id ?? null;
}

async function assemble(client: DbClient | Db, row: TournamentRow): Promise<TournamentState> {
  const id = row.id;
  // Sequential: a transaction client runs one query at a time
  const tierRows = await client.query("SELECT code, label, color FROM tournament_tiers WHERE tournament_id = $1 ORDER BY position", [id]);
  const tierLeaderRows = await client.query("SELECT tier_code, leader_id FROM tournament_tier_leaders WHERE tournament_id = $1 ORDER BY tier_code, position", [id]);
  const playerRows = await client.query("SELECT * FROM players WHERE tournament_id = $1 ORDER BY position", [id]);
  const entrantRows = await client.query("SELECT stage_index, player_id FROM stage_entrants WHERE tournament_id = $1 ORDER BY stage_index, seed", [id]);
  const roundRows = await client.query("SELECT * FROM rounds WHERE tournament_id = $1 ORDER BY number", [id]);
  const tableRows = await client.query("SELECT * FROM round_tables WHERE tournament_id = $1 ORDER BY round_number, table_id", [id]);
  const resultRows = await client.query("SELECT * FROM table_results WHERE tournament_id = $1", [id]);

  const tiers: TierDef[] = tierRows.rows.map((t) => ({
    code: t.code,
    label: t.label,
    color: t.color,
    leaderIds: tierLeaderRows.rows.filter((l) => l.tier_code === t.code).map((l) => l.leader_id),
  }));

  const players: Player[] = playerRows.rows.map((p) => ({
    id: p.id,
    name: p.name,
    points: p.points,
    totalVP: p.total_vp,
    wins: p.wins,
    efficiency: p.efficiency,
    opponents: p.opponents ?? [],
    ...(p.group_id !== null ? { groupId: p.group_id } : {}),
  }));

  const stageEntrants: string[][] = [];
  for (const e of entrantRows.rows) {
    (stageEntrants[e.stage_index] ??= []).push(e.player_id);
  }

  const resultsByTable = new Map<string, TableResult[]>();
  for (const r of resultRows.rows) {
    const key = `${r.round_number}:${r.table_id}`;
    const result: TableResult = { playerId: r.player_id, position: r.position, vp: r.vp };
    if (r.leader !== null) result.leader = r.leader;
    if (r.seat_position !== null) result.seatPosition = r.seat_position;
    if (r.pick_order !== null) result.pickOrder = r.pick_order;
    if (r.minutes_used !== null) result.minutesUsed = r.minutes_used;
    result.penaltyPoints = r.penalty_points;
    (resultsByTable.get(key) ?? resultsByTable.set(key, []).get(key)!).push(result);
  }

  const tablesByRound = new Map<number, Table[]>();
  for (const t of tableRows.rows) {
    const table: Table = {
      id: t.table_id,
      playerIds: t.player_ids,
      isComplete: t.is_complete,
      // Keep the table's seat order for results
      results: (resultsByTable.get(`${t.round_number}:${t.table_id}`) ?? [])
        .sort((a, b) => t.player_ids.indexOf(a.playerId) - t.player_ids.indexOf(b.playerId)),
    };
    (tablesByRound.get(t.round_number) ?? tablesByRound.set(t.round_number, []).get(t.round_number)!).push(table);
  }

  const rounds: Round[] = roundRows.rows.map((r) => {
    const round: Round = {
      number: r.number,
      type: r.type,
      isComplete: r.is_complete,
      tables: tablesByRound.get(r.number) ?? [],
    };
    if (r.stage_index !== null) round.stageIndex = r.stage_index;
    if (r.round_in_stage !== null) round.roundInStage = r.round_in_stage;
    if (r.leader_tier !== null) round.leaderTier = r.leader_tier;
    if (r.tier_codes !== null) round.tierCodes = r.tier_codes;
    if (r.available_leaders !== null) round.availableLeaders = r.available_leaders;
    if (r.placement_points !== null) round.placementPoints = r.placement_points;
    return round;
  });

  const state: TournamentState = {
    mode: row.mode,
    metadata: row.metadata,
    players,
    rounds,
    phase: row.phase,
    currentRound: row.current_round,
    settings: row.settings,
    tiers,
  };
  if (row.format) state.format = row.format;
  if (row.current_stage !== null) state.currentStage = row.current_stage;
  if (stageEntrants.length > 0) state.stageEntrants = stageEntrants;
  return state;
}

export async function listTournaments(db: Db): Promise<TournamentSummary[]> {
  const res = await db.query(
    `SELECT t.id, t.name, t.mode, t.phase, t.share_slug, t.updated_at,
            (SELECT count(*) FROM players p WHERE p.tournament_id = t.id)::int AS player_count
     FROM tournaments t ORDER BY t.updated_at DESC`,
  );
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode,
    phase: r.phase,
    playerCount: r.player_count,
    shareSlug: r.share_slug,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export async function deleteTournament(db: Db, id: string): Promise<boolean> {
  const res = await db.query("DELETE FROM tournaments WHERE id = $1", [id]);
  return (res.rowCount ?? 0) > 0;
}

export async function recordEvent(client: DbClient, tournamentId: string, action: { type: string }): Promise<void> {
  await client.query(
    "INSERT INTO tournament_events (tournament_id, action_type, action) VALUES ($1, $2, $3)",
    [tournamentId, action.type, JSON.stringify(action)],
  );
}

export async function listEvents(db: Db, tournamentId: string, limit = 200) {
  const res = await db.query(
    `SELECT id, action_type, action, created_at FROM tournament_events
     WHERE tournament_id = $1 ORDER BY id DESC LIMIT $2`,
    [tournamentId, limit],
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    type: r.action_type,
    action: r.action,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

// ===== TIER PRESETS =====

export interface TierPresetRecord {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  tiers: TierDef[];
}

export async function listTierPresets(db: Db): Promise<TierPresetRecord[]> {
  const [presets, tiers, leaders] = await Promise.all([
    db.query("SELECT id, name, description, builtin FROM tier_presets ORDER BY builtin DESC, name"),
    db.query("SELECT preset_id, code, label, color FROM tier_preset_tiers ORDER BY preset_id, position"),
    db.query("SELECT preset_id, tier_code, leader_id FROM tier_preset_leaders ORDER BY preset_id, tier_code, position"),
  ]);
  return presets.rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    builtin: p.builtin,
    tiers: tiers.rows.filter((t) => t.preset_id === p.id).map((t) => ({
      code: t.code,
      label: t.label,
      color: t.color,
      leaderIds: leaders.rows.filter((l) => l.preset_id === p.id && l.tier_code === t.code).map((l) => l.leader_id),
    })),
  }));
}

export async function getTierPreset(db: Db, id: string): Promise<TierPresetRecord | null> {
  return (await listTierPresets(db)).find((p) => p.id === id) ?? null;
}

export async function saveTierPreset(client: DbClient, preset: Omit<TierPresetRecord, "builtin">): Promise<void> {
  const leaders = await knownLeaderIds(client);
  await client.query(
    `INSERT INTO tier_presets (id, name, description, builtin, updated_at) VALUES ($1, $2, $3, false, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()`,
    [preset.id, preset.name, preset.description],
  );
  await client.query("DELETE FROM tier_preset_tiers WHERE preset_id = $1", [preset.id]);
  await insertRows(client, "tier_preset_tiers", ["preset_id", "code", "position", "label", "color"],
    preset.tiers.map((t, i) => [preset.id, t.code, i, t.label, t.color]));
  await insertRows(client, "tier_preset_leaders", ["preset_id", "tier_code", "leader_id", "position"],
    preset.tiers.flatMap((t) => [...new Set(t.leaderIds)].filter((l) => leaders.has(l)).map((l, i) => [preset.id, t.code, l, i])));
}
