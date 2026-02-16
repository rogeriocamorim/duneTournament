import { motion, AnimatePresence } from "motion/react";
import { useState, useCallback } from "react";

interface SandwormRegistrationProps {
  onAddPlayer: (name: string) => void;
}

export function SandwormRegistration({ onAddPlayer }: SandwormRegistrationProps) {
  const [name, setName] = useState("");
  const [isEating, setIsEating] = useState(false);
  const [eatenName, setEatenName] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || isEating) return;

      setEatenName(trimmed);
      setIsEating(true);

      setTimeout(() => {
        onAddPlayer(trimmed);
        setName("");
        setIsEating(false);
        setEatenName("");
      }, 900);
    },
    [name, isEating, onAddPlayer]
  );

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: "200px" }}>
      {/* The form / input */}
      <AnimatePresence mode="wait">
        {!isEating && (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="z-10 flex gap-4 items-end w-full max-w-md"
          >
            <div className="flex-1">
              <label className="block text-xs text-sand-dark uppercase tracking-[0.2em] mb-2 opacity-60">
                Summon a Champion
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter Name..."
                className="input-imperial"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn-imperial-filled px-6 py-3 whitespace-nowrap"
              disabled={!name.trim()}
            >
              Summon
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Eaten name display */}
      <AnimatePresence>
        {isEating && (
          <motion.div
            key="eaten-name"
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 0.3, y: 30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="absolute z-10 text-2xl text-display text-spice spice-text-glow"
          >
            {eatenName}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Sandworm SVG Animation */}
      <AnimatePresence>
        {isEating && (
          <motion.svg
            key="worm"
            viewBox="0 0 500 200"
            className="absolute inset-0 w-full h-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Worm body segments */}
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.circle
                key={i}
                r={18 - i * 2}
                fill="none"
                stroke="#C5A059"
                strokeWidth={3 - i * 0.3}
                opacity={1 - i * 0.15}
                initial={{ cx: -50, cy: 180 }}
                animate={{
                  cx: [
                    -50,
                    100 - i * 15,
                    250,
                    400 + i * 15,
                    550,
                  ],
                  cy: [
                    180,
                    60 + i * 5,
                    100,
                    60 + i * 5,
                    180,
                  ],
                }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.04,
                  ease: "easeInOut",
                }}
              />
            ))}

            {/* Worm mouth (leading segment) */}
            <motion.circle
              r={22}
              fill="#0A0A0A"
              stroke="#C5A059"
              strokeWidth={3}
              initial={{ cx: -50, cy: 180 }}
              animate={{
                cx: [-50, 100, 250, 400, 550],
                cy: [180, 50, 100, 50, 180],
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              {/* Inner glow */}
            </motion.circle>

            {/* Mouth inner ring */}
            <motion.circle
              r={12}
              fill="none"
              stroke="#C5A059"
              strokeWidth={1}
              opacity={0.5}
              initial={{ cx: -50, cy: 180 }}
              animate={{
                cx: [-50, 100, 250, 400, 550],
                cy: [180, 50, 100, 50, 180],
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />

            {/* Sand trail */}
            <motion.path
              d="M 0 180 Q 125 40 250 100 T 500 180"
              fill="none"
              stroke="#C5A059"
              strokeWidth={1}
              opacity={0.2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  );
}
