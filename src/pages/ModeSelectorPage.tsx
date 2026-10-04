import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Swords, Crown, Layers, Trophy, FolderOpen, Trash2, RefreshCw } from "lucide-react";
import type { TournamentMode } from "../engine/types";
import { FORMAT_TEMPLATES, TIER_PRESETS, describeTierRule } from "../engine/format";
import type { ServerTierPreset, TournamentSummary } from "../api/client";
import { deleteTournament, listTierPresets, listTournaments } from "../api/client";

interface ModeSelectorPageProps {
  /** Create a tournament from a format template */
  onCreate: (templateId: string, tierPresetId: string, name: string) => void;
  /** Server mode: tournaments are stored in the database */
  apiMode: boolean;
  onOpenTournament: (id: string) => void;
  busy?: boolean;
}

const MODE_ICONS: Record<TournamentMode, typeof Swords> = {
  classic: Swords,
  colosseum: Crown,
  custom: Layers,
};

const PHASE_LABELS: Record<string, string> = {
  home: "New",
  registration: "Registration",
  "group-draw": "Group draw",
  qualifying: "In progress",
  "knockout-draw": "Knockout draw",
  top8: "Finals",
  finished: "Finished",
};

export function ModeSelectorPage({ onCreate, apiMode, onOpenTournament, busy }: ModeSelectorPageProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tierPresetId, setTierPresetId] = useState<string>("");
  const [name, setName] = useState("");
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [serverPresets, setServerPresets] = useState<ServerTierPreset[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const refresh = () => {
    if (!apiMode) return;
    listTournaments()
      .then((list) => {
        setTournaments(list);
        setListError(null);
      })
      .catch((err) => setListError(err instanceof Error ? err.message : String(err)));
    listTierPresets().then((list) => setServerPresets(list.filter((p) => !p.builtin))).catch(() => setServerPresets([]));
  };

  useEffect(() => {
    if (!apiMode) return;
    listTournaments().then(setTournaments).catch((err) => setListError(err instanceof Error ? err.message : String(err)));
    listTierPresets().then((list) => setServerPresets(list.filter((p) => !p.builtin))).catch(() => setServerPresets([]));
  }, [apiMode]);

  const template = FORMAT_TEMPLATES.find((t) => t.id === selected);
  const presets = [...TIER_PRESETS, ...serverPresets];

  const handleDelete = async (t: TournamentSummary) => {
    if (!confirm(`Delete "${t.name}" permanently?`)) return;
    try {
      await deleteTournament(t.id);
      refresh();
    } catch (err) {
      alert(`Could not delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10"
      >
        <h1 className="text-display text-4xl md:text-5xl text-spice mb-3 tracking-wider">
          Dune: Imperium
        </h1>
        <p className="text-sand-dark text-lg tracking-widest uppercase">
          Tournament Manager
        </p>
        <div className="w-24 h-px bg-spice/40 mx-auto mt-6" />
      </motion.div>

      {/* Saved tournaments (server mode) */}
      {apiMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <p className="text-sand-dark/80 text-sm uppercase tracking-widest">Tournaments</p>
            <button onClick={refresh} className="text-sand-dark hover:text-spice" aria-label="Refresh list">
              <RefreshCw size={14} />
            </button>
          </div>
          {listError && <p className="text-center text-xs text-blood mb-3">{listError}</p>}
          {tournaments.length === 0 && !listError && (
            <p className="text-center text-xs text-sand-dark/60 uppercase tracking-widest">No tournaments yet</p>
          )}
          <div className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
            {tournaments.map((t) => {
              const Icon = MODE_ICONS[t.mode] ?? Swords;
              return (
                <div key={t.id} className="stone-card p-4 flex items-center gap-3">
                  <Icon size={20} className="text-spice shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-display text-sm text-sand truncate">{t.name}</p>
                    <p className="text-[10px] text-sand-dark uppercase tracking-widest">
                      {PHASE_LABELS[t.phase] ?? t.phase} &middot; {t.playerCount} players &middot;{" "}
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenTournament(t.id)}
                    className="btn-imperial text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <FolderOpen size={12} /> Open
                  </button>
                  <button onClick={() => handleDelete(t)} className="p-1 text-sand-dark hover:text-blood" aria-label={`Delete ${t.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-center text-sand-dark/80 mb-8 text-sm uppercase tracking-widest"
      >
        {apiMode ? "Or start a new tournament" : "Choose your tournament format"}
      </motion.p>

      {/* Template Cards */}
      <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
        {FORMAT_TEMPLATES.map((t, i) => {
          const Icon = MODE_ICONS[t.mode];
          const isSelected = selected === t.id;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                setSelected(t.id);
                setTierPresetId(t.tierPresetId);
              }}
              className={`stone-card p-6 text-left cursor-pointer group transition-all ${
                isSelected ? "border-spice/60 spice-glow" : "hover:border-spice/40"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-sm bg-spice/10 text-spice group-hover:bg-spice/20 transition-colors">
                  <Icon size={24} />
                </div>
                <div>
                  <h2 className="text-display text-xl text-spice tracking-wide">{t.name}</h2>
                  <p className="text-sand-dark/60 text-xs uppercase tracking-widest">
                    {t.mode === "custom" ? "Fully configurable" : `${t.mode} format`}
                  </p>
                </div>
              </div>
              <p className="text-sm text-sand-dark/80 mb-3">{t.description}</p>
              <ul className="space-y-1 text-xs text-sand-dark/80">
                {t.format.stages.map((stage) => (
                  <li key={stage.id} className="flex items-start gap-2">
                    <span className="text-spice/60 mt-0.5">&#x25B8;</span>
                    <span>
                      <span className="text-sand">{stage.name}</span>
                      {stage.kind === "rounds" ? ` — ${stage.rounds} round${stage.rounds === 1 ? "" : "s"}` : ""}
                      {stage.advancement.kind === "top-n" && ` · top ${stage.advancement.n}`}
                      {stage.advancement.kind === "table-winners" && ` · best ${stage.advancement.perTable} per table`}
                      {stage.tierRules.length > 0 && ` · tiers ${[...new Set(stage.tierRules.map(describeTierRule))].join(", ")}`}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>

      {/* Create panel */}
      {template && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-morphism-strong rounded-sm p-6 max-w-2xl mx-auto mt-8"
        >
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <label className="flex flex-col gap-1">
              <span className="uppercase tracking-widest text-sand-dark">Tournament name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={template.mode === "classic" ? "Dune Bloodlines Open" : `Dune Bloodlines ${template.name}`}
                className="input-imperial text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="uppercase tracking-widest text-sand-dark">Leader tiers</span>
              <select
                value={tierPresetId}
                onChange={(e) => setTierPresetId(e.target.value)}
                className="input-imperial text-sm"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-sand-dark mt-3">
            Stages, points, tiers and the chess clock can be changed afterwards in Settings.
          </p>
          <div className="text-center mt-5">
            <button
              onClick={() => onCreate(template.id, tierPresetId || template.tierPresetId, name)}
              disabled={busy}
              className="btn-imperial-filled py-3 px-10 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Trophy size={18} />
              Create {template.name} Tournament
            </button>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="text-center mt-12"
      >
        <p className="text-sand-dark/40 text-xs uppercase tracking-widest">
          The spice must flow
        </p>
      </motion.div>
    </div>
  );
}
