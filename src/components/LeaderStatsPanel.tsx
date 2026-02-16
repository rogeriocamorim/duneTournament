import { motion } from "motion/react";
import { useState } from "react";
import type { Round, LeaderTier } from "../engine/types";
import { getLeaderStats } from "../engine/tournament";

interface LeaderStatsPanelProps {
  rounds: Round[];
}

const TIER_STYLES: Record<LeaderTier, { label: string; color: string }> = {
  A: { label: "A", color: "bg-red-500/20 text-red-400 border-red-500/40" },
  B: { label: "B", color: "bg-spice/20 text-spice border-spice/40" },
  C: { label: "C", color: "bg-sky-500/20 text-sky-400 border-sky-500/40" },
  none: { label: "—", color: "bg-white/5 text-sand-dark border-white/10" },
};

export function LeaderStatsPanel({ rounds }: LeaderStatsPanelProps) {
  const completedRounds = rounds.filter((r) => r.isComplete);
  const maxRound = completedRounds.length;

  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // null = cumulative (all rounds), number = specific round
  const stats =
    selectedRound === null
      ? getLeaderStats(rounds)
      : getLeaderStats(rounds, selectedRound, selectedRound);

  if (stats.length === 0) {
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
      {/* Round filter */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedRound(null)}
          className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
            selectedRound === null
              ? "bg-spice/20 text-spice border border-spice/40"
              : "text-sand-dark hover:text-sand border border-white/10"
          }`}
        >
          All Rounds
        </button>
        {Array.from({ length: maxRound }, (_, i) => {
          const roundNum = completedRounds[i].number;
          return (
            <button
              key={roundNum}
              onClick={() => setSelectedRound(roundNum)}
              className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
                selectedRound === roundNum
                  ? "bg-spice/20 text-spice border border-spice/40"
                  : "text-sand-dark hover:text-sand border border-white/10"
              }`}
            >
              R{roundNum}
            </button>
          );
        })}
      </div>

      {/* Stats table */}
      <div className="overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_4rem_4rem_5rem] gap-2 px-4 py-2 text-xs uppercase tracking-[0.15em] opacity-50 min-w-[540px]">
          <span>T</span>
          <span>Leader</span>
          <span className="text-center">Plays</span>
          <span className="text-center">Wins</span>
          <span className="text-center">Top 2</span>
          <span className="text-right">Avg VP</span>
          <span className="text-right">Avg Pos</span>
          <span className="text-right">Win Rate</span>
        </div>

        {/* Rows */}
        {stats.map((stat, index) => {
          const tierStyle = TIER_STYLES[stat.tier];
          return (
            <motion.div
              key={stat.leader}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_4rem_4rem_5rem] gap-2 px-4 py-3 rounded-sm glass-morphism mb-1 min-w-[540px]"
            >
              {/* Tier badge */}
              <span
                className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-sm border ${tierStyle.color}`}
                title={`Tier ${stat.tier}`}
              >
                {tierStyle.label}
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
              <span className="text-score text-sm text-center opacity-70 self-center">
                {stat.top2}
              </span>
              <span className="text-score text-sm text-right opacity-70 self-center">
                {stat.plays > 0 ? (stat.totalVP / stat.plays).toFixed(1) : "—"}
              </span>
              <span className="text-score text-sm text-right opacity-70 self-center">
                {stat.avgPosition.toFixed(1)}
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
        {(["A", "B", "C"] as LeaderTier[]).map((tier) => {
          const style = TIER_STYLES[tier];
          return (
            <div key={tier} className="flex items-center gap-1.5">
              <span
                className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-sm border ${style.color}`}
              >
                {style.label}
              </span>
              <span className="text-xs text-sand-dark">
                Tier {tier}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="text-center text-xs text-sand-dark opacity-50 uppercase tracking-widest pt-1">
        {stats.length} leaders tracked &middot;{" "}
        {stats.reduce((s, l) => s + l.plays, 0)} total plays
        {selectedRound !== null && ` · Round ${selectedRound}`}
      </div>
    </div>
  );
}
