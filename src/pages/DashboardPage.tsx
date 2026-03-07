import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { TableCard } from "../components/TableCard";
import { DramaticReveal } from "../components/DramaticReveal";
import { Leaderboard } from "../components/Leaderboard";
import { LeaderStatsPanel } from "../components/LeaderStatsPanel";
import { LeaderReveal } from "../components/animations/LeaderReveal";
import type { TournamentState, TableResult } from "../engine/types";
import { getLeaderInfo, getLeaderImageUrl } from "../engine/types";
import { generateRandomTableResults } from "../engine/testUtils";
import { Trophy, Swords, BarChart3, Crown, Eye, FlaskConical } from "lucide-react";

interface DashboardPageProps {
  state: TournamentState;
  onGenerateRound: () => void;
  onSubmitResults: (roundIndex: number, tableId: number, results: TableResult[]) => void;
  onBatchSubmitResults: (roundIndex: number, tables: { tableId: number; results: TableResult[] }[]) => void;
  onStartTop8: () => void;
  dramaticReveal: boolean;
  testMode: boolean;
}

type TabView = "tables" | "standings" | "leaders";

export function DashboardPage({
  state,
  onGenerateRound,
  onSubmitResults,
  onBatchSubmitResults,
  onStartTop8,
  dramaticReveal,
  testMode,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<TabView>("tables");
  const [_showExplosion, setShowExplosion] = useState(false);
  const [showLeaderReveal, setShowLeaderReveal] = useState(false);
  const [leaderRevealDone, setLeaderRevealDone] = useState(false);
  const [manualLeaderReveal, setManualLeaderReveal] = useState(false);
  const [tablesRevealed, setTablesRevealed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRevealedRound = useRef<number>(0);

  const currentRound = state.rounds[state.rounds.length - 1];
  const completedQualifying = state.rounds.filter(
    (r) => r.type === "qualifying" && r.isComplete
  ).length;
  const needsNewRound = !currentRound || currentRound.isComplete;
  const qualifyingDone =
    completedQualifying >= state.settings.totalQualifyingRounds;

  // Auto-show leader reveal when a new incomplete round with leaders appears
  // (covers Round 1 generated at tournament start and page refreshes)
  useEffect(() => {
    if (
      dramaticReveal &&
      currentRound &&
      !currentRound.isComplete &&
      currentRound.availableLeaders &&
      currentRound.number !== lastRevealedRound.current
    ) {
      lastRevealedRound.current = currentRound.number;
      setShowLeaderReveal(true);
      setLeaderRevealDone(false);
      setTablesRevealed(false);
    }
  }, [dramaticReveal, currentRound]);

  const handleAutoFillResults = useCallback(() => {
    if (!currentRound) return;
    const roundIndex = state.rounds.length - 1;
    const batch: { tableId: number; results: TableResult[] }[] = [];
    for (const table of currentRound.tables) {
      if (!table.isComplete) {
        const results = generateRandomTableResults(table, currentRound.availableLeaders);
        batch.push({ tableId: table.id, results });
      }
    }
    if (batch.length > 0) {
      onBatchSubmitResults(roundIndex, batch);
    }
  }, [currentRound, state.rounds.length, onBatchSubmitResults]);

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
            Round {currentRound?.number ?? 0} / {state.settings.totalQualifyingRounds}
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

      {/* Round Leaders button */}
      {currentRound?.availableLeaders && (
        <div className="flex justify-center mb-6">
          <button
            onClick={() => {
              setManualLeaderReveal(true);
              setShowLeaderReveal(true);
              setLeaderRevealDone(false);
            }}
            className="flex items-center gap-2 px-4 py-1.5 text-xs uppercase tracking-widest rounded-sm transition-all text-sand-dark hover:text-spice border border-white/10 hover:border-spice/40"
          >
            <Eye size={14} />
            Round {currentRound.number} Leaders
          </button>
        </div>
      )}

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
              {testMode && !currentRound.isComplete && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={handleAutoFillResults}
                    className="flex items-center gap-2 px-4 py-1.5 text-xs uppercase tracking-widest border border-fremen-blue/40 text-fremen-blue hover:bg-fremen-blue/10 transition-colors rounded-sm"
                  >
                    <FlaskConical size={14} />
                    Auto Fill All Tables
                  </button>
                </div>
              )}
              <DramaticReveal
                roundKey={`qualifying-r${currentRound.number}`}
                enabled={dramaticReveal && !currentRound.isComplete && leaderRevealDone}
                labels={currentRound.tables.map((t) => `Table #${t.id}`)}
                onAllRevealed={() => setTablesRevealed(true)}
                items={currentRound.tables.map((table, index) => (
                  <TableCard
                    key={`r${currentRound.number}-t${table.id}`}
                    table={table}
                    players={state.players}
                    roundIndex={state.rounds.length - 1}
                    onSubmitResults={onSubmitResults}
                    animationDelay={dramaticReveal ? 0 : index}
                    allowEdit={currentRound.isComplete}
                    availableLeaders={currentRound.availableLeaders}
                  />
                ))}
              />

              {/* Available Leaders for this round */}
              {currentRound.availableLeaders && tablesRevealed && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8"
                >
                  <h3 className="text-display text-xs text-sand-dark text-center mb-4 uppercase tracking-[0.2em]">
                    Round {currentRound.number} Available Leaders
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 justify-items-center">
                    {currentRound.availableLeaders.map((name) => {
                      const info = getLeaderInfo(name);
                      if (!info) return null;
                      return (
                        <div key={info.id} className="flex flex-col items-center">
                          <div
                            className="relative rounded-md overflow-hidden border border-spice/30"
                            style={{
                              boxShadow: "0 0 12px rgba(197, 160, 89, 0.15)",
                            }}
                          >
                            <img
                              src={getLeaderImageUrl(info)}
                              alt={info.name}
                              className="w-24 md:w-32 h-auto block"
                            />
                            {info.isCommunity && (
                              <div className="absolute top-1 right-1 bg-fremen-blue/90 text-obsidian text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-sm leading-tight">
                                Community
                              </div>
                            )}
                          </div>
                          <p className="text-display text-[10px] md:text-xs text-center mt-2 leading-tight max-w-24 md:max-w-32 text-sand">
                            {info.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
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

      {/* Leader Tier Reveal Overlay */}
      <AnimatePresence>
        {showLeaderReveal && currentRound?.availableLeaders && (
          <LeaderReveal
            leaders={currentRound.availableLeaders}
            tier={currentRound.leaderTier ?? "A"}
            skipToGrid={manualLeaderReveal}
            onComplete={() => {
              setShowLeaderReveal(false);
              setLeaderRevealDone(true);
              setManualLeaderReveal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
