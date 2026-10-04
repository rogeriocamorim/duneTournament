import { motion } from "motion/react";
import { useState } from "react";
import type { Round, StatsPhase, TierDef } from "../engine/types";
import { getLeaderStatsByPhase } from "../engine/tournament";
import { TIER_PRESETS, getTierColor } from "../engine/format";
import { Layers, Swords, Trophy } from "lucide-react";

interface LeaderStatsPanelProps {
  rounds: Round[];
  /** Tournament tiers (defaults to the classic A/B/C tiers) */
  tiers?: TierDef[];
}

/** Inline badge style for a tier code */
function tierBadgeStyle(tiers: TierDef[], code: string) {
  if (code === "none" || !tiers.some((t) => t.code === code)) {
    return { color: "#a8a29e", background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" };
  }
  const color = getTierColor(tiers, code);
  return { color, background: `${color}33`, borderColor: `${color}66` };
}

const PHASE_OPTIONS: { key: StatsPhase; label: string; icon: typeof Layers }[] = [
  { key: "all", label: "Overall", icon: Layers },
  { key: "qualifying", label: "Groups", icon: Swords },
  { key: "bracket", label: "Bracket", icon: Trophy },
];

const BRACKET_TYPES = new Set(["semifinal", "winners-final", "losers-final", "grand-final", "stage"]);

export function LeaderStatsPanel({ rounds, tiers = TIER_PRESETS[1].tiers }: LeaderStatsPanelProps) {
  const [phase, setPhase] = useState<StatsPhase>("all");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Filter completed rounds visible for the current phase
  const phaseRounds = rounds.filter((r) => {
    if (!r.isComplete) return false;
    if (phase === "qualifying") return r.type === "qualifying";
    if (phase === "bracket") return BRACKET_TYPES.has(r.type);
    return true;
  });

  const hasQualifying = rounds.some((r) => r.isComplete && r.type === "qualifying");
  const hasBracket = rounds.some((r) => r.isComplete && BRACKET_TYPES.has(r.type));

  // Reset round selection when phase changes and round is out of scope
  const validRoundNums = new Set(phaseRounds.map((r) => r.number));
  const effectiveRound = selectedRound !== null && validRoundNums.has(selectedRound) ? selectedRound : null;

  const stats = getLeaderStatsByPhase(rounds, phase, effectiveRound ?? undefined, tiers);

  if (stats.length === 0 && phaseRounds.length === 0) {
    return (
      <div className="text-center py-12 text-sand-dark text-sm uppercase tracking-widest">
        No leader data recorded yet.
        <br />
        <span className="text-xs opacity-60 normal-case tracking-normal mt-2 block">
          Select a leader for each player when confirming table results.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase filter */}
      <div className="flex items-center justify-center gap-3">
        {PHASE_OPTIONS.map(({ key, label, icon: Icon }) => {
          const disabled =
            (key === "qualifying" && !hasQualifying) ||
            (key === "bracket" && !hasBracket);
          return (
            <button
              key={key}
              onClick={() => { setPhase(key); setSelectedRound(null); }}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs uppercase tracking-widest rounded-sm transition-all ${
                phase === key
                  ? "bg-spice/20 text-spice border border-spice/40"
                  : disabled
                  ? "text-sand-dark/30 border border-white/5 cursor-not-allowed"
                  : "glass-morphism text-sand hover:text-spice border border-sand-dark/40 hover:border-spice/40"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Round filter */}
      {phaseRounds.length > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedRound(null)}
            className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
              effectiveRound === null
                ? "bg-spice/20 text-spice border border-spice/40"
                : "glass-morphism text-sand hover:text-spice border border-sand-dark/40 hover:border-spice/40"
            }`}
          >
            All Rounds
          </button>
          {phaseRounds.map((r) => (
            <button
              key={r.number}
              onClick={() => setSelectedRound(r.number)}
              className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
                effectiveRound === r.number
                  ? "bg-spice/20 text-spice border border-spice/40"
                  : "glass-morphism text-sand hover:text-spice border border-sand-dark/40 hover:border-spice/40"
              }`}
            >
              R{r.number}
            </button>
          ))}
        </div>
      )}

      {/* Stats table */}
      <div className="overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_4rem_3.5rem_5rem] gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] opacity-50 min-w-[480px]">
          <span>T</span>
          <span>Leader</span>
          <span className="text-center">Plays</span>
          <span className="text-center">Wins</span>
          <span className="text-right">Avg VP</span>
          <span className="text-right">Avg P</span>
          <span className="text-right">Win Rate</span>
        </div>

        {/* Rows */}
        {stats.map((stat, index) => {
          return (
            <motion.div
              key={stat.leader}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_4rem_3.5rem_5rem] gap-2 px-4 py-3 rounded-sm glass-morphism mb-1 min-w-[480px]"
            >
              {/* Tier badge */}
              <span
                className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-sm border"
                style={tierBadgeStyle(tiers, stat.tier)}
                title={`Tier ${stat.tier}`}
              >
                {stat.tier === "none" ? "—" : stat.tier}
              </span>

              <span className="text-display text-sm truncate self-center" title={stat.leader}>
                {stat.leader}
              </span>
              <span className="text-score text-sm text-center opacity-70 self-center">
                {stat.plays}
              </span>
              <span className="text-score text-sm text-center text-spice self-center">
                {stat.wins}
              </span>
              <span className="text-score text-sm text-right opacity-70 self-center">
                {stat.plays > 0 ? (stat.totalVP / stat.plays).toFixed(1) : "—"}
              </span>
              <span className="text-score text-sm text-right opacity-70 self-center" title="Average finishing position (lower is better)">
                {stat.avgPosition > 0 ? stat.avgPosition.toFixed(1) : "—"}
              </span>
              <span
                className={`text-score text-sm text-right font-bold self-center ${
                  stat.winRate >= 50
                    ? "text-[#FFD700]"
                    : stat.winRate >= 25
                    ? "text-spice"
                    : "text-sand-dark"
                }`}
              >
                {stat.winRate}%
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Tier legend */}
      <div className="flex items-center justify-center gap-4 pt-2">
        {tiers.map((tier) => (
          <div key={tier.code} className="flex items-center gap-1.5">
            <span
              className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-sm border"
              style={tierBadgeStyle(tiers, tier.code)}
            >
              {tier.code}
            </span>
            <span className="text-xs text-sand-dark">
              {tier.label}
            </span>
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div className="text-center text-xs text-sand-dark opacity-50 uppercase tracking-widest pt-1">
        {stats.length} leaders tracked &middot;{" "}
        {stats.reduce((s, l) => s + l.plays, 0)} total plays
        {" "}&middot; {stats.reduce((s, l) => s + l.totalVP, 0)} total VP
        {effectiveRound !== null && ` · Round ${effectiveRound}`}
      </div>
    </div>
  );
}
