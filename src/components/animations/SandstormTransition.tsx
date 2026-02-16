import { motion, AnimatePresence } from "motion/react";

interface SandstormTransitionProps {
  show: boolean;
  onComplete?: () => void;
}

export function SandstormTransition({ show, onComplete }: SandstormTransitionProps) {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          exit={{ clipPath: "inset(0 0% 0 100%)" }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* Sand overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, #1a1612 0%, #2a2018 30%, #1a1612 60%, #0a0a0a 100%)",
            }}
          />

          {/* Sand grain texture */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat",
            }}
          />

          {/* Horizontal sand streaks */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-px"
              style={{
                top: `${10 + i * 12}%`,
                left: 0,
                right: 0,
                background: `linear-gradient(90deg, transparent, rgba(197, 160, 89, ${0.1 + Math.random() * 0.2}), transparent)`,
                height: `${1 + Math.random() * 3}px`,
              }}
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{
                duration: 0.4 + Math.random() * 0.3,
                delay: i * 0.05,
                ease: "linear",
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
