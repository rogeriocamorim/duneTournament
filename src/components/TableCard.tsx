import { motion } from "motion/react";
import { useState } from "react";
import type { Table, TableResult, Player } from "../engine/types";
import { LEADER_LIST } from "../engine/types";

interface TableCardProps {
  table: Table;
  players: Player[];
  roundIndex: number;
  onSubmitResults: (roundIndex: number, tableId: number, results: TableResult[]) => void;
  animationDelay?: number;
}

const tableVariants = {
  hidden: { scale: 0, rotate: -15, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: {
      delay: i * 0.1,
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  }),
};

export function TableCard({
  table,
  players,
  roundIndex,
  onSubmitResults,
  animationDelay = 0,
}: TableCardProps) {
  const [editing, setEditing] = useState(!table.isComplete);
  const [results, setResults] = useState<Record<string, { position: number; vp: number; leader: string }>>(
    () => {
      if (table.isComplete) {
        const map: Record<string, { position: number; vp: number; leader: string }> = {};
        for (const r of table.results) {
          map[r.playerId] = { position: r.position, vp: r.vp, leader: r.leader || "" };
        }
        return map;
      }
      const map: Record<string, { position: number; vp: number; leader: string }> = {};
      for (const id of table.playerIds) {
        map[id] = { position: 0, vp: 0, leader: "" };
      }
      return map;
    }
  );

  const tablePlayers = table.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as Player[];

  const handlePositionChange = (playerId: string, position: number) => {
    setResults((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], position },
    }));
  };

  const handleVpChange = (playerId: string, vp: number) => {
    setResults((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], vp },
    }));
  };

  const handleLeaderChange = (playerId: string, leader: string) => {
    setResults((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], leader },
    }));
  };

  const handleSubmit = () => {
    // Validate: all positions must be set and unique
    const positions = Object.values(results).map((r) => r.position);
    const uniquePositions = new Set(positions);

    if (positions.some((p) => p === 0)) {
      alert("All positions must be set");
      return;
    }
    if (uniquePositions.size !== positions.length) {
      alert("Positions must be unique");
      return;
    }

    const tableResults: TableResult[] = Object.entries(results).map(
      ([playerId, { position, vp, leader }]) => ({
        playerId,
        position,
        vp,
        leader: leader || undefined,
      })
    );

    onSubmitResults(roundIndex, table.id, tableResults);
    setEditing(false);
  };

  const isDescentTable = table.playerIds.length === 3;

  return (
    <motion.div
      custom={animationDelay}
      initial="hidden"
      animate="visible"
      variants={tableVariants}
      className="stone-card rounded-sm p-5"
    >
      {/* Table header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-display text-sm">
          <span className="fremen-glow text-lg mr-2">#{table.id}</span>
          {isDescentTable && (
            <span className="text-xs text-blood opacity-70 ml-1">DESCENT</span>
          )}
        </h3>
        {table.isComplete && (
          <span className="text-xs uppercase tracking-widest text-spice opacity-60">
            Complete
          </span>
        )}
      </div>

      {/* Players */}
      <div className="space-y-3">
        {tablePlayers.map((player) => {
          const result = results[player.id];
          return (
            <div
              key={player.id}
              className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
            >
              {/* Position selector */}
              {editing ? (
                <select
                  value={result?.position || 0}
                  onChange={(e) =>
                    handlePositionChange(player.id, parseInt(e.target.value))
                  }
                  className="bg-black/50 border border-spice/30 text-spice text-score px-2 py-1 rounded-sm w-14 text-center"
                >
                  <option value={0}>--</option>
                  {Array.from({ length: table.playerIds.length }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`text-score text-lg w-14 text-center ${
                    result?.position === 1
                      ? "text-[#FFD700]"
                      : result?.position === 2
                      ? "text-[#C0C0C0]"
                      : "text-sand-dark"
                  }`}
                >
                  {result?.position || "-"}
                </span>
              )}

              {/* Player name */}
              <span className="flex-1 text-display text-sm truncate min-w-0">
                {player.name}
              </span>

              {/* Leader selector */}
              {editing ? (
                <select
                  value={result?.leader || ""}
                  onChange={(e) =>
                    handleLeaderChange(player.id, e.target.value)
                  }
                  className="bg-black/50 border border-spice/30 text-sand text-xs px-1 py-1 rounded-sm w-28 truncate"
                >
                  <option value="">Leader...</option>
                  {(["base", "ix", "uprising", "bloodlines"] as const).map((exp) => {
                    const leaders = LEADER_LIST.filter((l) => l.expansion === exp);
                    if (leaders.length === 0) return null;
                    return (
                      <optgroup key={exp} label={exp.charAt(0).toUpperCase() + exp.slice(1)}>
                        {leaders.map((l) => (
                          <option key={l.id} value={l.name}>
                            {l.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              ) : (
                result?.leader && (
                  <span className="text-xs text-sand-dark opacity-70 w-28 truncate text-center" title={result.leader}>
                    {result.leader}
                  </span>
                )
              )}

              {/* VP input */}
              {editing ? (
                <input
                  type="number"
                  min={0}
                  value={result?.vp || ""}
                  onChange={(e) =>
                    handleVpChange(player.id, parseInt(e.target.value) || 0)
                  }
                  placeholder="VP"
                  className="bg-black/50 border border-spice/30 text-score text-sm px-2 py-1 rounded-sm w-16 text-center text-white"
                />
              ) : (
                <span className="text-score text-sm opacity-60 w-16 text-center">
                  {result?.vp || 0} VP
                </span>
              )}

              {/* Points display */}
              {!editing && result?.position && (
                <span className="text-score text-spice text-sm w-12 text-right">
                  +{[5, 3, 2, 1][result.position - 1] || 0}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {editing && (
        <button
          onClick={handleSubmit}
          className="btn-imperial-filled w-full mt-4 py-2 text-sm"
        >
          Confirm Results
        </button>
      )}
    </motion.div>
  );
}
