import { motion } from "motion/react";
import { X, Users } from "lucide-react";
import { SandwormRegistration } from "../components/animations/SandwormRegistration";
import type { Player } from "../engine/types";

interface RegistrationPageProps {
  players: Player[];
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (id: string) => void;
  onStart: () => void;
}

export function RegistrationPage({
  players,
  onAddPlayer,
  onRemovePlayer,
  onStart,
}: RegistrationPageProps) {
  const canStart = players.length >= 4;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="text-display text-3xl md:text-4xl text-spice spice-text-glow mb-2">
          The Summoning
        </h1>
        <p className="text-sm text-sand-dark uppercase tracking-[0.3em]">
          Champions Rise to Claim Glory
        </p>
      </motion.div>

      {/* Sandworm Registration */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mb-8"
      >
        <SandwormRegistration onAddPlayer={onAddPlayer} />
      </motion.div>

      {/* Player Count */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-center gap-2 mb-6"
      >
        <Users size={16} className="text-spice" />
        <span className="text-score text-lg fremen-glow">{players.length}</span>
        <span className="text-xs text-sand-dark uppercase tracking-widest">
          Champions Summoned
        </span>
      </motion.div>

      {/* Player List — compact grid */}
      {players.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-8 glass-morphism rounded-sm p-4"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between gap-1 py-1 border-b border-sand-dark/10 last:border-b-0"
              >
                <span className="text-display text-sm truncate">
                  {player.name}
                </span>
                <button
                  onClick={() => onRemovePlayer(player.id)}
                  className="text-sand-dark hover:text-blood transition-colors p-0.5 shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Start Button */}
      {canStart && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <button
            onClick={onStart}
            className="btn-imperial-filled text-lg py-4 px-12"
          >
            Begin the Jihad
          </button>
          <p className="text-xs text-sand-dark mt-3 uppercase tracking-widest">
            {players.length} players &middot;{" "}
            {(() => {
              const n = players.length;
              const r = n % 4;
              let t3 = 0;
              if (r === 1) t3 = 3;
              else if (r === 2) t3 = 2;
              else if (r === 3) t3 = 1;
              const t4 = (n - t3 * 3) / 4;
              const parts = [];
              if (t4 > 0) parts.push(`${t4} table${t4 > 1 ? "s" : ""} of 4`);
              if (t3 > 0) parts.push(`${t3} descent table${t3 > 1 ? "s" : ""} of 3`);
              return parts.join(" + ");
            })()}
          </p>
        </motion.div>
      )}
    </div>
  );
}
