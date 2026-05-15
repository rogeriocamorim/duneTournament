import { motion } from "motion/react";
import type { Player, Round } from "../engine/types";
import { getVpSharePct } from "../engine/tournament";

const GROUP_NAMES = [
  "House Atreides", "House Harkonnen", "House Corrino", "Spacing Guild",
  "Bene Tleilaxu", "Ixian", "Bene Gesserit", "Fremen",
];

// Groups: Atreides, Harkonnen, Corrino, Spacing Guild, Bene Tleilaxu, Ixian, Bene Gesserit, Fremen
const GROUP_COLORS = [
  { accent: "#c5a059", glow: "rgba(197,160,89,0.2)",  border: "rgba(197,160,89,0.4)"  }, // Atreides — gold
  { accent: "#9aa5b0", glow: "rgba(154,165,176,0.15)", border: "rgba(154,165,176,0.35)" }, // Harkonnen — grey
  { accent: "#c0c0c0", glow: "rgba(192,192,192,0.15)", border: "rgba(192,192,192,0.35)" }, // Corrino — silver
  { accent: "#cc2233", glow: "rgba(204,34,51,0.2)",   border: "rgba(204,34,51,0.4)"   }, // Spacing Guild — red
  { accent: "#e891a8", glow: "rgba(232,145,168,0.2)", border: "rgba(232,145,168,0.4)" }, // Bene Tleilaxu — rose
  { accent: "#40c080", glow: "rgba(64,192,128,0.18)", border: "rgba(64,192,128,0.38)" }, // Ixian — green
  { accent: "#9060d0", glow: "rgba(144,96,208,0.2)",  border: "rgba(144,96,208,0.4)"  }, // Bene Gesserit — purple
  { accent: "#3399ff", glow: "rgba(51,153,255,0.18)", border: "rgba(51,153,255,0.38)" }, // Fremen — blue
];

function getGamesPlayed(playerId: string, rounds: Round[]): number {
  let count = 0;
  for (const round of rounds)
    for (const table of round.tables)
      if (table.isComplete && table.results.find((r) => r.playerId === playerId)) count++;
  return count;
}

function sortGroupPlayers(players: Player[], rounds: Round[]): Player[] {
  const cache = new Map<string, number>();
  for (const p of players) cache.set(p.id, getVpSharePct(p.id, rounds));
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const d = (cache.get(b.id) ?? 0) - (cache.get(a.id) ?? 0);
    if (d !== 0) return d;
    return b.totalVP - a.totalVP;
  });
}

interface GroupStandingsProps {
  players: Player[];
  rounds: Round[];
}

export function GroupStandings({ players, rounds }: GroupStandingsProps) {
  const groups = new Map<number, Player[]>();
  for (let i = 0; i < 8; i++) groups.set(i, []);
  for (const p of players) groups.get(p.groupId ?? 0)?.push(p);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from(groups.entries()).map(([gid, groupPlayers], idx) => {
        const color = GROUP_COLORS[gid];
        const sorted = sortGroupPlayers(groupPlayers, rounds);

        return (
          <motion.div
            key={gid}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.4 }}
            className="rounded-sm overflow-hidden"
            style={{
              background: "rgba(15,12,10,0.7)",
              border: `1px solid ${color.border}`,
              boxShadow: `0 4px 24px ${color.glow}`,
            }}
          >
            {/* Group Header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ background: color.glow, borderBottom: `1px solid ${color.border}` }}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: color.accent, boxShadow: `0 0 8px ${color.accent}` }}
              />
              <span
                className="text-display text-sm uppercase tracking-widest font-bold"
                style={{ color: color.accent }}
              >
                {GROUP_NAMES[gid]}
              </span>
            </div>

            {/* Column Headers */}
            <div
              className="grid px-4 py-2 text-xs uppercase tracking-widest opacity-50"
              style={{ gridTemplateColumns: "2rem 1fr 2.5rem 3rem 2.5rem 3rem 3.5rem" }}
            >
              <span>#</span>
              <span>Player</span>
              <span className="text-right">GP</span>
              <span className="text-right">Pts</span>
              <span className="text-right">W</span>
              <span className="text-right">VP</span>
              <span className="text-right">VP%</span>
            </div>

            {/* Players */}
            <div className="divide-y divide-white/5">
              {sorted.map((player, pidx) => {
                const rank = pidx + 1;
                const vpPct = getVpSharePct(player.id, rounds);
                const played = getGamesPlayed(player.id, rounds);
                const isFirst = rank === 1;
                const isSecond = rank === 2;

                return (
                  <motion.div
                    key={player.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.06 + pidx * 0.03 }}
                    className="grid px-4 py-2.5 items-center transition-colors hover:bg-white/5"
                    style={{
                      gridTemplateColumns: "2rem 1fr 2.5rem 3rem 2.5rem 3rem 3.5rem",
                      borderLeft: isFirst
                        ? `3px solid ${color.accent}`
                        : isSecond
                        ? "3px solid rgba(192,192,192,0.6)"
                        : "3px solid transparent",
                      background: isFirst ? `${color.glow}` : "transparent",
                    }}
                  >
                    <span
                      className="text-score text-base font-bold"
                      style={{ color: isFirst ? color.accent : isSecond ? "#C0C0C0" : "#6b7280" }}
                    >
                      {rank}
                    </span>

                    <span className="text-display text-sm truncate" style={{ color: isFirst ? "#fff" : "#d4c4a0" }}>
                      {player.name}
                    </span>

                    {/* Games Played */}
                    <span className="text-score text-right text-sm opacity-60 text-sand">
                      {played}
                    </span>

                    {/* Points */}
                    <span
                      className="text-score text-right text-base font-bold"
                      style={{ color: color.accent }}
                    >
                      {player.points}
                    </span>

                    {/* Wins */}
                    <span className="text-score text-right text-sm" style={{ color: "#00eeff" }}>
                      {player.wins}
                    </span>

                    {/* Total VP */}
                    <span className="text-score text-right text-sm opacity-60 text-sand">
                      {player.totalVP}
                    </span>

                    {/* VP% */}
                    <span className="text-score text-right text-sm opacity-50 text-sand">
                      {vpPct.toFixed(1)}
                    </span>
                  </motion.div>
                );
              })}

              {groupPlayers.length === 0 && (
                <div className="px-4 py-4 text-xs text-sand-dark italic">No players assigned</div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
