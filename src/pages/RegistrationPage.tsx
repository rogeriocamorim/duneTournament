import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Users, Play, FlaskConical } from "lucide-react";
import { SandwormRegistration } from "../components/animations/SandwormRegistration";
import { generateTestPlayerNames } from "../engine/testUtils";
import type { Player } from "../engine/types";

const INTRO_VIDEO_EMBED_URL =
  "https://www.canva.com/design/DAHCwjWwmKc/IU6i6iu-jQcoAxraRjjjPg/view?embed";

interface RegistrationPageProps {
  players: Player[];
  onAddPlayer: (name: string) => void;
  onRemovePlayer: (id: string) => void;
  onStart: () => void;
  testMode: boolean;
}

export function RegistrationPage({
  players,
  onAddPlayer,
  onRemovePlayer,
  onStart,
  testMode,
}: RegistrationPageProps) {
  const canStart = players.length >= 4;
  const [showVideo, setShowVideo] = useState(false);
  const [testPlayerCount, setTestPlayerCount] = useState(20);

  const handleAutoFillPlayers = () => {
    const names = generateTestPlayerNames(testPlayerCount);
    for (const name of names) {
      onAddPlayer(name);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Video Modal */}
      <AnimatePresence>
        {showVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
            onClick={() => setShowVideo(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-[90vw] max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowVideo(false)}
                className="absolute -top-10 right-0 text-sand hover:text-spice transition-colors"
              >
                <X size={24} />
              </button>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={INTRO_VIDEO_EMBED_URL}
                  className="absolute inset-0 w-full h-full rounded-sm shadow-2xl"
                  allowFullScreen
                  allow="autoplay"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Play Video Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center mb-8"
      >
        <button
          onClick={() => setShowVideo(true)}
          className="btn-imperial flex items-center gap-2 px-6 py-2 text-sm uppercase tracking-widest"
        >
          <Play size={16} />
          Play Intro
        </button>
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

      {/* Test Mode: Auto Fill Players */}
      {testMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mb-8 flex items-center justify-center gap-3"
        >
          <FlaskConical size={14} className="text-fremen-blue" />
          <input
            type="number"
            min={4}
            max={100}
            value={testPlayerCount}
            onChange={(e) => setTestPlayerCount(Math.max(4, parseInt(e.target.value) || 4))}
            className="bg-black/50 border border-fremen-blue/40 text-score text-sm px-2 py-1 rounded-sm w-16 text-center text-white"
          />
          <button
            onClick={handleAutoFillPlayers}
            className="px-4 py-1.5 text-xs uppercase tracking-widest border border-fremen-blue/40 text-fremen-blue hover:bg-fremen-blue/10 transition-colors rounded-sm"
          >
            Auto Fill Players
          </button>
        </motion.div>
      )}

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
