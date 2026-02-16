import { motion, AnimatePresence } from "motion/react";
import { useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { Eye, ChevronRight } from "lucide-react";

interface DramaticRevealProps {
  /** Unique key to reset the reveal when a new round starts */
  roundKey: string;
  /** Items to reveal one at a time */
  items: ReactNode[];
  /** Optional labels shown above each item when revealing */
  labels?: string[];
  /** Whether dramatic reveal is enabled */
  enabled: boolean;
  /** Grid class for the container (e.g., "grid grid-cols-1 md:grid-cols-2 gap-4") */
  gridClass?: string;
}

export function DramaticReveal({
  roundKey,
  items,
  labels,
  enabled,
  gridClass = "grid grid-cols-1 md:grid-cols-2 gap-4",
}: DramaticRevealProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);

  // Reset revealed count when the round changes
  useEffect(() => {
    setRevealedCount(0);
    setIsRevealing(false);
  }, [roundKey]);

  const revealNext = useCallback(() => {
    setIsRevealing(true);
    // Brief delay before showing the card for dramatic effect
    setTimeout(() => {
      setRevealedCount((prev) => prev + 1);
      setIsRevealing(false);
    }, 300);
  }, []);

  const revealAll = useCallback(() => {
    setRevealedCount(items.length);
  }, [items.length]);

  // If not enabled, show all items immediately
  if (!enabled) {
    return <div className={gridClass}>{items}</div>;
  }

  const allRevealed = revealedCount >= items.length;
  const currentIndex = revealedCount; // 0-based index of the next item to reveal

  return (
    <div>
      {/* Revealed items grid */}
      <div className={gridClass}>
        <AnimatePresence mode="sync">
          {items.slice(0, revealedCount).map((item, index) => (
            <motion.div
              key={`reveal-${roundKey}-${index}`}
              initial={{ opacity: 0, scale: 0.3, rotateY: 90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: index === revealedCount - 1 ? 0 : 0,
              }}
            >
              {item}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reveal controls */}
      {!allRevealed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 mt-8"
        >
          {/* Dramatic counter */}
          <div className="text-center">
            <p className="text-xs text-sand-dark uppercase tracking-[0.3em] mb-2">
              {revealedCount === 0
                ? "Tables are ready"
                : `${revealedCount} of ${items.length} revealed`}
            </p>
            {labels?.[currentIndex] && (
              <motion.p
                key={`label-${currentIndex}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-display text-sm text-spice mb-2"
              >
                Next: {labels[currentIndex]}
              </motion.p>
            )}
          </div>

          {/* Reveal button */}
          <motion.button
            onClick={revealNext}
            disabled={isRevealing}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-imperial-filled py-4 px-10 text-lg flex items-center gap-3 disabled:opacity-50"
          >
            <Eye size={22} />
            {revealedCount === 0 ? "Reveal First Table" : "Reveal Next Table"}
            <ChevronRight size={18} />
          </motion.button>

          {/* Skip button */}
          {revealedCount > 0 && (
            <button
              onClick={revealAll}
              className="text-xs text-sand-dark hover:text-sand uppercase tracking-widest transition-colors"
            >
              Show all remaining
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}
