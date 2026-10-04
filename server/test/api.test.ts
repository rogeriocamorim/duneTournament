import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import pg from "pg";
import type { TableResult, TournamentState } from "../../src/engine/types.ts";
import type { StandingsSnapshot } from "../../src/engine/snapshot.ts";
import { buildApp } from "../src/app.ts";
import { createPool, migrate } from "../src/db.ts";
import type { Db } from "../src/db.ts";
import { seedReferenceData } from "../src/seed.ts";

// Uses a real Postgres database, which is wiped first.
// Example: TEST_DATABASE_URL=postgres://dune:dune@localhost:5432/dune_tournament_test
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";
const TOKEN = "test-token";

interface Record {
  id: string;
  shareSlug: string;
  state: TournamentState;
}

describe.skipIf(!TEST_DATABASE_URL)("tournament API", () => {
  let db: Db;
  let app: FastifyInstance;

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await admin.connect();
    await admin.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await admin.end();

    db = createPool(TEST_DATABASE_URL);
    await migrate(db);
    await seedReferenceData(db);
    app = await buildApp({ db, adminToken: TOKEN });
  });

  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  const auth = { "x-admin-token": TOKEN };

  async function post<T>(url: string, payload: unknown): Promise<T> {
    const res = await app.inject({ method: "POST", url, payload: payload as object, headers: auth });
    expect(res.statusCode, res.body).toBeLessThan(300);
    return res.json() as T;
  }

  async function act(id: string, action: unknown): Promise<Record> {
    return post<Record>(`/api/tournaments/${id}/actions`, action);
  }

  function ordered(playerIds: string[], minutes?: number[]): TableResult[] {
    return playerIds.map((playerId, i) => ({ playerId, position: i + 1, vp: 12 - i, minutesUsed: minutes?.[i] }));
  }

  async function completeLatest(id: string, state: TournamentState): Promise<Record> {
    const roundIndex = state.rounds.length - 1;
    return act(id, {
      type: "BATCH_SUBMIT_TABLE_RESULTS",
      roundIndex,
      tables: state.rounds[roundIndex].tables.filter((t) => !t.isComplete).map((t) => ({ tableId: t.id, results: ordered(t.playerIds) })),
    });
  }

  it("reports health and runs migrations once", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.json()).toEqual({ ok: true });
    expect(await migrate(db)).toEqual([]);
  });

  it("requires the organizer token for changes", async () => {
    const res = await app.inject({ method: "POST", url: "/api/tournaments", payload: { templateId: "classic" } });
    expect(res.statusCode).toBe(401);
    const check = await app.inject({ method: "GET", url: "/api/auth/check", headers: auth });
    expect(check.json()).toEqual({ ok: true });
  });

  it("serves leaders, tier presets and format templates", async () => {
    const leaders = (await app.inject({ method: "GET", url: "/api/leaders" })).json();
    expect(leaders.find((l: { id: string }) => l.id === "liet_com").ttsId).toBe("bl_Liet_com");
    const presets = (await app.inject({ method: "GET", url: "/api/tier-presets" })).json();
    expect(presets.map((p: { id: string }) => p.id)).toEqual(expect.arrayContaining(["bloodlines-s-e", "classic-abc"]));
    const templates = (await app.inject({ method: "GET", url: "/api/format-templates" })).json();
    expect(templates.length).toBeGreaterThanOrEqual(4);
  });

  it("plays a full custom tournament stored in normalized tables", async () => {
    let record = await post<Record>("/api/tournaments", { templateId: "swiss-top8", name: "Orange Pi Open" });
    const id = record.id;
    expect(record.state.metadata.tournamentName).toBe("Orange Pi Open");
    expect(record.state.tiers?.map((t) => t.code)).toEqual(["S", "A", "B", "C", "D", "E"]);

    record = await act(id, { type: "ADD_PLAYERS", names: Array.from({ length: 16 }, (_, i) => `P${i + 1}`) });
    expect(record.state.players).toHaveLength(16);
    record = await act(id, { type: "START_TOURNAMENT" });

    for (let r = 0; r < 4; r++) {
      record = await act(id, { type: "GENERATE_ROUND" });
      record = await completeLatest(id, record.state);
    }
    for (let stage = 1; stage <= 2; stage++) {
      record = await act(id, { type: "ADVANCE_STAGE" });
      expect(record.state.currentStage).toBe(stage);
      record = await act(id, { type: "GENERATE_ROUND" });
      record = await completeLatest(id, record.state);
    }
    record = await act(id, { type: "ADVANCE_STAGE" });
    expect(record.state.phase).toBe("finished");

    // The database holds the data in its own tables
    const counts = await db.query(
      `SELECT (SELECT count(*) FROM rounds WHERE tournament_id = $1)::int AS rounds,
              (SELECT count(*) FROM round_tables WHERE tournament_id = $1)::int AS tables,
              (SELECT count(*) FROM table_results WHERE tournament_id = $1)::int AS results,
              (SELECT count(*) FROM stage_entrants WHERE tournament_id = $1)::int AS entrants,
              (SELECT count(*) FROM tournament_tier_leaders WHERE tournament_id = $1)::int AS tier_leaders,
              (SELECT count(*) FROM tournament_events WHERE tournament_id = $1)::int AS events`,
      [id],
    );
    expect(counts.rows[0]).toEqual({ rounds: 6, tables: 16 + 2 + 1, results: (16 + 2 + 1) * 4, entrants: 16 + 8 + 4, tier_leaders: 28, events: 18 });

    // Reloading gives back the same state
    const reloaded = (await app.inject({ method: "GET", url: `/api/tournaments/${id}` })).json() as Record;
    expect(reloaded.state.rounds).toEqual(record.state.rounds);
    expect(reloaded.state.players).toEqual(record.state.players);
    expect(reloaded.state.stageEntrants).toEqual(record.state.stageEntrants);

    // Spectators see the final standings: winner of the final table first
    const snapshot = (await app.inject({ method: "GET", url: `/api/public/${record.shareSlug}` })).json() as StandingsSnapshot;
    const finalTable = record.state.rounds[5].tables[0];
    const winner = record.state.players.find((p) => p.id === finalTable.playerIds[0])!;
    expect(snapshot.standings[0].name).toBe(winner.name);
    expect(snapshot.metadata.mode).toBe("custom");

    const list = (await app.inject({ method: "GET", url: "/api/tournaments" })).json();
    expect(list.find((t: { id: string }) => t.id === id).playerCount).toBe(16);
  });

  it("stores clock minutes and penalties", async () => {
    let record = await post<Record>("/api/tournaments", { templateId: "swiss-top4" });
    const id = record.id;
    const format = structuredClone(record.state.format!);
    format.placementPoints = [5, 3, 1, 0];
    format.clock = { enabled: true, budgetMinutes: 30, penaltyPerMinute: 1, penaltyCap: 5, rounding: "started-minute" };
    record = await act(id, { type: "UPDATE_FORMAT", format, tiers: record.state.tiers });
    record = await act(id, { type: "ADD_PLAYERS", names: ["A", "B", "C", "D"] });
    record = await act(id, { type: "START_TOURNAMENT" });
    record = await act(id, { type: "GENERATE_ROUND" });
    const table = record.state.rounds[0].tables[0];
    record = await act(id, {
      type: "SUBMIT_TABLE_RESULTS",
      roundIndex: 0,
      tableId: table.id,
      results: ordered(table.playerIds, [25, 32.5, 30, 45]),
    });
    const points = table.playerIds.map((pid) => record.state.players.find((p) => p.id === pid)!.points);
    expect(points).toEqual([5, 0, 1, -5]);

    const rows = await db.query(
      "SELECT player_id, minutes_used, penalty_points FROM table_results WHERE tournament_id = $1 ORDER BY position",
      [id],
    );
    expect(rows.rows.map((r) => [r.minutes_used, r.penalty_points])).toEqual([[25, 0], [32.5, 3], [30, 0], [45, 5]]);
  });

  it("rejects bad requests", async () => {
    const record = await post<Record>("/api/tournaments", { templateId: "classic" });
    const bad = await app.inject({ method: "POST", url: `/api/tournaments/${record.id}/actions`, payload: { type: "RESET" }, headers: auth });
    expect(bad.statusCode).toBe(400);
    const missing = await app.inject({ method: "GET", url: "/api/tournaments/00000000-0000-0000-0000-000000000000" });
    expect(missing.statusCode).toBe(404);
    const garbage = await app.inject({ method: "GET", url: "/api/tournaments/not-a-uuid" });
    expect(garbage.statusCode).toBe(404);
    const template = await app.inject({ method: "POST", url: "/api/tournaments", payload: { templateId: "nope" }, headers: auth });
    expect(template.statusCode).toBe(400);
  });

  it("applies concurrent actions one at a time", async () => {
    const record = await post<Record>("/api/tournaments", { templateId: "classic" });
    await Promise.all(Array.from({ length: 12 }, (_, i) => act(record.id, { type: "ADD_PLAYER", name: `Racer ${i}` })));
    const reloaded = (await app.inject({ method: "GET", url: `/api/tournaments/${record.id}` })).json() as Record;
    expect(reloaded.state.players).toHaveLength(12);
    expect(new Set(reloaded.state.players.map((p) => p.id)).size).toBe(12);
  });

  it("saves custom tier presets and uses them for new tournaments", async () => {
    const tiers = [
      { code: "X", label: "Top", color: "#ff0000", leaderIds: ["stabanTuek", "bl_Kota", "unknownLeader"] },
      { code: "Y", label: "Rest", color: "#00ff00", leaderIds: ["jessica"] },
    ];
    const saved = await app.inject({ method: "PUT", url: "/api/tier-presets/club-night", payload: { name: "Club night", tiers }, headers: auth });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().tiers[0].leaderIds).toEqual(["stabanTuek", "bl_Kota"]);

    const builtin = await app.inject({ method: "PUT", url: "/api/tier-presets/classic-abc", payload: { tiers }, headers: auth });
    expect(builtin.statusCode).toBe(409);

    const record = await post<Record>("/api/tournaments", { templateId: "swiss-top4", tierPresetId: "club-night" });
    expect(record.state.tiers?.map((t) => t.code)).toEqual(["X", "Y"]);
  });

  it("imports an exported tournament", async () => {
    let source = await post<Record>("/api/tournaments", { templateId: "classic" });
    source = await act(source.id, { type: "ADD_PLAYERS", names: ["A", "B", "C", "D"] });
    source = await act(source.id, { type: "START_TOURNAMENT" });
    source = await act(source.id, { type: "GENERATE_ROUND" });

    const imported = await post<Record>("/api/tournaments", { state: source.state });
    expect(imported.id).not.toBe(source.id);
    expect(imported.state.rounds).toEqual(source.state.rounds);
    expect(imported.state.players.map((p) => p.name)).toEqual(["A", "B", "C", "D"]);
  });

  it("deletes tournaments", async () => {
    const record = await post<Record>("/api/tournaments", { templateId: "classic" });
    const res = await app.inject({ method: "DELETE", url: `/api/tournaments/${record.id}`, headers: auth });
    expect(res.statusCode).toBe(204);
    const gone = await app.inject({ method: "GET", url: `/api/tournaments/${record.id}` });
    expect(gone.statusCode).toBe(404);
  });
});
