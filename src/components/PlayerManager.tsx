import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { X, Pencil, Trash2, UserPlus, Check } from "lucide-react";
import type { Player } from "../engine/types";

interface PlayerManagerProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  onRenamePlayer: (id: string, name: string) => void;
  onDropPlayer: (id: string) => void;
  onAddPlayer: (name: string) => void;
}

export function PlayerManager({
  isOpen,
  onClose,
  players,
  onRenamePlayer,
  onDropPlayer,
  onAddPlayer,
}: PlayerManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [confirmDropId, setConfirmDropId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (player: Player) => {
    setEditingId(player.id);
    setEditName(player.name);
    setConfirmDropId(null);
  };

  const confirmEdit = () => {
    if (editingId && editName.trim()) {
      onRenamePlayer(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleAddPlayer = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddPlayer(trimmed);
    setNewName("");
    newInputRef.current?.focus();
  };

  const handleDrop = (id: string) => {
    onDropPlayer(id);
    setConfirmDropId(null);
  };

  const sortedPlayers = [...players].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="glass-morphism-strong rounded-sm p-6 max-w-md w-full relative max-h-[80vh] flex flex-col">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-sand-dark hover:text-spice transition-colors"
              >
                <X size={20} />
              </button>

              {/* Header */}
              <h2 className="text-display text-xl mb-1 text-spice spice-text-glow">
                Manage Players
              </h2>
              <p className="text-sm text-sand-dark mb-4 uppercase tracking-wider">
                {players.length} player{players.length !== 1 ? "s" : ""} registered
              </p>

              {/* Add Player */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddPlayer();
                }}
                className="flex gap-2 mb-4"
              >
                <input
                  ref={newInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Add new player..."
                  className="flex-1 px-3 py-2 bg-obsidian/50 border border-sand-dark/30 rounded-sm text-sand text-sm placeholder:text-sand-dark/40"
                />
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className={`px-3 py-2 rounded-sm border transition-all flex items-center gap-1.5 text-xs uppercase tracking-widest ${
                    newName.trim()
                      ? "border-fremen-blue/50 text-fremen-blue hover:bg-fremen-blue/20"
                      : "border-white/10 text-sand-dark/30 cursor-not-allowed"
                  }`}
                >
                  <UserPlus size={14} />
                  Add
                </button>
              </form>

              {/* Player List */}
              <div className="overflow-y-auto flex-1 space-y-1 pr-1">
                {sortedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border border-white/5 hover:border-white/10 transition-colors group"
                  >
                    {editingId === player.id ? (
                      /* Editing mode */
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          confirmEdit();
                        }}
                        className="flex items-center gap-2 flex-1"
                      >
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="flex-1 px-2 py-1 bg-obsidian/50 border border-spice/40 rounded-sm text-sand text-sm"
                        />
                        <button
                          type="submit"
                          disabled={!editName.trim()}
                          className="p-1 text-fremen-blue hover:text-fremen-blue/80 transition-colors"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1 text-sand-dark hover:text-sand transition-colors"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </form>
                    ) : confirmDropId === player.id ? (
                      /* Confirm drop mode */
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-blood flex-1">
                          Remove {player.name}?
                        </span>
                        <button
                          onClick={() => handleDrop(player.id)}
                          className="px-2 py-1 text-xs uppercase tracking-widest bg-blood/20 text-blood border border-blood/40 rounded-sm hover:bg-blood/30 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDropId(null)}
                          className="p-1 text-sand-dark hover:text-sand transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      /* Normal display mode */
                      <>
                        <span className="text-sm text-sand flex-1 truncate">
                          {player.name}
                        </span>
                        <span className="text-xs text-sand-dark/50">
                          {player.points}pts
                        </span>
                        <button
                          onClick={() => startEditing(player)}
                          className="p-1 text-sand-dark/30 hover:text-spice transition-colors opacity-0 group-hover:opacity-100"
                          title="Rename"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDropId(player.id);
                            setEditingId(null);
                          }}
                          className="p-1 text-sand-dark/30 hover:text-blood transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove from tournament"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer hint */}
              <p className="text-[10px] text-sand-dark/40 uppercase tracking-widest mt-4 text-center">
                Removed players' past results are preserved in round history
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
