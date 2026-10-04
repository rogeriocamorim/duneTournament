import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Round, Player, TableResult } from "../engine/types";
import { TableCard } from "./TableCard";
import type { FormatContext } from "../engine/format";
import { getRoundStageName, getTableCardRoundProps } from "../engine/format";

interface RoundHistoryProps {
  rounds: Round[];
  players: Player[];
  /** Tournament mode/format/tiers — enables stage names, points and clock display */
  context?: FormatContext;
}

const ROUND_TYPE_LABELS: Record<string, string> = {
  qualifying: "Qualifying",
  semifinal: "Semifinal",
  "winners-final": "Redemption",
  "losers-final": "Losers Final",
  "grand-final": "Grand Final",
};

/** A no-op handler for read-only TableCards. */
const noop: (roundIndex: number, tableId: number, results: TableResult[]) => void = () => {};

export function RoundHistory({ rounds, players, context }: RoundHistoryProps) {
  const completedRounds = rounds.filter((r) => r.isComplete);
  const [selectedIndex, setSelectedIndex] = useState(completedRounds.length - 1);

  if (completedRounds.length === 0) {
    return (
      <div className="text-center py-8 text-sand-dark text-sm uppercase tracking-widest">
        No completed rounds yet.
      </div>
    );
  }

  const round = completedRounds[selectedIndex];
  const label = context?.mode === "custom"
    ? getRoundStageName(context, round)
    : ROUND_TYPE_LABELS[round.type] ?? round.type;
  const roundProps = context ? getTableCardRoundProps(context, round) : undefined;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex < completedRounds.length - 1;

  return (
    <div className="space-y-4">
      {/* Round navigator */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
          disabled={!hasPrev}
          className={`p-1.5 rounded-sm transition-all ${
            hasPrev
              ? "text-sand hover:text-spice hover:bg-spice/10"
              : "text-sand-dark/30 cursor-not-allowed"
          }`}
          aria-label="Previous round"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {completedRounds.map((r, i) => (
            <button
              key={r.number}
              onClick={() => setSelectedIndex(i)}
              className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
                i === selectedIndex
                  ? "bg-spice/20 text-spice border border-spice/40"
                  : "glass-morphism text-sand hover:text-spice border border-sand-dark/40 hover:border-spice/40"
              }`}
            >
              R{r.number}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSelectedIndex((i) => Math.min(completedRounds.length - 1, i + 1))}
          disabled={!hasNext}
          className={`p-1.5 rounded-sm transition-all ${
            hasNext
              ? "text-sand hover:text-spice hover:bg-spice/10"
              : "text-sand-dark/30 cursor-not-allowed"
          }`}
          aria-label="Next round"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Round header */}
      <div className="text-center">
        <h3 className="text-display text-sm text-sand-dark">
          Round {round.number} &mdash; {label}
        </h3>
        {round.leaderTier && (
          <span className="text-xs text-sand-dark/60 uppercase tracking-widest">
            Tier {round.leaderTier} Leaders
          </span>
        )}
      </div>

      {/* Tables (read-only) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={round.number}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={
            round.tables.length === 1
              ? "flex justify-center"
              : "grid grid-cols-1 md:grid-cols-2 gap-4"
          }
        >
          {round.tables.map((table) => (
            <div
              key={`history-r${round.number}-t${table.id}`}
              className={round.tables.length === 1 ? "w-full max-w-xl" : ""}
            >
              <TableCard
                table={table}
                players={players}
                roundIndex={rounds.indexOf(round)}
                onSubmitResults={noop}
                animationDelay={0}
                placementPoints={roundProps?.placementPoints ?? round.placementPoints}
                clock={roundProps?.clock}
                mode={roundProps?.mode}
              />
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
