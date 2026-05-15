import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, ChevronRight, Swords } from "lucide-react";
import type { Player } from "../engine/types";

const GROUP_NAMES = ["House Atreides", "House Harkonnen", "House Corrino", "Spacing Guild", "Tleilaxu", "Ixian", "Bene Gesserit", "Fremen"];

// Atreides, Harkonnen, Corrino, Spacing Guild, Bene Tleilaxu, Ixian, Bene Gesserit, Fremen
const GROUP_COLORS = [
  { accent: "#c5a059", glow: "rgba(197,160,89,0.25)" },   // Atreides — gold
  { accent: "#9aa5b0", glow: "rgba(154,165,176,0.2)" },   // Harkonnen — grey
  { accent: "#c0c0c0", glow: "rgba(192,192,192,0.2)" },   // Corrino — silver
  { accent: "#cc2233", glow: "rgba(204,34,51,0.25)" },    // Spacing Guild — red
  { accent: "#e891a8", glow: "rgba(232,145,168,0.22)" },  // Bene Tleilaxu — rose
  { accent: "#40c080", glow: "rgba(64,192,128,0.22)" },   // Ixian — green
  { accent: "#9060d0", glow: "rgba(144,96,208,0.25)" },   // Bene Gesserit — purple
  { accent: "#3399ff", glow: "rgba(51,153,255,0.22)" },   // Fremen — blue
];

interface GroupDrawPageProps {
  players: Player[];
  onProceed: () => void;
}

export function GroupDrawPage({ players, onProceed }: GroupDrawPageProps) {
  const [revealed, setRevealed] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  // Build groups map from player groupId
  const groups = new Map<number, Player[]>();
  for (let i = 0; i < 8; i++) groups.set(i, []);
  for (const p of players) {
    const gid = p.groupId ?? 0;
    groups.get(gid)?.push(p);
  }

  const handleReveal = () => setRevealed(true);

  return (
    <div className="min-h-screen px-4 py-8 max-w-6xl mx-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10"
      >
        <div className="flex justify-center mb-4">
          <Shield size={40} className="text-spice" style={{ filter: "drop-shadow(0 0 12px rgba(197,160,89,0.6))" }} />
        </div>
        <h1 className="text-display text-4xl md:text-5xl text-spice spice-text-glow mb-2 uppercase tracking-widest">
          The Draw
        </h1>
        <p className="text-sm text-sand-dark uppercase tracking-[0.3em]">
          {players.length} Gladiators · 8 Groups · Glory Awaits
        </p>
      </motion.div>

      {/* Reveal Button */}
      <AnimatePresence>
        {!revealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center mb-12"
          >
            <button
              onClick={handleReveal}
              className="btn-imperial px-10 py-4 text-base uppercase tracking-[0.3em] flex items-center gap-3"
            >
              <Swords size={20} />
              Reveal the Groups
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Groups Grid */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
          >
            {Array.from(groups.entries()).map(([gid, groupPlayers], idx) => {
              const color = GROUP_COLORS[gid];
              const isExpanded = expandedGroup === gid;

              return (
                <motion.div
                  key={gid}
                  initial={{ opacity: 0, y: 32, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.07, duration: 0.45, ease: "easeOut" }}
                  onClick={() => setExpandedGroup(isExpanded ? null : gid)}
                  className="cursor-pointer rounded-sm glass-morphism overflow-hidden border border-white/5 hover:border-white/15 transition-all duration-300"
                  style={{
                    boxShadow: isExpanded ? `0 0 24px ${color.glow}, 0 4px 20px rgba(0,0,0,0.5)` : "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* Group Header */}
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ borderBottom: `1px solid ${color.accent}30`, background: `${color.glow}` }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: color.accent, boxShadow: `0 0 8px ${color.accent}` }}
                      />
                      <span
                        className="text-display text-sm uppercase tracking-widest font-bold"
                        style={{ color: color.accent }}
                      >
                        Group {GROUP_NAMES[gid]}
                      </span>
                    </div>
                    <ChevronRight
                      size={14}
                      style={{
                        color: color.accent,
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.3s ease",
                      }}
                    />
                  </div>

                  {/* Player List */}
                  <div className="px-4 py-3 space-y-2">
                    {groupPlayers.map((p, pidx) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.07 + pidx * 0.04 + 0.15 }}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="text-xs font-mono w-5 text-right flex-shrink-0"
                          style={{ color: `${color.accent}80` }}
                        >
                          {pidx + 1}
                        </span>
                        <span className="text-sm text-sand truncate">{p.name}</span>
                      </motion.div>
                    ))}
                    {groupPlayers.length === 0 && (
                      <span className="text-xs text-sand-dark italic">No players assigned</span>
                    )}
                  </div>

                  {/* Expanded: Schedule preview */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-4 pb-4 pt-2 space-y-2 text-xs"
                          style={{ borderTop: `1px solid ${color.accent}20` }}
                        >
                          <p className="uppercase tracking-wider mb-2" style={{ color: `${color.accent}90` }}>
                            Round Schedule
                          </p>
                          {[
                            ["R1", "1·2·3·4", "5·6·7·8"],
                            ["R2", "1·2·5·6", "3·4·7·8"],
                            ["R3", "1·3·5·7", "2·4·6·8"],
                            ["R4", "1·4·6·7", "2·3·5·8"],
                          ].map(([label, tableA, tableB]) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="font-mono w-6 text-sand-dark">{label}</span>
                              <span className="text-sand/60">Table A: {tableA}</span>
                              <span className="text-sand-dark">·</span>
                              <span className="text-sand/60">Table B: {tableB}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Bar + Proceed */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col items-center gap-4"
          >
            <p className="text-xs text-sand-dark uppercase tracking-widest">
              Scoring: 1st = 6pts · 2nd = 3pts · 3rd = 2pts · 4th = 1pt · Tiebreaker: VP%
            </p>
            <button
              onClick={onProceed}
              className="btn-imperial px-12 py-4 text-base uppercase tracking-[0.3em] flex items-center gap-3"
            >
              <Swords size={18} />
              Enter the Colosseum
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
