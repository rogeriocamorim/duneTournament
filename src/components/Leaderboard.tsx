import { motion } from "motion/react";
import { useState } from "react";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import type { Player, Round } from "../engine/types";
import { getStandings, getVpSharePct, getStandingsAsOfRound, getTierForRound } from "../engine/tournament";

interface LeaderboardProps {
  players: Player[];
  highlightTop?: number;
  /** Pre-sorted standings to use instead of default getStandings() */
  finalStandings?: Player[];
  /** Rounds data — used to compute VP Share % per player */
  rounds?: Round[];
  /** Pre-computed VP Share % values (keyed by player id). Used by spectator view. */
  vpSharePctMap?: Map<string, number>;
}

export function Leaderboard({ players, highlightTop = 0, finalStandings, rounds = [], vpSharePctMap }: LeaderboardProps) {
  const completedRounds = rounds.filter((r) => r.isComplete);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Determine the standings to display
  const currentStandings: Player[] = (() => {
    if (selectedRound !== null) {
      return getStandingsAsOfRound(players, rounds, selectedRound);
    }
    return finalStandings ?? getStandings(players, rounds);
  })();

  // Compute previous round standings for position delta comparison
  const prevRoundPositionMap = new Map<string, number>();
  if (selectedRound !== null) {
    // Compare with the round before the selected one
    const prevRound = completedRounds
      .filter((r) => r.number < selectedRound)
      .sort((a, b) => b.number - a.number)[0];
    if (prevRound) {
      const prevStandings = getStandingsAsOfRound(players, rounds, prevRound.number);
      prevStandings.forEach((p, i) => prevRoundPositionMap.set(p.id, i + 1));
    }
  }

  const hasPrevData = prevRoundPositionMap.size > 0;

  return (
    <div className="space-y-2">
      {/* Round filter */}
      {completedRounds.length > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
          <button
            onClick={() => setSelectedRound(null)}
            className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
              selectedRound === null
                ? "bg-spice/20 text-spice border border-spice/40"
                : "glass-morphism text-sand hover:text-spice border border-sand-dark/40 hover:border-spice/40"
            }`}
          >
            All
          </button>
          {completedRounds
            .sort((a, b) => a.number - b.number)
            .map((r) => {
              const tier = r.leaderTier ?? getTierForRound(r.number, false);
              const tierColors: Record<string, string> = { A: "#ef4444", B: "#c5a059", C: "#38bdf8" };
              const tierColor = tierColors[tier] ?? "#c5a059";
              return (
                <div key={r.number} className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-[9px] font-bold uppercase leading-none"
                    style={{ color: tierColor }}
                  >
                    {tier}
                  </span>
                  <button
                    onClick={() => setSelectedRound(r.number)}
                    className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
                      selectedRound === r.number
                        ? "bg-spice/20 text-spice border border-spice/40"
                        : "glass-morphism text-sand hover:text-spice border border-sand-dark/40 hover:border-spice/40"
                    }`}
                  >
                    R{r.number}
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* Header */}
      <div
        className={`grid gap-1 px-4 py-2 text-xs uppercase tracking-[0.15em] opacity-50 ${
          hasPrevData
            ? "grid-cols-[2.5rem_3rem_1fr_3rem_2.5rem_3rem_3.5rem]"
            : "grid-cols-[2.5rem_1fr_3rem_2.5rem_3rem_3.5rem]"
        }`}
      >
        <span>#</span>
        {hasPrevData && <span className="text-center">+/-</span>}
        <span>Player</span>
        <span className="text-right">Pts</span>
        <span className="text-right">W</span>
        <span className="text-right">VP</span>
        <span className="text-right">VP%</span>
      </div>

      {/* Players */}
      {currentStandings.map((player, index) => {
        const rank = index + 1;
        const isTopCut = highlightTop > 0 && rank <= highlightTop;

        // VP% for the selected round or all rounds
        const vpPctRounds = selectedRound !== null
          ? rounds.filter((r) => r.isComplete && r.number <= selectedRound)
          : rounds;
        const vpSharePct = vpSharePctMap?.get(player.id) ?? getVpSharePct(player.id, vpPctRounds);

        // Position delta
        const prevRank = prevRoundPositionMap.get(player.id);
        const delta = prevRank !== undefined ? prevRank - rank : 0;

        return (
          <motion.div
            key={player.id}
            layout
            layoutId={`player-${player.id}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              layout: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.3, delay: index * 0.03 },
            }}
            className={`
              grid gap-1 px-4 py-3 rounded-sm
              ${hasPrevData
                ? "grid-cols-[2.5rem_3rem_1fr_3rem_2.5rem_3rem_3.5rem]"
                : "grid-cols-[2.5rem_1fr_3rem_2.5rem_3rem_3.5rem]"
              }
              ${isTopCut ? "stone-card spice-glow" : "glass-morphism"}
              ${rank === 1 ? "border-l-4 border-l-[#FFD700]" : ""}
              ${rank === 2 ? "border-l-4 border-l-[#C0C0C0]" : ""}
              ${rank === 3 ? "border-l-4 border-l-[#CD7F32]" : ""}
            `}
          >
            <span
              className={`text-score text-lg ${
                isTopCut ? "fremen-glow" : "text-sand-dark"
              }`}
            >
              {rank}
            </span>

            {/* Position delta */}
            {hasPrevData && (
              <span className="flex items-center justify-center gap-0.5 self-center">
                {delta > 0 ? (
                  <>
                    <ChevronUp size={14} className="text-green-400" />
                    <span className="text-xs text-green-400 font-bold">{delta}</span>
                  </>
                ) : delta < 0 ? (
                  <>
                    <ChevronDown size={14} className="text-red-400" />
                    <span className="text-xs text-red-400 font-bold">{Math.abs(delta)}</span>
                  </>
                ) : prevRank !== undefined ? (
                  <Minus size={12} className="text-sand-dark/40" />
                ) : (
                  <span className="text-xs text-fremen-blue font-bold">NEW</span>
                )}
              </span>
            )}

            <span className="text-display text-sm truncate self-center">
              {player.name}
            </span>
            <span className="text-score text-right text-spice text-lg">
              {player.points}
            </span>
            <span className="text-score text-right text-sm text-fremen-blue">
              {player.wins}
            </span>
            <span className="text-score text-right text-sm opacity-70">
              {player.totalVP}
            </span>
            <span className="text-score text-right text-sm opacity-50">
              {vpSharePct.toFixed(1)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
