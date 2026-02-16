import { motion } from "motion/react";
import { useState } from "react";
import { TableCard } from "../components/TableCard";
import { Leaderboard } from "../components/Leaderboard";
import type { TournamentState, TableResult } from "../engine/types";
import { getTop8, getFinalStandings } from "../engine/tournament";
import { Trophy, Crown, Swords, ChevronRight, BarChart3 } from "lucide-react";

const ELITE_TABLE_LABELS = ["Elite Table A", "Elite Table B"];
const CHALLENGER_TABLE_LABELS = ["Challenger Table C", "Challenger Table D"];
const REDEMPTION_LABELS = ["Trial of Gom Jabbar", "Water of Life"];

interface Top8PageProps {
  state: TournamentState;
  onSubmitResults: (roundIndex: number, tableId: number, results: TableResult[]) => void;
  onGenerateTop8Round: () => void;
  onStartTop8: () => void;
}

export function Top8Page({
  state,
  onSubmitResults,
  onGenerateTop8Round,
  onStartTop8,
}: Top8PageProps) {
  const [showStandings, setShowStandings] = useState(false);
  const top8 = getTop8(state);

  const top8Rounds = state.rounds.filter(
    (r) =>
      r.type === "semifinal" ||
      r.type === "winners-final" ||
      r.type === "losers-final" ||
      r.type === "grand-final"
  );

  // Determine which round is the "current" displayed round in this page
  // Show the latest elimination round, or the last qualifying round if none yet
  const lastElimRound = [...state.rounds].reverse().find(
    (r) => r.type === "semifinal" || r.type === "winners-final" || r.type === "losers-final" || r.type === "grand-final"
  );
  const currentRound = lastElimRound ?? state.rounds[state.rounds.length - 1];
  const needsGeneration =
    state.phase === "top8" &&
    (!currentRound ||
      currentRound.isComplete) &&
    top8Rounds.length === 0;

  const canGenerateNext =
    currentRound?.isComplete &&
    (currentRound.type === "semifinal" || currentRound.type === "winners-final");

  const isFinished = state.phase === "finished";

  // Compute final standings that respect Grand Final placement
  const finalStandings = isFinished ? getFinalStandings(state) : undefined;

  // Find the grand final winner
  const grandFinal = state.rounds.find((r) => r.type === "grand-final");
  const winner = grandFinal?.isComplete
    ? (() => {
        const winnerResult = [...(grandFinal.tables[0]?.results || [])].sort(
          (a, b) => a.position - b.position
        )[0];
        return winnerResult
          ? state.players.find((p) => p.id === winnerResult.playerId)
          : null;
      })()
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-display text-2xl md:text-3xl text-spice spice-text-glow mb-1">
          {isFinished ? "The Prophecy Fulfilled" : "The Landsraad"}
        </h1>
        <p className="text-xs text-sand-dark uppercase tracking-[0.3em]">
          {isFinished
            ? "A New Emperor Rises"
            : "Double-Chance Championship Pods"}
        </p>
      </motion.div>

      {/* Winner Display */}
      {isFinished && winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
          className="text-center mb-12"
        >
          <div className="inline-block p-8 stone-card spice-glow rounded-sm">
            <Crown size={48} className="text-[#FFD700] mx-auto mb-4" />
            <h2 className="text-display text-3xl text-[#FFD700] mb-2">
              {winner.name}
            </h2>
            <p className="text-sm text-spice uppercase tracking-widest mb-4">
              Emperor of the Known Universe
            </p>
            <div className="flex gap-6 justify-center text-score">
              <div>
                <span className="text-2xl text-spice">{winner.points}</span>
                <span className="text-xs text-sand-dark block">Points</span>
              </div>
              <div>
                <span className="text-2xl fremen-glow">{winner.totalVP}</span>
                <span className="text-xs text-sand-dark block">VP</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top 16 Seedings */}
      {!isFinished && top8Rounds.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-display text-sm text-center text-sand-dark mb-4">
            Top 16 Seedings
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {top8.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="glass-morphism rounded-sm px-4 py-3 flex items-center gap-3"
              >
                <span className="text-score fremen-glow w-6">{i + 1}</span>
                <span className="text-display text-sm flex-1">{player.name}</span>
                <span className="text-score text-spice text-sm">{player.points}pts</span>
              </motion.div>
            ))}
          </div>

          {needsGeneration && (
            <div className="text-center mt-6">
              <button onClick={onStartTop8} className="btn-imperial-filled py-3 px-8">
                <span className="flex items-center gap-2">
                  <Swords size={18} />
                  Begin Semifinals
                </span>
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Current Round Tables */}
      {currentRound && (currentRound.type === "semifinal" || currentRound.type === "winners-final" || currentRound.type === "losers-final" || currentRound.type === "grand-final") && (
        <div className="mb-8">
          {/* ── Semifinals: split into Elite & Challenger sections ── */}
          {currentRound.type === "semifinal" && (
            <>
              {/* Elite Bracket */}
              <h2 className="text-display text-sm text-center text-sand-dark mb-4">
                Round {currentRound.number} — Elite Bracket (1-8)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {currentRound.tables.slice(0, 2).map((table, index) => (
                  <div key={`r${currentRound.number}-t${table.id}`}>
                    <p className="text-xs text-center text-spice uppercase tracking-widest mb-2">
                      {ELITE_TABLE_LABELS[index] ?? `Table ${index + 1}`}
                    </p>
                    <TableCard
                      table={table}
                      players={state.players}
                      roundIndex={state.rounds.indexOf(currentRound)}
                      onSubmitResults={onSubmitResults}
                      animationDelay={index}
                      allowEdit={currentRound.isComplete}
                    />
                  </div>
                ))}
              </div>

              {/* Challenger Bracket */}
              <h2 className="text-display text-sm text-center text-sand-dark mb-4">
                Round {currentRound.number} — Challenger Bracket (9-16)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentRound.tables.slice(2, 4).map((table, index) => (
                  <div key={`r${currentRound.number}-t${table.id}`}>
                    <p className="text-xs text-center text-sand-dark uppercase tracking-widest mb-2">
                      {CHALLENGER_TABLE_LABELS[index] ?? `Table ${index + 3}`}
                    </p>
                    <TableCard
                      table={table}
                      players={state.players}
                      roundIndex={state.rounds.indexOf(currentRound)}
                      onSubmitResults={onSubmitResults}
                      animationDelay={index + 2}
                      allowEdit={currentRound.isComplete}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Redemption Round ── */}
          {currentRound.type === "winners-final" && (
            <>
              <h2 className="text-display text-sm text-center text-sand-dark mb-4">
                Round {currentRound.number} — Redemption Round
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentRound.tables.map((table, index) => (
                  <div key={`r${currentRound.number}-t${table.id}`}>
                    <p className="text-xs text-center text-spice uppercase tracking-widest mb-2">
                      {REDEMPTION_LABELS[index] ?? `Redemption ${index + 1}`}
                    </p>
                    <TableCard
                      table={table}
                      players={state.players}
                      roundIndex={state.rounds.indexOf(currentRound)}
                      onSubmitResults={onSubmitResults}
                      animationDelay={index}
                      allowEdit={currentRound.isComplete}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Grand Final ── */}
          {currentRound.type === "grand-final" && (
            <>
              <h2 className="text-display text-sm text-center text-sand-dark mb-4">
                Round {currentRound.number} — Grand Final
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentRound.tables.map((table, index) => (
                  <div key={`r${currentRound.number}-t${table.id}`}>
                    <TableCard
                      table={table}
                      players={state.players}
                      roundIndex={state.rounds.indexOf(currentRound)}
                      onSubmitResults={onSubmitResults}
                      animationDelay={index}
                      allowEdit={currentRound.isComplete}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Advance */}
      {canGenerateNext && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <button
            onClick={onGenerateTop8Round}
            className="btn-imperial-filled py-3 px-8 flex items-center gap-2 mx-auto"
          >
            <ChevronRight size={18} />
            {currentRound?.type === "semifinal" ? "Generate Redemption Round" : "Generate Grand Final"}
          </button>
        </motion.div>
      )}

      {/* Grand final complete but not yet "finished" */}
      {currentRound?.type === "grand-final" && currentRound.isComplete && !isFinished && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-8"
        >
          <button
            onClick={onGenerateTop8Round}
            className="btn-imperial-filled py-3 px-8 flex items-center gap-2 mx-auto"
          >
            <Trophy size={18} />
            Crown the Emperor
          </button>
        </motion.div>
      )}

      {/* Round History */}
      {top8Rounds.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowStandings(!showStandings)}
            className="flex items-center gap-2 text-sm text-sand-dark hover:text-sand uppercase tracking-widest mb-4 mx-auto"
          >
            <BarChart3 size={14} />
            {showStandings ? "Hide" : "Show"} Full Standings
          </button>
          {showStandings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <Leaderboard players={state.players} highlightTop={16} finalStandings={finalStandings} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
