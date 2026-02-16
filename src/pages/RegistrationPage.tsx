import { motion, AnimatePresence } from "motion/react";
import { X, Users } from "lucide-react";
import { SandwormRegistration } from "../components/animations/SandwormRegistration";
import type { Player } from "../engine/types";

interface RegistrationPageProps {
  players: Player[];
  tournamentName: string;
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (id: string) => void;
  onSetName: (name: string) => void;
  onStart: () => void;
}

export function RegistrationPage({
  players,
  tournamentName,
  onAddPlayer,
  onRemovePlayer,
  onSetName,
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
          Gather the Houses of the Landsraad
        </p>
      </motion.div>

      {/* Tournament Name */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <label className="block text-xs text-sand-dark uppercase tracking-[0.2em] mb-2 opacity-60">
          Tournament Name
        </label>
        <input
          value={tournamentName}
          onChange={(e) => onSetName(e.target.value)}
          className="input-imperial text-xl"
          placeholder="Dune Bloodlines Open"
        />
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

      {/* Player List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="space-y-2 mb-8"
      >
        <AnimatePresence>
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -30, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.9 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
              }}
              className="glass-morphism rounded-sm px-4 py-3 flex items-center gap-3"
            >
              <span className="text-score text-sm fremen-glow w-8">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-display text-sm flex-1 truncate">
                {player.name}
              </span>
              <button
                onClick={() => onRemovePlayer(player.id)}
                className="text-sand-dark hover:text-blood transition-colors p-1"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

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
