import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { TierDef, TournamentState } from "../../src/engine/types.ts";
import type { TournamentAction } from "../../src/engine/reducer.ts";
import { createInitialState, normalizeLoadedState, tournamentReducer } from "../../src/engine/reducer.ts";
import { initializePlayerIds, validateImportSchema } from "../../src/engine/tournament.ts";
import { FORMAT_TEMPLATES, ensureFormat } from "../../src/engine/format.ts";
import { buildStandingsSnapshot } from "../../src/engine/snapshot.ts";
import type { Db } from "./db.ts";
import { withTransaction } from "./db.ts";
import {
  deleteTournament,
  findIdBySlug,
  getTierPreset,
  insertTournament,
  listEvents,
  listTierPresets,
  listTournaments,
  loadTournament,
  recordEvent,
  saveTierPreset,
  updateTournament,
} from "./repository.ts";

export interface AppOptions {
  db: Db;
  /** Organizer token required for every change. Empty = no auth (local testing only). */
  adminToken: string;
  logger?: boolean;
}

/** Actions a client may send to an existing tournament */
const ALLOWED_ACTIONS = new Set<TournamentAction["type"]>([
  "UPDATE_FORMAT",
  "ADD_PLAYER",
  "ADD_PLAYERS",
  "REMOVE_PLAYER",
  "RENAME_PLAYER",
  "DROP_PLAYER",
  "SET_TOURNAMENT_NAME",
  "START_TOURNAMENT",
  "GENERATE_ROUND",
  "SUBMIT_TABLE_RESULTS",
  "BATCH_SUBMIT_TABLE_RESULTS",
  "START_TOP8",
  "GENERATE_TOP8_ROUND",
  "ADVANCE_STAGE",
  "TOGGLE_DRAMATIC_REVEAL",
  "TOGGLE_TEST_MODE",
  "SET_GROUP_ASSIGNMENTS",
  "PROCEED_TO_QUALIFYING",
  "START_KNOCKOUT_DRAW",
  "CONFIRM_KNOCKOUT_DRAW",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function tokensMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Basic shape check for tiers sent by clients */
function parseTiers(value: unknown): TierDef[] {
  if (!Array.isArray(value)) throw new HttpError(400, "tiers must be an array");
  const codes = new Set<string>();
  return value.map((t) => {
    if (!t || typeof t !== "object") throw new HttpError(400, "invalid tier");
    const { code, label, color, leaderIds } = t as Record<string, unknown>;
    if (typeof code !== "string" || !code.trim() || code.length > 8) throw new HttpError(400, "invalid tier code");
    if (codes.has(code)) throw new HttpError(400, `duplicate tier code ${code}`);
    codes.add(code);
    if (!Array.isArray(leaderIds) || leaderIds.some((id) => typeof id !== "string")) throw new HttpError(400, "invalid tier leaders");
    return {
      code,
      label: typeof label === "string" ? label.slice(0, 64) : code,
      color: typeof color === "string" && /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#c5a059",
      leaderIds: leaderIds as string[],
    };
  });
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { db, adminToken } = options;
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 5 * 1024 * 1024 });

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    if (status >= 500) app.log.error(error);
    void reply.status(status).send({ error: status >= 500 ? "Internal server error" : error.message });
  });

  /** Guard for every route that changes data */
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!adminToken) return;
    const given = request.headers["x-admin-token"];
    if (typeof given !== "string" || !tokensMatch(given, adminToken)) {
      await reply.status(401).send({ error: "Organizer token required" });
    }
  };

  const tournamentId = (params: unknown): string => {
    const id = (params as { id?: string }).id ?? "";
    if (!UUID_RE.test(id)) throw new HttpError(404, "Tournament not found");
    return id;
  };

  await app.register(async (api) => {
    api.get("/health", async () => {
      await db.query("SELECT 1");
      return { ok: true };
    });

    api.get("/auth/check", { preHandler: requireAdmin }, async () => ({ ok: true }));

    // ── Reference data ──

    api.get("/leaders", async () => {
      const res = await db.query("SELECT id, name, expansion, image_slug, is_community, tts_id, active FROM leaders ORDER BY expansion, name");
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        expansion: r.expansion,
        imageSlug: r.image_slug,
        isCommunity: r.is_community,
        ttsId: r.tts_id,
        active: r.active,
      }));
    });

    api.get("/format-templates", async () => {
      const res = await db.query("SELECT id, name, description, mode, tier_preset_id, format, builtin FROM format_templates ORDER BY builtin DESC, name");
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        mode: r.mode,
        tierPresetId: r.tier_preset_id,
        format: r.format,
        builtin: r.builtin,
      }));
    });

    api.get("/tier-presets", async () => listTierPresets(db));

    api.put("/tier-presets/:presetId", { preHandler: requireAdmin }, async (request) => {
      const { presetId } = request.params as { presetId: string };
      if (!PRESET_ID_RE.test(presetId)) throw new HttpError(400, "Preset id must be lowercase letters, digits and dashes");
      const body = (request.body ?? {}) as Record<string, unknown>;
      const existing = await getTierPreset(db, presetId);
      if (existing?.builtin) throw new HttpError(409, "Built-in presets cannot be changed; save under another name");
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : presetId;
      const description = typeof body.description === "string" ? body.description.slice(0, 300) : "";
      const tiers = parseTiers(body.tiers);
      await withTransaction(db, (client) => saveTierPreset(client, { id: presetId, name, description, tiers }));
      return getTierPreset(db, presetId);
    });

    api.delete("/tier-presets/:presetId", { preHandler: requireAdmin }, async (request, reply) => {
      const { presetId } = request.params as { presetId: string };
      const existing = await getTierPreset(db, presetId);
      if (!existing) throw new HttpError(404, "Preset not found");
      if (existing.builtin) throw new HttpError(409, "Built-in presets cannot be deleted");
      await db.query("DELETE FROM tier_presets WHERE id = $1", [presetId]);
      return reply.status(204).send();
    });

    // ── Tournaments ──

    api.get("/tournaments", async () => listTournaments(db));

    api.post("/tournaments", { preHandler: requireAdmin }, async (request, reply) => {
      const body = (request.body ?? {}) as {
        templateId?: unknown;
        tierPresetId?: unknown;
        name?: unknown;
        state?: unknown;
      };
      let state: TournamentState;

      if (body.state !== undefined) {
        // Import of an exported tournament (JSON file)
        if (!validateImportSchema(body.state)) throw new HttpError(400, "Invalid tournament file");
        state = tournamentReducer(createInitialState(), { type: "IMPORT_STATE", state: body.state as TournamentState });
      } else {
        const templateId = typeof body.templateId === "string" ? body.templateId : "classic";
        const template = FORMAT_TEMPLATES.find((t) => t.id === templateId);
        if (!template) throw new HttpError(400, `Unknown template ${templateId}`);
        const name = typeof body.name === "string" ? body.name.slice(0, 120) : undefined;
        const presetId = typeof body.tierPresetId === "string" ? body.tierPresetId : template.tierPresetId;
        state = tournamentReducer(createInitialState(), { type: "CREATE_FROM_TEMPLATE", templateId, tierPresetId: presetId, name });
        // Presets saved on the server are not known to the engine
        const preset = await getTierPreset(db, presetId);
        if (preset && !preset.builtin) state = { ...state, tiers: preset.tiers };
      }

      const record = await withTransaction(db, async (client) => {
        const created = await insertTournament(client, ensureFormat(state));
        await recordEvent(client, created.id, { type: body.state !== undefined ? "IMPORT" : "CREATE" });
        return created;
      });
      return reply.status(201).send(record);
    });

    api.get("/tournaments/:id", async (request) => {
      const record = await loadTournament(db, tournamentId(request.params));
      if (!record) throw new HttpError(404, "Tournament not found");
      return record;
    });

    api.delete("/tournaments/:id", { preHandler: requireAdmin }, async (request, reply) => {
      const deleted = await deleteTournament(db, tournamentId(request.params));
      if (!deleted) throw new HttpError(404, "Tournament not found");
      return reply.status(204).send();
    });

    api.get("/tournaments/:id/events", async (request) => listEvents(db, tournamentId(request.params)));

    api.post("/tournaments/:id/actions", { preHandler: requireAdmin }, async (request) => {
      const id = tournamentId(request.params);
      const action = request.body as TournamentAction | undefined;
      if (!action || typeof action !== "object" || typeof action.type !== "string") {
        throw new HttpError(400, "Action must be an object with a type");
      }
      if (!ALLOWED_ACTIONS.has(action.type)) throw new HttpError(400, `Action ${action.type} is not allowed`);
      if (action.type === "UPDATE_FORMAT") {
        (action as { tiers: TierDef[] }).tiers = parseTiers((action as { tiers?: unknown }).tiers);
      }

      return withTransaction(db, async (client) => {
        // Row lock: actions on one tournament are applied one at a time
        const record = await loadTournament(client, id, { forUpdate: true });
        if (!record) throw new HttpError(404, "Tournament not found");
        const current = normalizeLoadedState(record.state);
        initializePlayerIds(current.players);

        let next: TournamentState;
        try {
          next = tournamentReducer(current, action);
        } catch (err) {
          throw new HttpError(400, `Invalid ${action.type}: ${err instanceof Error ? err.message : String(err)}`);
        }

        if (next !== current) {
          await updateTournament(client, id, next);
          await recordEvent(client, id, action);
        }
        return { id, shareSlug: record.shareSlug, state: next };
      });
    });

    // ── Spectators ──

    api.get("/public/:slug", async (request) => {
      const { slug } = request.params as { slug: string };
      const id = await findIdBySlug(db, slug);
      if (!id) throw new HttpError(404, "Tournament not found");
      const record = await loadTournament(db, id);
      if (!record) throw new HttpError(404, "Tournament not found");
      return buildStandingsSnapshot(normalizeLoadedState(record.state));
    });
  }, { prefix: "/api" });

  return app;
}
