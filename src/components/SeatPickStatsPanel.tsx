import { motion } from "motion/react";
import type { Round } from "../engine/types";

interface PositionStats {
  plays: number;
  wins: number;
  top2: number;
  totalVP: number;
  totalPosition: number; // sum of finish positions
}

function emptyStats(): PositionStats {
  return { plays: 0, wins: 0, top2: 0, totalVP: 0, totalPosition: 0 };
}

function computeStats(rounds: Round[], field: "seatPosition" | "pickOrder") {
  const map = new Map<number, PositionStats>();
  for (let i = 1; i <= 4; i++) map.set(i, emptyStats());

  for (const round of rounds)
    for (const table of round.tables) {
      if (!table.isComplete) continue;
      for (const r of table.results) {
        const key = r[field];
        if (!key || key < 1 || key > 4) continue;
        const s = map.get(key)!;
        s.plays++;
        if (r.position === 1) s.wins++;
        if (r.position <= 2) s.top2++;
        s.totalVP += r.vp;
        s.totalPosition += r.position;
      }
    }
  return map;
}

const BAR_COLOR = "#c5a059";
const BAR_COLOR2 = "#00eeff";

interface StatRowProps {
  label: string;
  stats: PositionStats;
  maxWinRate: number;
  maxAvgPos: number; // for inverse bar (lower is better)
  accent: string;
}

function StatRow({ label, stats, maxWinRate, accent }: StatRowProps) {
  const winRate = stats.plays > 0 ? (stats.wins / stats.plays) * 100 : 0;
  const top2Rate = stats.plays > 0 ? (stats.top2 / stats.plays) * 100 : 0;
  const avgVP = stats.plays > 0 ? (stats.totalVP / stats.plays).toFixed(1) : "—";
  const avgFinish = stats.plays > 0 ? (stats.totalPosition / stats.plays).toFixed(2) : "—";
  const barW = maxWinRate > 0 ? (winRate / maxWinRate) * 100 : 0;

  return (
    <div className="grid items-center gap-3 py-2.5 border-b border-white/5 last:border-0"
      style={{ gridTemplateColumns: "3rem 1fr 4rem 4rem 4rem 4rem" }}>
      <span className="text-display text-sm font-bold text-center" style={{ color: accent }}>{label}</span>
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barW}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: accent }}
        />
      </div>
      <span className="text-score text-right text-sm" style={{ color: accent }}>
        {winRate.toFixed(1)}%
      </span>
      <span className="text-score text-right text-sm opacity-70 text-sand">
        {top2Rate.toFixed(1)}%
      </span>
      <span className="text-score text-right text-sm opacity-60 text-sand">{avgVP}</span>
      <span className="text-score text-right text-sm opacity-50 text-sand">{avgFinish}</span>
    </div>
  );
}

interface SeatPickStatsPanelProps {
  rounds: Round[];
}

export function SeatPickStatsPanel({ rounds }: SeatPickStatsPanelProps) {
  const seatStats = computeStats(rounds, "seatPosition");
  const pickStats = computeStats(rounds, "pickOrder");

  const totalGames = rounds.reduce((sum, r) =>
    sum + r.tables.filter((t) => t.isComplete).length, 0);

  const hasSeatData = [...seatStats.values()].some((s) => s.plays > 0);
  const hasPickData = [...pickStats.values()].some((s) => s.plays > 0);

  if (!hasSeatData && !hasPickData) {
    return (
      <div className="text-center py-12 text-sand-dark text-sm uppercase tracking-widest">
        No seat or pick order data yet.
        <br />
        <span className="text-xs opacity-60 normal-case tracking-normal mt-2 block">
          Enter Seat and Pick values when confirming table results.
        </span>
      </div>
    );
  }

  const maxSeatWin = Math.max(...[...seatStats.values()].map((s) =>
    s.plays > 0 ? (s.wins / s.plays) * 100 : 0));
  const maxPickWin = Math.max(...[...pickStats.values()].map((s) =>
    s.plays > 0 ? (s.wins / s.plays) * 100 : 0));

  const colHeader = (
    <div className="grid gap-3 px-4 py-1.5 text-xs uppercase tracking-widest opacity-40"
      style={{ gridTemplateColumns: "3rem 1fr 4rem 4rem 4rem 4rem" }}>
      <span className="text-center">#</span>
      <span>Win rate</span>
      <span className="text-right">Win%</span>
      <span className="text-right">Top2%</span>
      <span className="text-right">Avg VP</span>
      <span className="text-right">Avg Fin</span>
    </div>
  );

  return (
    <div className="space-y-8">
      <p className="text-center text-xs text-sand-dark uppercase tracking-widest">
        Based on {totalGames} completed game{totalGames !== 1 ? "s" : ""}
      </p>

      {/* Seat Position */}
      {hasSeatData && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-morphism rounded-sm overflow-hidden"
          style={{ border: `1px solid rgba(197,160,89,0.3)` }}
        >
          <div className="px-4 py-3" style={{ background: "rgba(197,160,89,0.1)", borderBottom: "1px solid rgba(197,160,89,0.2)" }}>
            <h3 className="text-display text-sm uppercase tracking-widest font-bold" style={{ color: BAR_COLOR }}>
              Table Seat Position
            </h3>
            <p className="text-xs text-sand-dark mt-0.5">Does where you sit affect your results?</p>
          </div>
          <div className="px-4 pt-1 pb-2">
            {colHeader}
            {[1, 2, 3, 4].map((seat) => (
              <StatRow
                key={seat}
                label={`Seat ${seat}`}
                stats={seatStats.get(seat)!}
                maxWinRate={maxSeatWin}
                maxAvgPos={4}
                accent={BAR_COLOR}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Pick Order */}
      {hasPickData && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-morphism rounded-sm overflow-hidden"
          style={{ border: `1px solid rgba(0,238,255,0.25)` }}
        >
          <div className="px-4 py-3" style={{ background: "rgba(0,238,255,0.08)", borderBottom: "1px solid rgba(0,238,255,0.2)" }}>
            <h3 className="text-display text-sm uppercase tracking-widest font-bold" style={{ color: BAR_COLOR2 }}>
              Draft Pick Order
            </h3>
            <p className="text-xs text-sand-dark mt-0.5">Does picking 1st vs 4th give an advantage?</p>
          </div>
          <div className="px-4 pt-1 pb-2">
            {colHeader}
            {[1, 2, 3, 4].map((pick) => (
              <StatRow
                key={pick}
                label={`Pick ${pick}`}
                stats={pickStats.get(pick)!}
                maxWinRate={maxPickWin}
                maxAvgPos={4}
                accent={BAR_COLOR2}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
