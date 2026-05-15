import { motion } from "motion/react";
import { Swords, Crown } from "lucide-react";
import type { TournamentMode } from "../engine/types";

interface ModeSelectorPageProps {
  onSelectMode: (mode: TournamentMode) => void;
}

export function ModeSelectorPage({ onSelectMode }: ModeSelectorPageProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h1 className="text-display text-4xl md:text-5xl text-spice mb-3 tracking-wider">
          Dune: Imperium
        </h1>
        <p className="text-sand-dark text-lg tracking-widest uppercase">
          Tournament Manager
        </p>
        <div className="w-24 h-px bg-spice/40 mx-auto mt-6" />
      </motion.div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-center text-sand-dark/80 mb-10 text-sm uppercase tracking-widest"
      >
        Choose your tournament format
      </motion.p>

      {/* Mode Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Classic Mode */}
        <motion.button
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectMode("classic")}
          className="stone-card p-8 text-left cursor-pointer group transition-all hover:border-spice/40"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-sm bg-spice/10 text-spice group-hover:bg-spice/20 transition-colors">
              <Swords size={28} />
            </div>
            <div>
              <h2 className="text-display text-xl text-spice tracking-wide">Classic</h2>
              <p className="text-sand-dark/60 text-xs uppercase tracking-widest">Swiss Pairing</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-sand-dark/80">
            <p>The original tournament format with Swiss-style pairings.</p>
            <ul className="space-y-1 mt-3">
              <li className="flex items-start gap-2">
                <span className="text-spice/60 mt-0.5">&#x25B8;</span>
                <span>5 qualifying rounds with anti-rematch pairing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spice/60 mt-0.5">&#x25B8;</span>
                <span>Top 16 double-elimination bracket</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spice/60 mt-0.5">&#x25B8;</span>
                <span>Minimum 4 players (multiples of 4)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-spice/60 mt-0.5">&#x25B8;</span>
                <span>Round-by-round generation</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 text-center">
            <span className="text-xs uppercase tracking-widest text-spice/50 group-hover:text-spice transition-colors">
              Dune Bloodlines Open
            </span>
          </div>
        </motion.button>

        {/* Colosseum Mode */}
        <motion.button
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectMode("colosseum")}
          className="stone-card p-8 text-left cursor-pointer group transition-all hover:border-fremen-blue/40"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-sm bg-fremen-blue/10 text-fremen-blue group-hover:bg-fremen-blue/20 transition-colors">
              <Crown size={28} />
            </div>
            <div>
              <h2 className="text-display text-xl text-fremen-blue tracking-wide">Colosseum</h2>
              <p className="text-sand-dark/60 text-xs uppercase tracking-widest">Group Stage</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-sand-dark/80">
            <p>The Colosseum format with group drafting and fixed schedules.</p>
            <ul className="space-y-1 mt-3">
              <li className="flex items-start gap-2">
                <span className="text-fremen-blue/60 mt-0.5">&#x25B8;</span>
                <span>Spinner wheel draft into 8 groups</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-fremen-blue/60 mt-0.5">&#x25B8;</span>
                <span>4 pre-generated qualifying rounds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-fremen-blue/60 mt-0.5">&#x25B8;</span>
                <span>Knockout randomizer bracket</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-fremen-blue/60 mt-0.5">&#x25B8;</span>
                <span>Minimum 16 players (multiples of 8)</span>
              </li>
            </ul>
          </div>
          <div className="mt-6 text-center">
            <span className="text-xs uppercase tracking-widest text-fremen-blue/50 group-hover:text-fremen-blue transition-colors">
              The Colosseum — Uprising
            </span>
          </div>
        </motion.button>
      </div>

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
