import { motion, AnimatePresence } from "motion/react";
import { useState, useCallback } from "react";
import type { LeaderTier } from "../../engine/types";
import { getLeaderInfo, getLeaderImageUrl } from "../../engine/types";
import { ChevronRight, X } from "lucide-react";

interface LeaderRevealProps {
  /** Leader display names to reveal */
  leaders: string[];
  /** The tier being revealed (for accent color) */
  tier: LeaderTier;
  /** Called when the reveal is dismissed */
  onComplete: () => void;
  /** Skip intro/individual reveals and jump straight to the grid */
  skipToGrid?: boolean;
}

const TIER_CONFIG: Record<string, { label: string; color: string; glow: string; border: string }> = {
  A: { label: "A Tier", color: "#FFD700", glow: "rgba(255, 215, 0, 0.4)", border: "rgba(255, 215, 0, 0.6)" },
  B: { label: "B Tier", color: "#C0C0C0", glow: "rgba(192, 192, 192, 0.4)", border: "rgba(192, 192, 192, 0.6)" },
  C: { label: "C Tier", color: "#CD7F32", glow: "rgba(205, 127, 50, 0.4)", border: "rgba(205, 127, 50, 0.6)" },
};

export function LeaderReveal({ leaders, tier, onComplete, skipToGrid: skipToGridProp }: LeaderRevealProps) {
  const [currentIndex, setCurrentIndex] = useState(skipToGridProp ? leaders.length : -1); // -1 = intro, 0..6 = individual, 7+ = grid
  const [isAnimating, setIsAnimating] = useState(false);

  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.A;
  const showGrid = currentIndex >= leaders.length;
  const showIntro = currentIndex === -1;

  const advance = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setIsAnimating(false);
    }, 150);
  }, [isAnimating]);

  const skipToGrid = useCallback(() => {
    setCurrentIndex(leaders.length);
  }, [leaders.length]);

  const currentLeader = currentIndex >= 0 && currentIndex < leaders.length
    ? getLeaderInfo(leaders[currentIndex])
    : null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={showGrid ? undefined : advance}
      style={{ cursor: showGrid ? "default" : "pointer" }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/95" />

      {/* Animated tier accent lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px opacity-20"
            style={{
              top: `${15 + i * 14}%`,
              left: 0,
              right: 0,
              background: `linear-gradient(90deg, transparent 0%, ${config.color} 50%, transparent 100%)`,
            }}
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      {/* Close / Skip button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        className="absolute top-6 right-6 z-10 text-sand-dark hover:text-sand transition-colors"
      >
        <X size={24} />
      </button>

      {/* Intro screen */}
      <AnimatePresence mode="wait">
        {showIntro && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="relative z-10 text-center px-8"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-xs uppercase tracking-[0.5em] mb-4"
              style={{ color: config.color }}
            >
              Leader Selection
            </motion.div>
            <h1
              className="text-display text-4xl md:text-6xl mb-4"
              style={{ color: config.color, textShadow: `0 0 30px ${config.glow}` }}
            >
              {config.label}
            </h1>
            <p className="text-sm text-sand-dark uppercase tracking-widest mb-8">
              7 leaders will be revealed
            </p>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center justify-center gap-2 text-sm"
              style={{ color: config.color }}
            >
              <span className="uppercase tracking-widest">Tap to begin</span>
              <ChevronRight size={16} />
            </motion.div>
          </motion.div>
        )}

        {/* Individual leader reveal */}
        {currentLeader && !showGrid && (
          <motion.div
            key={`leader-${currentIndex}`}
            initial={{ opacity: 0, scale: 0.3, rotateY: 90 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative z-10 flex flex-col items-center px-4"
          >
            {/* Counter */}
            <div className="text-xs uppercase tracking-[0.3em] text-sand-dark mb-4">
              {currentIndex + 1} / {leaders.length}
            </div>

            {/* Card image */}
            <div
              className="relative rounded-lg overflow-hidden"
              style={{
                boxShadow: `0 0 40px ${config.glow}, 0 0 80px ${config.glow}`,
                border: `2px solid ${config.border}`,
              }}
            >
              <motion.img
                src={getLeaderImageUrl(currentLeader)}
                alt={currentLeader.name}
                className="w-[48rem] md:w-[60rem] h-auto block max-w-[90vw]"
                initial={{ filter: "brightness(0)" }}
                animate={{ filter: "brightness(1)" }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />

              {/* Community Version badge */}
              {currentLeader.isCommunity && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="absolute top-3 right-3 bg-fremen-blue/90 text-obsidian text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-sm"
                  style={{ textShadow: "none" }}
                >
                  Community
                </motion.div>
              )}
            </div>

            {/* Leader name */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-display text-lg md:text-xl mt-6 text-center"
              style={{ color: config.color, textShadow: `0 0 15px ${config.glow}` }}
            >
              {currentLeader.name}
            </motion.h2>

            {/* Tap hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 0.8 }}
              className="text-xs text-sand-dark uppercase tracking-widest mt-4"
            >
              {currentIndex < leaders.length - 1 ? "Tap for next" : "Tap to see all"}
            </motion.p>
          </motion.div>
        )}

        {/* Final grid showing all leaders */}
        {showGrid && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 w-full max-w-7xl px-4 py-8 overflow-y-auto max-h-[90vh]"
          >
            <h2
              className="text-display text-xl md:text-2xl text-center mb-6"
              style={{ color: config.color, textShadow: `0 0 20px ${config.glow}` }}
            >
              {config.label} &mdash; Available Leaders
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-items-center mb-8">
              {leaders.map((name, i) => {
                const info = getLeaderInfo(name);
                if (!info) return null;
                return (
                  <motion.div
                    key={info.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 20 }}
                    className="flex flex-col items-center"
                  >
                    <div
                      className="relative rounded-md overflow-hidden"
                      style={{
                        border: `1px solid ${config.border}`,
                        boxShadow: `0 0 15px ${config.glow}`,
                      }}
                    >
                      <img
                        src={getLeaderImageUrl(info)}
                        alt={info.name}
                        className="w-48 md:w-64 h-auto block"
                      />
                      {info.isCommunity && (
                        <div className="absolute top-1 right-1 bg-fremen-blue/90 text-obsidian text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm leading-tight">
                          Community
                        </div>
                      )}
                    </div>
                    <p className="text-display text-[10px] md:text-xs text-center mt-2 leading-tight max-w-48 md:max-w-64" style={{ color: config.color }}>
                      {info.name}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Dismiss button */}
            <div className="text-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                className="btn-imperial-filled py-3 px-8 text-sm"
              >
                Continue to Round
              </button>
            </div>

            {/* Skip hint at the bottom */}
            <p className="text-center text-xs text-sand-dark uppercase tracking-widest mt-4 opacity-50">
              These leaders will be available in the dropdown
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip to all button (bottom-left, during individual reveals) */}
      {!showIntro && !showGrid && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            skipToGrid();
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-xs text-sand-dark hover:text-sand uppercase tracking-widest transition-colors"
        >
          Show all leaders
        </button>
      )}
    </motion.div>
  );
}
