import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shuffle, X, AlertTriangle } from "lucide-react";
import type { Player } from "../engine/types";
import { TABLE_SIZE, validateManualTables } from "../engine/format";

interface ManualPairingModalProps {
  isOpen: boolean;
  /** Players of the stage, in seed order */
  players: Player[];
  title: string;
  onClose: () => void;
  onConfirm: (tables: string[][]) => void;
}

/** Organizer seats every player of a stage at tables of 4 */
export function ManualPairingModal({ isOpen, players, title, onClose, onConfirm }: ManualPairingModalProps) {
  const tableCount = Math.floor(players.length / TABLE_SIZE);
  const emptyTables = () => Array.from({ length: tableCount }, () => Array<string>(TABLE_SIZE).fill(""));
  const [tables, setTables] = useState<string[][]>(emptyTables);
  const [error, setError] = useState<string | null>(null);

  const seated = new Set(tables.flat().filter(Boolean));

  const setSeat = (tableIdx: number, seatIdx: number, playerId: string) => {
    setError(null);
    setTables((prev) => prev.map((t, ti) => t.map((p, si) => {
      if (ti === tableIdx && si === seatIdx) return playerId;
      // A player can only sit once: free their previous seat
      return p === playerId && playerId !== "" ? "" : p;
    })));
  };

  const fillSeedOrder = () => {
    setError(null);
    const ids = players.map((p) => p.id);
    setTables(Array.from({ length: tableCount }, (_, i) => ids.slice(i * TABLE_SIZE, (i + 1) * TABLE_SIZE)));
  };

  const shuffleAll = () => {
    setError(null);
    const ids = players.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setTables(Array.from({ length: tableCount }, (_, i) => ids.slice(i * TABLE_SIZE, (i + 1) * TABLE_SIZE)));
  };

  const handleConfirm = () => {
    const problem = validateManualTables(tables, players.map((p) => p.id));
    if (problem) {
      setError(problem);
      return;
    }
    onConfirm(tables);
    setTables(emptyTables());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/80 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 flex items-start justify-center z-50 p-4 overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="glass-morphism-strong rounded-sm p-6 max-w-3xl w-full my-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-display text-lg text-spice">{title}</h3>
                <button onClick={onClose} className="text-sand-dark hover:text-spice p-1" aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={fillSeedOrder} className="btn-imperial text-xs py-1.5 px-3">
                  Fill in seed order
                </button>
                <button onClick={shuffleAll} className="btn-imperial text-xs py-1.5 px-3 flex items-center gap-1">
                  <Shuffle size={12} /> Random
                </button>
                <span className="text-xs text-sand-dark self-center ml-auto">
                  {seated.size} / {players.length} seated
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tables.map((table, ti) => (
                  <div key={ti} className="stone-card rounded-sm p-3">
                    <p className="text-xs uppercase tracking-widest text-spice mb-2">Table #{ti + 1}</p>
                    <div className="space-y-1.5">
                      {table.map((playerId, si) => (
                        <select
                          key={si}
                          value={playerId}
                          onChange={(e) => setSeat(ti, si, e.target.value)}
                          aria-label={`Table ${ti + 1} seat ${si + 1}`}
                          className="w-full bg-black/50 border border-spice/30 text-sand text-sm px-2 py-1 rounded-sm"
                        >
                          <option value="">Seat {si + 1}…</option>
                          {players.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={seated.has(p.id) && p.id !== playerId}
                            >
                              {p.name}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 px-3 py-2 rounded-sm bg-blood/20 border border-blood/50 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-400">{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={onClose} className="btn-imperial text-sm py-2">Cancel</button>
                <button onClick={handleConfirm} className="btn-imperial-filled text-sm py-2 px-6">
                  Create Tables
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
