import { useCallback, useRef } from "react";

interface SpiceExplosionProps {
  trigger: boolean;
  onComplete?: () => void;
  children: React.ReactNode;
}

export function SpiceExplosion({ trigger, onComplete, children }: SpiceExplosionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const createParticles = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Screen shake
    container.classList.add("shake");
    setTimeout(() => container.classList.remove("shake"), 500);

    // Create particles
    const count = 60;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      particle.className = "spice-particle";

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 100 + Math.random() * 300;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      particle.style.setProperty("--dx", `${dx}px`);
      particle.style.setProperty("--dy", `${dy}px`);
      particle.style.left = "50%";
      particle.style.top = "50%";
      particle.style.width = `${2 + Math.random() * 6}px`;
      particle.style.height = particle.style.width;
      particle.style.animationDuration = `${0.6 + Math.random() * 0.8}s`;

      // Vary colors between gold and orange
      const colors = ["#C5A059", "#D4A039", "#E8B84C", "#F5A623", "#C77B2A"];
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];

      container.appendChild(particle);

      // Remove particle after animation
      setTimeout(() => {
        particle.remove();
      }, 1500);
    }

    setTimeout(() => onComplete?.(), 600);
  }, [onComplete]);

  // Trigger particles when trigger changes to true
  if (trigger) {
    // Use microtask to avoid calling during render
    queueMicrotask(createParticles);
  }

  return (
    <div ref={containerRef} className="relative">
      {children}
    </div>
  );
}
