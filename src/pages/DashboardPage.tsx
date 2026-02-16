import { motion } from "motion/react";
import { useState, useRef, useCallback } from "react";
import { TableCard } from "../components/TableCard";
import { DramaticReveal } from "../components/DramaticReveal";
import { Leaderboard } from "../components/Leaderboard";
import { LeaderStatsPanel } from "../components/LeaderStatsPanel";
import type { TournamentState, TableResult } from "../engine/types";
import { Trophy, Swords, BarChart3, Crown } from "lucide-react";

interface DashboardPageProps {
  state: TournamentState;
  onGenerateRound: () => void;
  onSubmitResults: (roundIndex: number, tableId: number, results: TableResult[]) => void;
  onStartTop8: () => void;
  dramaticReveal: boolean;
}

type TabView = "tables" | "standings" | "leaders";

export function DashboardPage({
  state,
  onGenerateRound,
  onSubmitResults,
  onStartTop8,
  dramaticReveal,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<TabView>("tables");
  const [_showExplosion, setShowExplosion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentRound = state.rounds[state.rounds.length - 1];
  const completedQualifying = state.rounds.filter(
    (r) => r.type === "qualifying" && r.isComplete
  ).length;
  const needsNewRound = !currentRound || currentRound.isComplete;
  const qualifyingDone =
    completedQualifying >= state.settings.totalQualifyingRounds;

  const handleGenerateRound = useCallback(() => {
    // Trigger explosion
    setShowExplosion(true);
    const container = containerRef.current;
    if (container) {
      container.classList.add("shake");
      setTimeout(() => container.classList.remove("shake"), 500);

      // Create particles
      const count = 50;
      for (let i = 0; i < count; i++) {
        const particle = document.createElement("div");
        particle.className = "spice-particle";
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
        const distance = 80 + Math.random() * 250;
        particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        particle.style.left = "50%";
        particle.style.top = "40%";
        particle.style.width = `${2 + Math.random() * 5}px`;
        particle.style.height = particle.style.width;
        const colors = ["#C5A059", "#D4A039", "#E8B84C", "#F5A623"];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(particle);
        setTimeout(() => particle.remove(), 1500);
      }
    }

    setTimeout(() => {
      onGenerateRound();
      setShowExplosion(false);
    }, 400);
  }, [onGenerateRound]);

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto px-4 py-8 relative">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-display text-2xl md:text-3xl text-spice spice-text-glow mb-1">
          {state.metadata.tournamentName}
        </h1>
        <div className="flex items-center justify-center gap-4 text-xs text-sand-dark uppercase tracking-[0.2em]">
          <span>{state.players.length} Players</span>
          <span className="text-spice">|</span>
          <span>
            Round {completedQualifying} / {state.settings.totalQualifyingRounds}
          </span>
          <span className="text-spice">|</span>
          <span className="text-spice">{state.phase}</span>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setActiveTab("tables")}
          className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
            activeTab === "tables"
              ? "text-spice border-b-2 border-spice"
              : "text-sand-dark hover:text-sand"
          }`}
        >
          <Swords size={16} />
          Tables
        </button>
        <button
          onClick={() => setActiveTab("standings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
            activeTab === "standings"
              ? "text-spice border-b-2 border-spice"
              : "text-sand-dark hover:text-sand"
          }`}
        >
          <BarChart3 size={16} />
          Standings
        </button>
        <button
          onClick={() => setActiveTab("leaders")}
          className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
            activeTab === "leaders"
              ? "text-spice border-b-2 border-spice"
              : "text-sand-dark hover:text-sand"
          }`}
        >
          <Crown size={16} />
          Leaders
        </button>
      </div>

      {/* Content */}
      {activeTab === "tables" && (
        <div>
          {/* Generate Round / Advance */}
          {needsNewRound && !qualifyingDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-8"
            >
              <button
                onClick={handleGenerateRound}
                className="btn-imperial-filled text-lg py-4 px-10"
              >
                <span className="flex items-center gap-3">
                  <Swords size={20} />
                  Generate Round {state.rounds.length + 1}
                </span>
              </button>
            </motion.div>
          )}

          {qualifyingDone && state.phase === "qualifying" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-8"
            >
              <div className="glass-morphism-strong rounded-sm p-8 inline-block">
                <Trophy size={32} className="text-spice mx-auto mb-4" />
                <h2 className="text-display text-xl text-spice mb-2">
                  Qualifying Complete
                </h2>
                <p className="text-sm text-sand-dark mb-4">
                  The top 16 players advance to the Landsraad Finals.
                </p>
                <button
                  onClick={onStartTop8}
                  className="btn-imperial-filled py-3 px-8"
                >
                  Begin the Landsraad
                </button>
              </div>
            </motion.div>
          )}

          {/* Table Grid */}
          {currentRound && (
            <div>
              <h2 className="text-display text-sm text-sand-dark mb-4 text-center">
                Round {currentRound.number} &mdash;{" "}
                {currentRound.type === "qualifying"
                  ? "Qualifying"
                  : currentRound.type === "semifinal"
                  ? "Semifinal"
                  : currentRound.type === "winners-final"
                  ? "Winners & Losers Finals"
                  : currentRound.type === "grand-final"
                  ? "Grand Final"
                  : currentRound.type}
              </h2>
              <DramaticReveal
                roundKey={`qualifying-r${currentRound.number}`}
                enabled={dramaticReveal && !currentRound.isComplete}
                labels={currentRound.tables.map((t) => `Table #${t.id}`)}
                items={currentRound.tables.map((table, index) => (
                  <TableCard
                    key={`r${currentRound.number}-t${table.id}`}
                    table={table}
                    players={state.players}
                    roundIndex={state.rounds.length - 1}
                    onSubmitResults={onSubmitResults}
                    animationDelay={dramaticReveal ? 0 : index}
                    allowEdit={currentRound.isComplete}
                  />
                ))}
              />
            </div>
          )}

          {/* Completed round summary */}
          {currentRound?.isComplete && !qualifyingDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mt-4"
            >
              <p className="text-sm text-sand-dark uppercase tracking-widest">
                Round {currentRound.number} Complete &mdash; Review results above or generate the next round
              </p>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === "standings" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Leaderboard
            players={state.players}
            highlightTop={qualifyingDone ? 16 : 0}
          />
        </motion.div>
      )}

      {activeTab === "leaders" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <LeaderStatsPanel rounds={state.rounds} />
        </motion.div>
      )}
    </div>
  );
}
