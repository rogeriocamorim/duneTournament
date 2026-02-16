import { motion } from "motion/react";
import type { Player } from "../engine/types";
import { getStandings } from "../engine/tournament";

interface LeaderboardProps {
  players: Player[];
  highlightTop?: number;
}

export function Leaderboard({ players, highlightTop = 0 }: LeaderboardProps) {
  const standings = getStandings(players);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-[3rem_1fr_4rem_4rem_4rem] gap-2 px-4 py-2 text-xs uppercase tracking-[0.2em] opacity-50">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Pts</span>
        <span className="text-right">VP</span>
        <span className="text-right">Eff</span>
      </div>

      {/* Players */}
      {standings.map((player, index) => {
        const rank = index + 1;
        const isTopCut = highlightTop > 0 && rank <= highlightTop;

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
              grid grid-cols-[3rem_1fr_4rem_4rem_4rem] gap-2 px-4 py-3 rounded-sm
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
            <span className="text-display text-sm truncate self-center">
              {player.name}
            </span>
            <span className="text-score text-right text-spice text-lg">
              {player.points}
            </span>
            <span className="text-score text-right text-sm opacity-70">
              {player.totalVP}
            </span>
            <span className="text-score text-right text-sm opacity-50">
              {player.efficiency}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
