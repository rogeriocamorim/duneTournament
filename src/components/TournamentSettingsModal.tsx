import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Plus, Trash2, ArrowUp, ArrowDown, Layers, Trophy, Timer, Crown, Grid3x3, AlertTriangle, Save,
} from "lucide-react";
import type {
  Advancement,
  ClockConfig,
  PairingMethod,
  StageConfig,
  TierDef,
  TierRule,
  TournamentFormat,
  TournamentState,
} from "../engine/types";
import { LEADER_LIST } from "../engine/types";
import {
  DEFAULT_CLOCK,
  DEFAULT_PLACEMENT_POINTS,
  TIER_COLORS,
  TIER_PRESETS,
  computeClockPenalty,
  createStage,
  describeTierRule,
  getFormat,
  getStageRounds,
  getTierLeaderNames,
  getTiers,
  projectStages,
} from "../engine/format";
import type { ServerTierPreset } from "../api/client";
import { isApiMode, listTierPresets, saveTierPreset } from "../api/client";

interface TournamentSettingsModalProps {
  isOpen: boolean;
  state: TournamentState;
  onClose: () => void;
  onSave: (format: TournamentFormat, tiers: TierDef[]) => void;
}

type SettingsTab = "format" | "scoring" | "tiers" | "stage-tiers";

const PAIRING_LABELS: Record<PairingMethod, string> = {
  "swiss-golf": "Swiss (balanced, no rematches)",
  "random": "Random (no rematches when possible)",
  "seeded-snake": "Seeded snake (1-8-9-16 / 2-7-10-15 …)",
  "seeded-block": "Seeded blocks (1-4 / 5-8 …)",
  "groups-fixed": "Fixed groups of 8 (Colosseum schedule)",
  "manual": "Manual (organizer seats every table)",
};

const STAGE_KIND_LABELS: Record<StageConfig["kind"], string> = {
  "rounds": "Rounds",
  "classic-bracket": "Top 16 double-chance bracket",
  "colosseum-bracket": "Colosseum knockout bracket",
};

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"];

/** Parse a number input, keeping the previous value on garbage */
function num(value: string, fallback: number): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function TournamentSettingsModal({ isOpen, state, onClose, onSave }: TournamentSettingsModalProps) {
  // The dialog is mounted on open, so every opening starts from the saved settings
  return (
    <AnimatePresence>
      {isOpen && <SettingsDialog state={state} onClose={onClose} onSave={onSave} />}
    </AnimatePresence>
  );
}

interface SettingsDialogProps {
  state: TournamentState;
  onClose: () => void;
  onSave: (format: TournamentFormat, tiers: TierDef[]) => void;
}

function SettingsDialog({ state, onClose, onSave }: SettingsDialogProps) {
  const [tab, setTab] = useState<SettingsTab>("format");
  const [format, setFormat] = useState<TournamentFormat>(() => structuredClone(getFormat(state)));
  const [tiers, setTiers] = useState<TierDef[]>(() => structuredClone(getTiers(state)));
  const [serverPresets, setServerPresets] = useState<ServerTierPreset[]>([]);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isApiMode()) return;
    listTierPresets().then(setServerPresets).catch(() => setServerPresets([]));
  }, []);

  const isCustom = state.mode === "custom";
  const started = state.phase !== "registration" && state.phase !== "home";
  const currentStage = isCustom ? state.currentStage ?? 0 : state.phase === "qualifying" || state.phase === "group-draw" ? 0 : 1;

  /** Stages that already started keep their structure */
  const structureLocked = (index: number) => started && index <= currentStage;

  const projections = useMemo(() => projectStages(format, state.players.length), [format, state.players.length]);
  const errors = useMemo(() => {
    // Player-count problems are shown per stage as warnings; these block saving
    const list: string[] = [];
    if (format.stages.length === 0) list.push("Add at least one stage.");
    if (format.stages.some((s) => s.rounds < 1)) list.push("Every stage needs at least 1 round.");
    if (format.stages.some((s, i) => i > 0 && s.advancement.kind === "top-n" && (s.advancement.n ?? 0) % 4 !== 0)) {
      list.push("Top N must be a multiple of 4 (tables always seat 4).");
    }
    const codes = tiers.map((t) => t.code.trim());
    if (codes.some((c) => !c)) list.push("Every tier needs a code.");
    if (new Set(codes).size !== codes.length) list.push("Tier codes must be unique.");
    format.stages.forEach((stage) => {
      for (const rule of stage.tierRules) {
        for (const code of rule.tierCodes) {
          if (!codes.includes(code)) list.push(`${stage.name}: tier "${code}" does not exist.`);
        }
      }
    });
    if (format.placementPoints.length !== 4) list.push("Placement points need 4 values.");
    return list;
  }, [format, tiers]);

  // ── Format mutations ──
  const updateStage = (index: number, patch: Partial<StageConfig>) => {
    setFormat((f) => ({ ...f, stages: f.stages.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  };
  const moveStage = (index: number, delta: number) => {
    setFormat((f) => {
      const stages = [...f.stages];
      const target = index + delta;
      if (target < 0 || target >= stages.length) return f;
      [stages[index], stages[target]] = [stages[target], stages[index]];
      return { ...f, stages };
    });
  };
  const removeStage = (index: number) => {
    setFormat((f) => ({ ...f, stages: f.stages.filter((_, i) => i !== index) }));
  };
  const addStage = () => {
    setFormat((f) => ({ ...f, stages: [...f.stages, createStage(f.stages.length, tiers.map((t) => t.code))] }));
  };
  const setClock = (patch: Partial<ClockConfig>) => {
    setFormat((f) => ({ ...f, clock: { ...DEFAULT_CLOCK, ...f.clock, ...patch } }));
  };

  // ── Tier mutations ──
  const updateTier = (index: number, patch: Partial<TierDef>) => {
    setTiers((ts) => ts.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };
  const renameTierCode = (index: number, code: string) => {
    const old = tiers[index].code;
    updateTier(index, { code });
    // Keep stage rules pointing at the renamed tier
    setFormat((f) => ({
      ...f,
      stages: f.stages.map((s) => ({
        ...s,
        tierRules: s.tierRules.map((r) => ({ ...r, tierCodes: r.tierCodes.map((c) => (c === old ? code : c)) })),
      })),
    }));
  };
  const moveLeader = (leaderId: string, toTierIndex: number | null) => {
    setTiers((ts) => ts.map((t, i) => {
      const without = t.leaderIds.filter((id) => id !== leaderId);
      return i === toTierIndex ? { ...t, leaderIds: [...without, leaderId] } : { ...t, leaderIds: without };
    }));
  };
  const addTier = () => {
    const used = new Set(tiers.map((t) => t.code));
    const code = ["S", "A", "B", "C", "D", "E", "F", "G"].find((c) => !used.has(c)) ?? `T${tiers.length + 1}`;
    setTiers((ts) => [...ts, { code, label: `${code} Tier`, color: TIER_COLORS[code] ?? "#c5a059", leaderIds: [] }]);
  };
  const removeTier = (index: number) => {
    setTiers((ts) => ts.filter((_, i) => i !== index));
  };
  const loadPreset = (presetTiers: TierDef[]) => {
    if (!confirm("Replace the current tiers with this preset?")) return;
    setTiers(structuredClone(presetTiers));
  };
  const saveAsPreset = async () => {
    const name = prompt("Preset name", `${state.metadata.tournamentName} tiers`);
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `preset-${Date.now()}`;
    try {
      const saved = await saveTierPreset({ id, name, description: "", tiers });
      setServerPresets((prev) => [...prev.filter((p) => p.id !== saved.id), saved]);
      setPresetMessage(`Saved preset "${saved.name}".`);
    } catch (err) {
      setPresetMessage(`Could not save preset: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Tier rule mutations ──
  const updateRule = (stageIndex: number, ruleIndex: number, patch: Partial<TierRule>) => {
    const stage = format.stages[stageIndex];
    updateStage(stageIndex, {
      tierRules: stage.tierRules.map((r, i) => (i === ruleIndex ? { ...r, ...patch } : r)),
    });
  };
  const addRule = (stageIndex: number) => {
    const stage = format.stages[stageIndex];
    const usedRounds = new Set(stage.tierRules.map((r) => r.roundInStage));
    const round = Array.from({ length: stage.rounds }, (_, i) => i + 1).find((r) => !usedRounds.has(r));
    updateStage(stageIndex, {
      tierRules: [...stage.tierRules, { roundInStage: round, tierCodes: tiers.slice(0, 1).map((t) => t.code), selection: "all" }],
    });
  };
  const removeRule = (stageIndex: number, ruleIndex: number) => {
    const stage = format.stages[stageIndex];
    updateStage(stageIndex, { tierRules: stage.tierRules.filter((_, i) => i !== ruleIndex) });
  };

  const assigned = new Set(tiers.flatMap((t) => t.leaderIds));
  const unassigned = LEADER_LIST.filter((l) => !assigned.has(l.id));

  const handleSave = () => {
    if (errors.length > 0) return;
    onSave(format, tiers.map((t) => ({ ...t, code: t.code.trim() })));
    onClose();
  };

  const tabButton = (key: SettingsTab, label: string, Icon: typeof Layers) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-widest transition-all ${
        tab === key ? "text-spice border-b-2 border-spice" : "text-sand-dark hover:text-sand"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
        <>
          <motion.div
            className="fixed inset-0 bg-black/80 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
          >
            <div className="glass-morphism-strong rounded-sm p-4 sm:p-6 max-w-4xl w-full my-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-display text-lg text-spice">Tournament Settings</h3>
                <button onClick={onClose} className="text-sand-dark hover:text-spice p-1" aria-label="Close settings">
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-sand-dark mb-4">
                {state.metadata.tournamentName} &middot; {state.players.length} players &middot; Tables always seat 4.
                {started && " Changes apply to rounds generated from now on."}
              </p>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b border-white/10 mb-5">
                {tabButton("format", "Format", Layers)}
                {tabButton("scoring", "Points & Clock", Trophy)}
                {tabButton("tiers", "Tiers", Crown)}
                {tabButton("stage-tiers", "Stage Tiers", Grid3x3)}
              </div>

              {/* ===== FORMAT ===== */}
              {tab === "format" && (
                <div className="space-y-4">
                  {format.stages.map((stage, i) => {
                    const projection = projections[i];
                    const locked = structureLocked(i);
                    const generated = isCustom
                      ? getStageRounds(state, i).length
                      : i === 0 ? state.rounds.filter((r) => r.type === "qualifying").length : 0;
                    const genericStage = stage.kind === "rounds";
                    return (
                      <div key={stage.id} className="stone-card rounded-sm p-4">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="text-score fremen-glow">{i + 1}</span>
                          <input
                            value={stage.name}
                            onChange={(e) => updateStage(i, { name: e.target.value })}
                            className="input-imperial text-sm py-1 flex-1 min-w-[10rem]"
                            aria-label="Stage name"
                          />
                          <span className="text-[10px] uppercase tracking-widest text-sand-dark">
                            {STAGE_KIND_LABELS[stage.kind]}
                          </span>
                          {isCustom && (
                            <div className="flex gap-1 ml-auto">
                              <button onClick={() => moveStage(i, -1)} disabled={locked || i === 0 || structureLocked(i - 1)} className="p-1 text-sand-dark hover:text-spice disabled:opacity-30" aria-label="Move stage up"><ArrowUp size={14} /></button>
                              <button onClick={() => moveStage(i, 1)} disabled={locked || i === format.stages.length - 1} className="p-1 text-sand-dark hover:text-spice disabled:opacity-30" aria-label="Move stage down"><ArrowDown size={14} /></button>
                              <button onClick={() => removeStage(i)} disabled={locked || format.stages.length === 1} className="p-1 text-sand-dark hover:text-blood disabled:opacity-30" aria-label="Remove stage"><Trash2 size={14} /></button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Rounds */}
                          <label className="flex flex-col gap-1">
                            <span className="uppercase tracking-widest text-sand-dark">Rounds</span>
                            <input
                              type="number"
                              min={Math.max(1, generated)}
                              max={20}
                              value={stage.rounds}
                              disabled={!genericStage || state.mode === "colosseum"}
                              onChange={(e) => {
                                const rounds = Math.max(Math.max(1, generated), Math.min(20, Math.round(num(e.target.value, stage.rounds))));
                                updateStage(i, { rounds });
                              }}
                              className="input-imperial text-sm py-1 disabled:opacity-50"
                            />
                          </label>

                          {/* Pairing */}
                          <label className="flex flex-col gap-1">
                            <span className="uppercase tracking-widest text-sand-dark">Table distribution</span>
                            <select
                              value={stage.pairing}
                              disabled={!isCustom || locked}
                              onChange={(e) => updateStage(i, { pairing: e.target.value as PairingMethod })}
                              className="input-imperial text-sm py-1 disabled:opacity-50"
                            >
                              {(Object.keys(PAIRING_LABELS) as PairingMethod[]).map((p) => (
                                <option key={p} value={p}>{PAIRING_LABELS[p]}</option>
                              ))}
                            </select>
                          </label>

                          {/* Advancement */}
                          <label className="flex flex-col gap-1">
                            <span className="uppercase tracking-widest text-sand-dark">Who plays this stage</span>
                            {i === 0 ? (
                              <span className="input-imperial text-sm py-1 opacity-60">All registered players</span>
                            ) : (
                              <div className="flex gap-2">
                                <select
                                  value={stage.advancement.kind}
                                  disabled={!isCustom || locked}
                                  onChange={(e) => {
                                    const kind = e.target.value as Advancement["kind"];
                                    updateStage(i, {
                                      advancement: kind === "top-n" ? { kind, n: 8 } : kind === "table-winners" ? { kind, perTable: 1 } : { kind },
                                    });
                                  }}
                                  className="input-imperial text-sm py-1 flex-1 disabled:opacity-50"
                                >
                                  <option value="all">Everyone from the previous stage</option>
                                  <option value="top-n">Top N of the previous stage</option>
                                  <option value="table-winners">Best of each table (last round)</option>
                                </select>
                                {stage.advancement.kind === "top-n" && (
                                  <input
                                    type="number"
                                    min={4}
                                    step={4}
                                    value={stage.advancement.n ?? 8}
                                    disabled={!isCustom || locked}
                                    onChange={(e) => updateStage(i, { advancement: { kind: "top-n", n: Math.max(1, Math.round(num(e.target.value, 8))) } })}
                                    className="input-imperial text-sm py-1 w-20 disabled:opacity-50"
                                    aria-label="Number of players advancing"
                                  />
                                )}
                                {stage.advancement.kind === "table-winners" && (
                                  <select
                                    value={stage.advancement.perTable ?? 1}
                                    disabled={!isCustom || locked}
                                    onChange={(e) => updateStage(i, { advancement: { kind: "table-winners", perTable: Number(e.target.value) } })}
                                    className="input-imperial text-sm py-1 w-24 disabled:opacity-50"
                                    aria-label="Players advancing per table"
                                  >
                                    {[1, 2, 3].map((n) => <option key={n} value={n}>Top {n}</option>)}
                                  </select>
                                )}
                              </div>
                            )}
                          </label>

                          {/* Ranking basis */}
                          <label className="flex items-center gap-2 mt-5">
                            <input
                              type="checkbox"
                              checked={stage.carryPoints}
                              disabled={!isCustom}
                              onChange={(e) => updateStage(i, { carryPoints: e.target.checked })}
                            />
                            <span className="text-sand">Carry points from earlier stages into this stage's ranking</span>
                          </label>

                          {/* Placement override */}
                          <div className="flex flex-col gap-1 sm:col-span-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!stage.placementPoints}
                                onChange={(e) => updateStage(i, { placementPoints: e.target.checked ? [...format.placementPoints] : undefined })}
                              />
                              <span className="text-sand">Own placement points for this stage</span>
                            </label>
                            {stage.placementPoints && (
                              <div className="flex gap-2 flex-wrap">
                                {stage.placementPoints.map((p, pi) => (
                                  <label key={pi} className="flex items-center gap-1">
                                    <span className="text-sand-dark">{POSITION_LABELS[pi]}</span>
                                    <input
                                      type="number"
                                      value={p}
                                      onChange={(e) => {
                                        const pts = [...stage.placementPoints!];
                                        pts[pi] = num(e.target.value, p);
                                        updateStage(i, { placementPoints: pts });
                                      }}
                                      className="input-imperial text-sm py-1 w-16"
                                    />
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Clock override */}
                          {format.clock.enabled && (
                            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={stage.clockEnabled !== false}
                                  onChange={(e) => updateStage(i, { clockEnabled: e.target.checked })}
                                />
                                <span className="text-sand">Chess clock in this stage</span>
                              </label>
                              {stage.clockEnabled !== false && (
                                <label className="flex items-center gap-1">
                                  <span className="text-sand-dark">Budget (min)</span>
                                  <input
                                    type="number"
                                    min={1}
                                    placeholder={String(format.clock.budgetMinutes)}
                                    value={stage.clockBudgetMinutes ?? ""}
                                    onChange={(e) => updateStage(i, {
                                      clockBudgetMinutes: e.target.value === "" ? null : Math.max(1, num(e.target.value, format.clock.budgetMinutes)),
                                    })}
                                    className="input-imperial text-sm py-1 w-20"
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Projection */}
                        {projection && (
                          <p className={`text-[11px] mt-3 uppercase tracking-widest ${projection.errors.length ? "text-blood" : "text-fremen-blue"}`}>
                            {projection.errors.length
                              ? projection.errors.join(" ")
                              : genericStage
                              ? `${projection.players} players → ${projection.tables} table${projection.tables === 1 ? "" : "s"} × ${stage.rounds} round${stage.rounds === 1 ? "" : "s"}`
                              : `${projection.players} players enter the bracket`}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {isCustom && (
                    <button onClick={addStage} className="btn-imperial text-xs py-2 px-4 flex items-center gap-2">
                      <Plus size={14} /> Add Stage
                    </button>
                  )}
                  {!isCustom && (
                    <p className="text-xs text-sand-dark">
                      {state.mode === "classic" ? "Classic" : "Colosseum"} keeps its bracket structure. Create a tournament from a
                      custom template to change stages, distribution and advancement.
                    </p>
                  )}
                </div>
              )}

              {/* ===== POINTS & CLOCK ===== */}
              {tab === "scoring" && (
                <div className="space-y-6 text-xs">
                  <div className="stone-card rounded-sm p-4">
                    <p className="text-display text-sm text-spice mb-3">Tournament points per placement</p>
                    <div className="flex gap-3 flex-wrap">
                      {format.placementPoints.map((p, pi) => (
                        <label key={pi} className="flex flex-col gap-1 items-center">
                          <span className="uppercase tracking-widest text-sand-dark">{POSITION_LABELS[pi]}</span>
                          <input
                            type="number"
                            value={p}
                            onChange={(e) => {
                              const pts = [...format.placementPoints];
                              pts[pi] = num(e.target.value, p);
                              setFormat((f) => ({ ...f, placementPoints: pts }));
                            }}
                            className="input-imperial text-center text-sm py-1 w-20"
                          />
                        </label>
                      ))}
                      <button
                        onClick={() => setFormat((f) => ({ ...f, placementPoints: [...DEFAULT_PLACEMENT_POINTS] }))}
                        className="text-sand-dark hover:text-spice self-end pb-1 uppercase tracking-widest"
                      >
                        Reset 6/3/2/1
                      </button>
                    </div>
                    <p className="text-sand-dark mt-2">Stages can override these on the Format tab.</p>
                  </div>

                  <div className="stone-card rounded-sm p-4">
                    <label className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={format.clock.enabled}
                        onChange={(e) => setClock({ enabled: e.target.checked })}
                      />
                      <Timer size={14} className="text-fremen-blue" />
                      <span className="text-display text-sm text-spice">Chess clock</span>
                    </label>
                    {format.clock.enabled && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <label className="flex flex-col gap-1">
                            <span className="uppercase tracking-widest text-sand-dark">Minutes per player</span>
                            <input type="number" min={1} value={format.clock.budgetMinutes}
                              onChange={(e) => setClock({ budgetMinutes: Math.max(1, num(e.target.value, format.clock.budgetMinutes)) })}
                              className="input-imperial text-sm py-1" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="uppercase tracking-widest text-sand-dark">Points lost / minute over</span>
                            <input type="number" min={0} step="0.5" value={format.clock.penaltyPerMinute}
                              onChange={(e) => setClock({ penaltyPerMinute: Math.max(0, num(e.target.value, format.clock.penaltyPerMinute)) })}
                              className="input-imperial text-sm py-1" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="uppercase tracking-widest text-sand-dark">Max penalty / game</span>
                            <input type="number" min={0} placeholder="No cap" value={format.clock.penaltyCap ?? ""}
                              onChange={(e) => setClock({ penaltyCap: e.target.value === "" ? null : Math.max(0, num(e.target.value, 0)) })}
                              className="input-imperial text-sm py-1" />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="uppercase tracking-widest text-sand-dark">Partial minutes</span>
                            <select value={format.clock.rounding}
                              onChange={(e) => setClock({ rounding: e.target.value as ClockConfig["rounding"] })}
                              className="input-imperial text-sm py-1">
                              <option value="started-minute">Count as a full minute</option>
                              <option value="full-minute">Ignore</option>
                            </select>
                          </label>
                        </div>
                        <p className="text-sand-dark mt-3">
                          Example: a player who uses {format.clock.budgetMinutes + 2.5} min loses{" "}
                          <span className="text-blood">{computeClockPenalty(format.clock.budgetMinutes + 2.5, format.clock)}</span>{" "}
                          tournament point(s) for that game. Organizers enter the minutes used when recording results.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ===== TIERS ===== */}
              {tab === "tiers" && (
                <div className="space-y-4 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="uppercase tracking-widest text-sand-dark">Load preset:</span>
                    {TIER_PRESETS.map((p) => (
                      <button key={p.id} onClick={() => loadPreset(p.tiers)} className="btn-imperial text-xs py-1 px-3" title={p.description}>
                        {p.name}
                      </button>
                    ))}
                    {serverPresets.map((p) => (
                      <button key={p.id} onClick={() => loadPreset(p.tiers)} className="btn-imperial text-xs py-1 px-3" title={p.description}>
                        {p.name}
                      </button>
                    ))}
                    {isApiMode() && (
                      <button onClick={saveAsPreset} className="text-fremen-blue hover:text-spice uppercase tracking-widest ml-auto flex items-center gap-1">
                        <Save size={12} /> Save as preset
                      </button>
                    )}
                  </div>
                  {presetMessage && <p className="text-fremen-blue">{presetMessage}</p>}

                  {tiers.map((tier, ti) => (
                    <div key={ti} className="stone-card rounded-sm p-3" style={{ borderLeft: `4px solid ${tier.color}` }}>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <input
                          value={tier.code}
                          onChange={(e) => renameTierCode(ti, e.target.value.replace(/\s|\+|\//g, "").slice(0, 4))}
                          className="input-imperial text-sm py-1 w-16 text-center font-bold"
                          aria-label="Tier code"
                        />
                        <input
                          value={tier.label}
                          onChange={(e) => updateTier(ti, { label: e.target.value })}
                          className="input-imperial text-sm py-1 flex-1 min-w-[8rem]"
                          aria-label="Tier label"
                        />
                        <input
                          type="color"
                          value={tier.color}
                          onChange={(e) => updateTier(ti, { color: e.target.value })}
                          className="w-8 h-8 bg-transparent border-0 cursor-pointer"
                          aria-label="Tier color"
                        />
                        <button onClick={() => removeTier(ti)} className="p-1 text-sand-dark hover:text-blood" aria-label="Remove tier">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tier.leaderIds.map((id) => {
                          const leader = LEADER_LIST.find((l) => l.id === id);
                          return (
                            <span key={id} className="inline-flex items-center gap-1 glass-morphism px-2 py-1 rounded-sm">
                              <span className="text-sand">{leader?.name ?? id}</span>
                              <select
                                value={ti}
                                onChange={(e) => moveLeader(id, e.target.value === "none" ? null : Number(e.target.value))}
                                className="bg-transparent text-sand-dark text-[10px] border-0 cursor-pointer"
                                aria-label={`Move ${leader?.name ?? id}`}
                                title="Move to tier"
                              >
                                {tiers.map((t, idx) => <option key={idx} value={idx}>{t.code}</option>)}
                                <option value="none">—</option>
                              </select>
                            </span>
                          );
                        })}
                        {tier.leaderIds.length === 0 && <span className="text-sand-dark italic">No leaders yet</span>}
                      </div>
                    </div>
                  ))}

                  <button onClick={addTier} className="btn-imperial text-xs py-2 px-4 flex items-center gap-2">
                    <Plus size={14} /> Add Tier
                  </button>

                  <div className="glass-morphism rounded-sm p-3">
                    <p className="uppercase tracking-widest text-sand-dark mb-2">Leaders without a tier ({unassigned.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {unassigned.map((l) => (
                        <span key={l.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-white/10">
                          <span className="text-sand-dark">{l.name}</span>
                          <select
                            value=""
                            onChange={(e) => e.target.value !== "" && moveLeader(l.id, Number(e.target.value))}
                            className="bg-transparent text-spice text-[10px] border-0 cursor-pointer"
                            aria-label={`Add ${l.name} to a tier`}
                          >
                            <option value="">+ tier</option>
                            {tiers.map((t, idx) => <option key={idx} value={idx}>{t.code}</option>)}
                          </select>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ===== STAGE TIERS ===== */}
              {tab === "stage-tiers" && (
                <div className="space-y-4 text-xs">
                  <p className="text-sand-dark">
                    Choose which tiers supply the leader pool in each round. A rule without a round applies to every round
                    that has no rule of its own. Several tiers are combined (S+A) unless &ldquo;one at random&rdquo; is on.
                  </p>
                  {format.stages.map((stage, si) => (
                    <div key={stage.id} className="stone-card rounded-sm p-4">
                      <p className="text-display text-sm text-spice mb-3">{stage.name}</p>
                      <div className="space-y-2">
                        {stage.tierRules.map((rule, ri) => {
                          const poolCount = getTierLeaderNames(tiers, rule.tierCodes).length;
                          return (
                            <div key={ri} className="flex flex-wrap items-center gap-2 glass-morphism rounded-sm p-2">
                              <select
                                value={rule.roundInStage ?? ""}
                                onChange={(e) => updateRule(si, ri, { roundInStage: e.target.value === "" ? undefined : Number(e.target.value) })}
                                className="input-imperial text-xs py-1"
                                aria-label="Round"
                              >
                                <option value="">All rounds</option>
                                {Array.from({ length: stage.rounds }, (_, r) => (
                                  <option key={r} value={r + 1}>Round {r + 1}</option>
                                ))}
                              </select>
                              <div className="flex gap-1">
                                {tiers.map((t) => {
                                  const on = rule.tierCodes.includes(t.code);
                                  return (
                                    <button
                                      key={t.code}
                                      onClick={() => updateRule(si, ri, {
                                        tierCodes: on ? rule.tierCodes.filter((c) => c !== t.code) : [...rule.tierCodes, t.code],
                                      })}
                                      className="w-7 h-7 rounded-sm border text-xs font-bold"
                                      style={on
                                        ? { color: "#0b0b0b", background: t.color, borderColor: t.color }
                                        : { color: t.color, borderColor: `${t.color}55` }}
                                      aria-pressed={on}
                                      title={t.label}
                                    >
                                      {t.code}
                                    </button>
                                  );
                                })}
                              </div>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={!!rule.randomOneOf}
                                  onChange={(e) => updateRule(si, ri, { randomOneOf: e.target.checked })}
                                />
                                <span className="text-sand">one at random</span>
                              </label>
                              <select
                                value={rule.selection}
                                onChange={(e) => updateRule(si, ri, {
                                  selection: e.target.value as TierRule["selection"],
                                  poolSize: e.target.value === "random-n" ? rule.poolSize ?? 5 : undefined,
                                })}
                                className="input-imperial text-xs py-1"
                                aria-label="Pool"
                              >
                                <option value="all">All leaders of the tier(s)</option>
                                <option value="random-n">Draw N leaders</option>
                              </select>
                              {rule.selection === "random-n" && (
                                <input
                                  type="number"
                                  min={1}
                                  value={rule.poolSize ?? 5}
                                  onChange={(e) => updateRule(si, ri, { poolSize: Math.max(1, Math.round(num(e.target.value, 5))) })}
                                  className="input-imperial text-xs py-1 w-14"
                                  aria-label="Pool size"
                                />
                              )}
                              <span className="text-sand-dark ml-auto">
                                {describeTierRule(rule)} &middot; {rule.randomOneOf ? "per tier" : `${poolCount} leaders`}
                              </span>
                              <button onClick={() => removeRule(si, ri)} className="p-1 text-sand-dark hover:text-blood" aria-label="Remove rule">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {stage.tierRules.length === 0 && (
                          <p className="text-sand-dark italic">No tier restriction &mdash; any leader can be played.</p>
                        )}
                      </div>
                      <button onClick={() => addRule(si)} className="mt-2 text-spice hover:text-sand uppercase tracking-widest flex items-center gap-1">
                        <Plus size={12} /> Add rule
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Errors + actions */}
              {errors.length > 0 && (
                <div className="mt-5 px-3 py-2 rounded-sm bg-blood/20 border border-blood/50 space-y-1">
                  {errors.map((e) => (
                    <p key={e} className="text-xs text-red-400 flex items-start gap-2">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {e}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={onClose} className="btn-imperial text-sm py-2">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={errors.length > 0}
                  className="btn-imperial-filled text-sm py-2 px-6 disabled:opacity-40"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </motion.div>
        </>
  );
}
