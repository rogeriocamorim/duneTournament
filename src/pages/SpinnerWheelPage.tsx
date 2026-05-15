import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, RotateCcw, Zap } from "lucide-react";
import type { Player } from "../engine/types";

const GROUP_NAMES = [
  "House Atreides", "House Harkonnen", "House Corrino", "Spacing Guild",
  "Bene Tleilaxu", "Ixian", "Bene Gesserit", "Fremen",
];

const GROUP_COLORS = [
  "#c5a059", "#9aa5b0", "#c0c0c0", "#cc2233",
  "#e891a8", "#40c080", "#9060d0", "#3399ff",
];

// Round-robin: player 1 → Atreides, player 2 → Harkonnen, ..., player 9 → Atreides again
function getNextGroup(assignedCount: number) {
  return assignedCount % 8;
}

interface SpinnerWheelPageProps {
  players: Player[];
  onConfirm: (groupAssignments: Map<string, number>) => void;
}

export function SpinnerWheelPage({ players, onConfirm }: SpinnerWheelPageProps) {
  // assignments: playerId → groupId
  const [assignments, setAssignments] = useState<Map<string, number>>(new Map());
  const [spinning, setSpinning] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spinRef = useRef<number>(0);

  const unassigned = players.filter((p) => !assignments.has(p.id));
  const assignedCount = assignments.size;
  const nextGroupIdx = getNextGroup(assignedCount);
  const allAssigned = assignedCount === players.length;
  const canProceed = allAssigned;

  // Draw wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || unassigned.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(cx, cy) - 8;
    const n = unassigned.length;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, W, H);

    unassigned.forEach((p, i) => {
      const startAngle = arc * i + (rotation * Math.PI) / 180;
      const endAngle = startAngle + arc;

      // Slice fill
      const hue = (i * 360) / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 55%, 22%)`;
      ctx.fill();
      ctx.strokeStyle = "rgba(197,160,89,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Text — radial, from inner to outer
      const midAngle = startAngle + arc / 2;
      const textStart = r * 0.22; // start near center
      const textEnd = r * 0.88;   // end near edge
      const tx = cx + Math.cos(midAngle) * (textStart + textEnd) / 2;
      const ty = cy + Math.sin(midAngle) * (textStart + textEnd) / 2;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle); // align text along the radius
      ctx.fillStyle = "#e8d8b0";
      const fontSize = Math.max(8, Math.min(13, 200 / n));
      ctx.font = `bold ${fontSize}px "Rajdhani", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Max chars based on available radial space
      const maxChars = Math.floor((textEnd - textStart) / (fontSize * 0.6));
      const label = p.name.length > maxChars ? p.name.slice(0, maxChars - 1) + "…" : p.name;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
    ctx.fillStyle = "#0a0906";
    ctx.fill();
    ctx.strokeStyle = "#c5a059";
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [unassigned, rotation]);

  const handleSpin = useCallback(() => {
    if (spinning || unassigned.length === 0) return;
    setSpinning(true);
    setShowResult(false);
    setSelectedPlayer(null);

    const totalSpin = 1440 + Math.random() * 1440; // 4–8 full rotations
    const duration = 3500;
    const start = performance.now();
    const startRot = spinRef.current;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const currentRot = startRot + totalSpin * eased;
      spinRef.current = currentRot;
      setRotation(currentRot % 360);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Determine winner: pointer is at top (270°), so find which slice is there
        const finalRot = currentRot % 360;
        const n = unassigned.length;
        const arc = 360 / n;
        // Pointer at top = 270° from canvas 0 (right)
        // Normalize: which slice index is under 270°?
        const pointerAngle = (270 - finalRot + 360 * 10) % 360;
        const idx = Math.floor(pointerAngle / arc) % n;
        const winner = unassigned[idx];

        setSelectedPlayer(winner ?? unassigned[0]);
        setShowResult(true);
        setSpinning(false);
      }
    };

    requestAnimationFrame(animate);
  }, [spinning, unassigned]);

  const handleConfirmPick = useCallback(() => {
    if (!selectedPlayer) return;
    const gid = nextGroupIdx;
    setAssignments((prev) => new Map([...prev, [selectedPlayer.id, gid]]));
    setSelectedPlayer(null);
    setShowResult(false);
  }, [selectedPlayer, nextGroupIdx]);

  const handleRejectPick = useCallback(() => {
    setSelectedPlayer(null);
    setShowResult(false);
  }, []);

  const handleAutoFill = useCallback(() => {
    const remaining = [...unassigned].sort(() => Math.random() - 0.5);
    const newAssignments = new Map(assignments);
    let count = assignedCount;
    for (const p of remaining) {
      newAssignments.set(p.id, count % 8);
      count++;
    }
    setAssignments(newAssignments);
    setSelectedPlayer(null);
    setShowResult(false);
  }, [unassigned, assignments, assignedCount]);

  const handleReset = useCallback(() => {
    setAssignments(new Map());
    setSelectedPlayer(null);
    setShowResult(false);
    spinRef.current = 0;
    setRotation(0);
  }, []);

  const handleProceed = useCallback(() => {
    onConfirm(assignments);
  }, [assignments, onConfirm]);

  // Build group display
  const groupSlots: Player[][] = Array.from({ length: 8 }, (_, gid) =>
    players.filter((p) => assignments.get(p.id) === gid)
  );

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <h1 className="text-display text-4xl text-spice spice-text-glow uppercase tracking-widest mb-2">
            The Draft
          </h1>
          <p className="text-sm text-sand-dark uppercase tracking-widest">
            {assignedCount} / {players.length} Gladiators Assigned
            {nextGroupIdx < 8 && !allAssigned && (
              <span className="ml-2" style={{ color: GROUP_COLORS[nextGroupIdx] }}>
                → {GROUP_NAMES[nextGroupIdx]}
              </span>
            )}
          </p>
        </motion.div>

        <div className="flex flex-col xl:flex-row gap-8">

          {/* LEFT: Wheel */}
          <div className="flex-shrink-0 flex flex-col items-center gap-4">

            {/* Pointer */}
            <div className="relative">
              {/* Arrow pointer */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-4 z-10 flex flex-col items-center">
                <div className="w-0 h-0"
                  style={{
                    borderLeft: "10px solid transparent",
                    borderRight: "10px solid transparent",
                    borderTop: "22px solid #c5a059",
                    filter: "drop-shadow(0 0 6px rgba(197,160,89,0.8))",
                  }}
                />
              </div>

              {unassigned.length > 0 ? (
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={380}
                  className="rounded-full"
                  style={{ boxShadow: "0 0 40px rgba(197,160,89,0.15), 0 0 0 2px rgba(197,160,89,0.2)" }}
                />
              ) : (
                <div className="w-[380px] h-[380px] rounded-full flex items-center justify-center glass-morphism border border-spice/20">
                  <span className="text-display text-spice text-lg uppercase tracking-widest">All Assigned!</span>
                </div>
              )}
            </div>

            {/* Spin button */}
            {!allAssigned && (
              <motion.button
                onClick={handleSpin}
                disabled={spinning || unassigned.length === 0}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="btn-imperial-filled px-12 py-4 text-base uppercase tracking-widest flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw size={20} className={spinning ? "animate-spin" : ""} />
                {spinning ? "Spinning..." : "Spin the Wheel"}
              </motion.button>
            )}

            {/* Auto-fill + Reset */}
            <div className="flex gap-3">
              {!allAssigned && (
                <button onClick={handleAutoFill}
                  className="btn-imperial py-2 px-5 flex items-center gap-2 text-sm">
                  <Zap size={14} /> Auto-Fill Remaining
                </button>
              )}
              {assignedCount > 0 && (
                <button onClick={handleReset}
                  className="btn-imperial py-2 px-5 flex items-center gap-2 text-sm text-blood border-blood/30 hover:border-blood">
                  <RotateCcw size={14} /> Reset
                </button>
              )}
            </div>

            {/* Result popup */}
            <AnimatePresence>
              {showResult && selectedPlayer && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  className="glass-morphism-strong rounded-sm p-5 w-[380px] text-center border"
                  style={{ borderColor: GROUP_COLORS[nextGroupIdx] + "60" }}
                >
                  <p className="text-xs text-sand-dark uppercase tracking-widest mb-1">Selected</p>
                  <p className="text-display text-2xl font-bold mb-1" style={{ color: GROUP_COLORS[nextGroupIdx] }}>
                    {selectedPlayer.name}
                  </p>
                  <p className="text-xs uppercase tracking-widest mb-4" style={{ color: GROUP_COLORS[nextGroupIdx] + "aa" }}>
                    → {GROUP_NAMES[nextGroupIdx]}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={handleConfirmPick}
                      className="btn-imperial-filled py-2 px-6 text-sm flex items-center gap-2">
                      <ChevronRight size={14} /> Confirm
                    </button>
                    <button onClick={handleRejectPick}
                      className="btn-imperial py-2 px-4 text-sm">
                      Re-spin
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT: Group boards */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {groupSlots.map((groupPlayers, gid) => {
              const color = GROUP_COLORS[gid];
              const isNext = gid === nextGroupIdx && !allAssigned;
              const isFull = groupPlayers.length === 8;

              return (
                <motion.div
                  key={gid}
                  animate={{ boxShadow: isNext ? `0 0 20px ${color}40, 0 0 0 1px ${color}60` : "none" }}
                  transition={{ duration: 0.4 }}
                  className="rounded-sm overflow-hidden glass-morphism"
                  style={{ border: `1px solid ${isNext ? color : color + "30"}` }}
                >
                  {/* Header */}
                  <div className="px-3 py-2 flex items-center gap-2"
                    style={{ background: `${color}18`, borderBottom: `1px solid ${color}25` }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color, boxShadow: isNext ? `0 0 8px ${color}` : "none" }} />
                    <span className="text-display text-xs uppercase tracking-wider font-bold truncate"
                      style={{ color }}>
                      {GROUP_NAMES[gid]}
                    </span>
                    <span className="ml-auto text-xs opacity-50" style={{ color }}>
                      {groupPlayers.length}/8
                    </span>
                  </div>

                  {/* Players */}
                  <div className="px-3 py-2 space-y-1 min-h-[120px]">
                    {groupPlayers.map((p, pidx) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: pidx * 0.04 }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-xs opacity-40 w-4 text-right flex-shrink-0"
                          style={{ color }}>{pidx + 1}</span>
                        <span className="text-xs text-sand truncate">{p.name}</span>
                      </motion.div>
                    ))}
                    {isNext && !isFull && (
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-xs opacity-40 w-4 text-right" style={{ color }}>
                          {groupPlayers.length + 1}
                        </span>
                        <span className="text-xs" style={{ color: color + "80" }}>awaiting spin…</span>
                      </motion.div>
                    )}
                    {Array.from({ length: Math.max(0, 8 - groupPlayers.length - (isNext && !isFull ? 1 : 0)) }).map((_, i) => (
                      <div key={i} className="h-4 rounded-sm opacity-10"
                        style={{ background: color, width: `${60 + Math.random() * 30}%` }} />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Proceed button */}
        <AnimatePresence>
          {canProceed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center mt-10"
            >
              <button
                onClick={handleProceed}
                className="btn-imperial-filled px-16 py-5 text-lg uppercase tracking-widest flex items-center gap-3"
              >
                <ChevronRight size={22} />
                Enter the Colosseum
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
