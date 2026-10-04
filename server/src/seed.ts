import { LEADER_ID_ALIASES, LEADER_LIST } from "../../src/engine/types.ts";
import { FORMAT_TEMPLATES, TIER_PRESETS } from "../../src/engine/format.ts";
import type { Db } from "./db.ts";
import { insertRows, withTransaction } from "./db.ts";

/** TTS mod id for a leader, when it differs from ours */
const TTS_IDS = new Map(Object.entries(LEADER_ID_ALIASES).map(([tts, ours]) => [ours, tts]));

/**
 * Keep the reference data in sync with the engine: leaders, the built-in tier
 * presets and the built-in format templates. User presets are left untouched.
 */
export async function seedReferenceData(db: Db): Promise<void> {
  await withTransaction(db, async (client) => {
    for (const leader of LEADER_LIST) {
      await client.query(
        `INSERT INTO leaders (id, name, expansion, image_slug, is_community, tts_id, active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, expansion = EXCLUDED.expansion,
           image_slug = EXCLUDED.image_slug, is_community = EXCLUDED.is_community, tts_id = EXCLUDED.tts_id`,
        [leader.id, leader.name, leader.expansion, leader.imageSlug, leader.isCommunity ?? false, TTS_IDS.get(leader.id) ?? leader.id],
      );
    }

    for (const preset of TIER_PRESETS) {
      await client.query(
        `INSERT INTO tier_presets (id, name, description, builtin, updated_at) VALUES ($1, $2, $3, true, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, builtin = true, updated_at = now()`,
        [preset.id, preset.name, preset.description],
      );
      await client.query("DELETE FROM tier_preset_tiers WHERE preset_id = $1", [preset.id]);
      await insertRows(client, "tier_preset_tiers", ["preset_id", "code", "position", "label", "color"],
        preset.tiers.map((t, i) => [preset.id, t.code, i, t.label, t.color]));
      await insertRows(client, "tier_preset_leaders", ["preset_id", "tier_code", "leader_id", "position"],
        preset.tiers.flatMap((t) => t.leaderIds.map((id, i) => [preset.id, t.code, id, i])));
    }

    for (const template of FORMAT_TEMPLATES) {
      await client.query(
        `INSERT INTO format_templates (id, name, description, mode, tier_preset_id, format, builtin)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
           mode = EXCLUDED.mode, tier_preset_id = EXCLUDED.tier_preset_id, format = EXCLUDED.format, builtin = true`,
        [template.id, template.name, template.description, template.mode, template.tierPresetId, JSON.stringify(template.format)],
      );
    }
  });
}
