import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import type { Table, TableResult, Player, TournamentMode, LeaderTier } from "../engine/types";
import { LEADER_LIST, getLeadersByTier } from "../engine/types";
import { Pencil, AlertTriangle } from "lucide-react";

interface TableCardProps {
  table: Table;
  players: Player[];
  roundIndex: number;
  onSubmitResults: (roundIndex: number, tableId: number, results: TableResult[]) => void;
  animationDelay?: number;
  allowEdit?: boolean;
  availableLeaders?: string[];
  leaderTier?: LeaderTier;
  mode?: TournamentMode;
}

/** Local state shape for each player's result entry */
interface LocalResult {
  position: number;
  vp: number;
  leader: string;
  seatPosition: number;
  pickOrder: number;
}

/** Ordinal suffix for position numbers (1st, 2nd, 3rd, 4th) */
function positionSuffix(pos: number): string {
  if (pos === 1) return "st";
  if (pos === 2) return "nd";
  if (pos === 3) return "rd";
  return "th";
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
  allowEdit = false,
  availableLeaders,
  leaderTier,
  mode = "classic",
}: TableCardProps) {
  const isColosseum = mode === "colosseum";

  // In Colosseum mode, show all leaders from the round's tier (online game picks randomly)
  // In Classic mode, use the specific availableLeaders subset
  const leaderOptions: string[] | undefined = isColosseum && leaderTier
    ? getLeadersByTier(leaderTier).map((l) => l.name)
    : availableLeaders;
  const [editing, setEditing] = useState(allowEdit && !table.isComplete);
  const [results, setResults] = useState<Record<string, LocalResult>>(
    () => {
      if (table.isComplete) {
        const map: Record<string, LocalResult> = {};
        for (const r of table.results) {
          map[r.playerId] = {
            position: r.position,
            vp: r.vp,
            leader: r.leader || "",
            seatPosition: r.seatPosition || 0,
            pickOrder: r.pickOrder || 0,
          };
        }
        return map;
      }
      const map: Record<string, LocalResult> = {};
      for (const id of table.playerIds) {
        map[id] = { position: 0, vp: 0, leader: "", seatPosition: 0, pickOrder: 0 };
      }
      return map;
    }
  );

  const [error, setError] = useState<string | null>(null);
  const [wasComplete, setWasComplete] = useState(table.isComplete);

  // Sync local state when table is completed externally (e.g. auto-fill).
  // Only triggers when table.isComplete transitions from false -> true,
  // NOT when the user clicks the edit pencil on an already-complete table.
  useEffect(() => {
    if (table.isComplete && !wasComplete) {
      setWasComplete(true);
      setEditing(false);
      const map: Record<string, LocalResult> = {};
      for (const r of table.results) {
        map[r.playerId] = {
          position: r.position,
          vp: r.vp,
          leader: r.leader || "",
          seatPosition: r.seatPosition || 0,
          pickOrder: r.pickOrder || 0,
        };
      }
      setResults(map);
    }
    if (!table.isComplete && wasComplete) {
      setWasComplete(false);
    }
  }, [table.isComplete, table.results, wasComplete]);

  const tablePlayers = table.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as Player[];

  const handlePositionChange = (playerId: string, position: number) => {
    setError(null);
    setResults((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], position },
    }));
  };

  const handleVpChange = (playerId: string, vp: number) => {
    setError(null);
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

  const handleSeatPositionChange = (playerId: string, seatPosition: number) => {
    setError(null);
    setResults((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], seatPosition },
    }));
  };

  const handlePickOrderChange = (playerId: string, pickOrder: number) => {
    setError(null);
    setResults((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], pickOrder },
    }));
  };

  const handleSubmit = () => {
    // Validate: all positions must be set and unique
    const entries = Object.entries(results);
    const positions = entries.map(([, r]) => r.position);
    const uniquePositions = new Set(positions);

    if (positions.some((p) => p === 0)) {
      setError("All positions must be set.");
      return;
    }
    if (uniquePositions.size !== positions.length) {
      setError("Positions must be unique.");
      return;
    }

    // Validate: higher-placed players must have VP >= lower-placed players
    const sorted = [...entries].sort((a, b) => a[1].position - b[1].position);
    for (let i = 0; i < sorted.length - 1; i++) {
      const higher = sorted[i][1];
      const lower = sorted[i + 1][1];
      if (higher.vp < lower.vp) {
        const higherName = tablePlayers.find((p) => p.id === sorted[i][0])?.name ?? `#${higher.position}`;
        const lowerName = tablePlayers.find((p) => p.id === sorted[i + 1][0])?.name ?? `#${lower.position}`;
        setError(
          `VP conflict: ${higherName} (${higher.position}${positionSuffix(higher.position)} place, ${higher.vp} VP) ` +
          `has fewer VP than ${lowerName} (${lower.position}${positionSuffix(lower.position)} place, ${lower.vp} VP). ` +
          `A higher-placed player must have VP >= lower-placed players.`
        );
        return;
      }
    }

    // Validate: no duplicate leaders at the same table (Classic only)
    if (!isColosseum) {
      const leaders = entries.map(([, r]) => r.leader).filter(Boolean);
      const uniqueLeaders = new Set(leaders);
      if (uniqueLeaders.size !== leaders.length) {
        const seen = new Set<string>();
        for (const [, r] of entries) {
          if (r.leader && seen.has(r.leader)) {
            setError(`Duplicate leader: ${r.leader} is selected by multiple players at this table.`);
            return;
          }
          if (r.leader) seen.add(r.leader);
        }
      }
    }

    // Colosseum-only: validate seat positions and pick orders
    if (isColosseum) {
      const seatPositions = entries.map(([, r]) => r.seatPosition);
      const pickOrders = entries.map(([, r]) => r.pickOrder);

      if (seatPositions.some((s) => s === 0)) {
        setError("All seat positions must be set.");
        return;
      }
      if (new Set(seatPositions).size !== seatPositions.length) {
        setError("Seat positions must be unique.");
        return;
      }
      if (pickOrders.some((p) => p === 0)) {
        setError("All pick orders must be set.");
        return;
      }
      if (new Set(pickOrders).size !== pickOrders.length) {
        setError("Pick orders must be unique.");
        return;
      }
    }

    setError(null);
    const tableResults: TableResult[] = entries.map(
      ([playerId, { position, vp, leader, seatPosition, pickOrder }]) => ({
        playerId,
        position,
        vp,
        leader: leader || undefined,
        seatPosition: isColosseum ? seatPosition : undefined,
        pickOrder: isColosseum ? pickOrder : undefined,
      })
    );

    onSubmitResults(roundIndex, table.id, tableResults);
    setEditing(false);
  };

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
        </h3>
        {table.isComplete && !editing && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-spice opacity-60">
              Complete
            </span>
            {allowEdit && (
              <button
                onClick={() => setEditing(true)}
                className="text-sand-dark hover:text-spice transition-colors p-1"
                title="Edit results"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Players */}
      <div className="space-y-3">
        {tablePlayers.map((player) => {
          const result = results[player.id];
          return (
            <div
              key={player.id}
              className="py-2 border-b border-white/5 last:border-0"
            >
              {/* Line 1: Position, Name, VP, Points */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                <span className="flex-1 text-display text-sm min-w-[8rem]">
                  {player.name}
                </span>

                {/* Read-only compact: Seat + Pick + Leader inline (Colosseum, completed) */}
                {isColosseum && !editing && (
                  <>
                    {result?.seatPosition ? (
                      <span className="text-xs text-sand-dark opacity-50 w-8 text-center">
                        S{result.seatPosition}
                      </span>
                    ) : null}
                    {result?.leader ? (
                      <span className="text-xs text-sand-dark opacity-70 truncate max-w-[8rem] text-center" title={result.leader}>
                        {result.leader}
                      </span>
                    ) : null}
                  </>
                )}

                {/* Leader display (Classic, read-only) */}
                {!isColosseum && !editing && result?.leader && (
                  <span className="text-xs text-sand-dark opacity-70 w-36 truncate text-center" title={result.leader}>
                    {result.leader}
                  </span>
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
                    +{[6, 3, 2, 1][result.position - 1] || 0}
                  </span>
                )}
              </div>

              {/* Line 2: Seat + Leader (Colosseum editing only) */}
              {isColosseum && editing && (
                <div className="flex items-center gap-3 mt-1 ml-[4.25rem]">
                  {/* Seat */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-sand-dark uppercase tracking-widest">Seat</span>
                    <select
                      value={result?.seatPosition || 0}
                      onChange={(e) =>
                        handleSeatPositionChange(player.id, parseInt(e.target.value))
                      }
                      className="bg-black/50 border border-sand/20 text-sand text-xs px-1 py-1 rounded-sm w-14"
                    >
                      <option value={0}>--</option>
                      {[1, 2, 3, 4].map((s) => (
                        <option key={s} value={s}>
                          S{s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Leader selector (Pick) */}
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-[10px] text-sand-dark uppercase tracking-widest">Pick</span>
                    <select
                      value={result?.leader || ""}
                      onChange={(e) =>
                        handleLeaderChange(player.id, e.target.value)
                      }
                      className="bg-black/50 border border-spice/30 text-sand text-xs px-1 py-1 rounded-sm flex-1 truncate"
                    >
                      <option value="">Leader...</option>
                      {leaderOptions ? (
                        leaderOptions.map((name) => {
                          const info = LEADER_LIST.find((l) => l.name === name);
                          return (
                            <option key={info?.id ?? name} value={name}>
                              {name}
                            </option>
                          );
                        })
                      ) : (
                        (["base", "ix", "uprising", "bloodlines"] as const).map((exp) => {
                          const leadersByExp = LEADER_LIST.filter((l) => l.expansion === exp);
                          if (leadersByExp.length === 0) return null;
                          return (
                            <optgroup key={exp} label={exp.charAt(0).toUpperCase() + exp.slice(1)}>
                              {leadersByExp.map((l) => (
                                <option key={l.id} value={l.name}>
                                  {l.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>
              )}

              {/* Line 2: Leader selector (Classic editing only) */}
              {!isColosseum && editing && (
                <div className="flex items-center gap-3 mt-1 ml-[4.25rem]">
                  <select
                    value={result?.leader || ""}
                    onChange={(e) =>
                      handleLeaderChange(player.id, e.target.value)
                    }
                    className="bg-black/50 border border-spice/30 text-sand text-xs px-1 py-1 rounded-sm w-36 truncate"
                  >
                    <option value="">Leader...</option>
                    {leaderOptions ? (
                      leaderOptions.map((name) => {
                        const info = LEADER_LIST.find((l) => l.name === name);
                        return (
                          <option key={info?.id ?? name} value={name}>
                            {name}
                          </option>
                        );
                      })
                    ) : (
                      (["base", "ix", "uprising", "bloodlines"] as const).map((exp) => {
                        const leadersByExp = LEADER_LIST.filter((l) => l.expansion === exp);
                        if (leadersByExp.length === 0) return null;
                        return (
                          <optgroup key={exp} label={exp.charAt(0).toUpperCase() + exp.slice(1)}>
                            {leadersByExp.map((l) => (
                              <option key={l.id} value={l.name}>
                                {l.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })
                    )}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Validation error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 px-3 py-2 rounded-sm bg-blood/20 border border-blood/50 flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
