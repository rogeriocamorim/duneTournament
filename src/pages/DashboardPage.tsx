import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { TableCard } from "../components/TableCard";
import { DramaticReveal } from "../components/DramaticReveal";
import { Leaderboard } from "../components/Leaderboard";
import { LeaderStatsPanel } from "../components/LeaderStatsPanel";
import { GroupStandings } from "../components/GroupStandings";
import { SeatPickStatsPanel } from "../components/SeatPickStatsPanel";
import { RoundHistory } from "../components/RoundHistory";
import { LeaderReveal } from "../components/animations/LeaderReveal";
import { PlayerManager } from "../components/PlayerManager";
import { ManualPairingModal } from "../components/ManualPairingModal";
import type { TournamentState, TableResult } from "../engine/types";
import { getLeaderInfo } from "../engine/types";
import {
  computeAdvancement,
  getCustomFinalStandings,
  getFormat,
  getRoundStageName,
  getStageEntrants,
  getStageRounds,
  getStageStandings,
  getTableCardRoundProps,
  getTierColor,
  getTiers,
  isStageComplete,
} from "../engine/format";
import { LeaderImage } from "../components/LeaderImage";
import { generateRandomTableResults } from "../engine/testUtils";
import { getTierForRound } from "../engine/tournament";
import { exportGroupsCSV } from "../utils/csvExport";
import { Trophy, Swords, BarChart3, Crown, Eye, FlaskConical, History, Users, Armchair, Download, UserCog, ChevronRight } from "lucide-react";

interface DashboardPageProps {
  state: TournamentState;
  onGenerateRound: (tables?: string[][]) => void;
  /** Custom mode: move to the next stage (or finish after the last one) */
  onAdvanceStage?: () => void;
  onSubmitResults: (roundIndex: number, tableId: number, results: TableResult[]) => void;
  onBatchSubmitResults: (roundIndex: number, tables: { tableId: number; results: TableResult[] }[]) => void;
  onStartTop8: () => void;
  onRenamePlayer: (id: string, name: string) => void;
  onDropPlayer: (id: string) => void;
  onAddPlayer: (name: string) => void;
  dramaticReveal: boolean;
  testMode: boolean;
}

type TabView = "tables" | "groups" | "standings" | "leaders" | "seats" | "history";

export function DashboardPage({
  state,
  onGenerateRound,
  onAdvanceStage,
  onSubmitResults,
  onBatchSubmitResults,
  onStartTop8,
  onRenamePlayer,
  onDropPlayer,
  onAddPlayer,
  dramaticReveal,
  testMode,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<TabView>("tables");
  const [_showExplosion, setShowExplosion] = useState(false);
  const [showLeaderReveal, setShowLeaderReveal] = useState(false);
  const [leaderRevealDone, setLeaderRevealDone] = useState(false);
  const [manualLeaderReveal, setManualLeaderReveal] = useState(false);
  const [tablesRevealed, setTablesRevealed] = useState(false);
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRevealedRound = useRef<number>(0);

  const isColosseum = state.mode === "colosseum";
  const isCustom = state.mode === "custom";
  const isFinished = state.phase === "finished";
  const format = getFormat(state);
  const tiers = getTiers(state);
  const [showManualPairing, setShowManualPairing] = useState(false);
  const [standingsView, setStandingsView] = useState<"stage" | "overall">("stage");

  // ── Custom mode: current stage ──
  const stageIndex = state.currentStage ?? 0;
  const stage = isCustom ? format.stages[stageIndex] : undefined;
  const nextStage = isCustom ? format.stages[stageIndex + 1] : undefined;
  const stageRounds = isCustom ? getStageRounds(state, stageIndex) : [];
  const stageComplete = isCustom && isStageComplete(state, stageIndex);
  const stagePlayers = isCustom
    ? getStageEntrants(state, stageIndex).map((id) => state.players.find((p) => p.id === id)!).filter(Boolean)
    : [];
  const advancingIds = isCustom && stageComplete && nextStage ? computeAdvancement(state, stageIndex) : [];

  // Colosseum: navigate between pre-generated rounds (0-indexed into state.rounds)
  const [displayRoundIndex, setDisplayRoundIndex] = useState(() => {
    if (!isColosseum || state.rounds.length === 0) return 0;
    const firstIncomplete = state.rounds.findIndex((r) => !r.isComplete);
    return firstIncomplete >= 0 ? firstIncomplete : state.rounds.length - 1;
  });

  // Classic: always show latest round; Colosseum: show selected round
  const activeRoundIndex = isColosseum
    ? Math.min(displayRoundIndex, Math.max(0, state.rounds.length - 1))
    : state.rounds.length - 1;
  const currentRound = state.rounds[activeRoundIndex];

  const completedQualifying = state.rounds.filter(
    (r) => r.type === "qualifying" && r.isComplete
  ).length;
  const needsNewRound = !isColosseum && (!currentRound || currentRound.isComplete);
  const qualifyingDone = isCustom
    ? false
    : completedQualifying >= state.settings.totalQualifyingRounds;
  const canGenerateStageRound = isCustom && !isFinished && !!stage &&
    (!currentRound || currentRound.isComplete) && stageRounds.length < stage.rounds;

  // When navigating rounds in Colosseum, skip reveal for already-viewed/complete rounds
  useEffect(() => {
    if (isColosseum && currentRound) {
      if (currentRound.isComplete || currentRound.number <= lastRevealedRound.current) {
        setLeaderRevealDone(true);
        setTablesRevealed(true);
      }
    }
  }, [isColosseum, displayRoundIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-show leader reveal when a new incomplete round with leaders appears (Classic only)
  useEffect(() => {
    if (
      !isColosseum &&
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
  }, [dramaticReveal, currentRound, isColosseum]);

  const handleAutoFillResults = useCallback(() => {
    if (!currentRound) return;
    const batch: { tableId: number; results: TableResult[] }[] = [];
    for (const table of currentRound.tables) {
      if (!table.isComplete) {
        const results = generateRandomTableResults(table, currentRound.availableLeaders, state.mode);
        const clock = getTableCardRoundProps(state, currentRound).clock;
        if (clock) {
          // Test data: minutes spread around the budget so some players get penalties
          for (const r of results) r.minutesUsed = Math.round((clock.budgetMinutes * (0.7 + Math.random() * 0.45)) * 10) / 10;
        }
        batch.push({ tableId: table.id, results });
      }
    }
    if (batch.length > 0) {
      onBatchSubmitResults(activeRoundIndex, batch);
    }
  }, [currentRound, activeRoundIndex, onBatchSubmitResults, state]);

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

  const handleGenerateClick = () => {
    if (isCustom && stage?.pairing === "manual") {
      setShowManualPairing(true);
      return;
    }
    handleGenerateRound();
  };

  // Custom mode standings: stage standings + final standings once finished
  const customFinalStandings = isCustom && isFinished ? getCustomFinalStandings(state) : undefined;
  const stageStandings = isCustom && !isFinished && stageIndex > 0 ? getStageStandings(state, stageIndex) : undefined;
  const customWinner = customFinalStandings?.[0];

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
        {isCustom && stage && (
          <p className="text-xs text-fremen-blue uppercase tracking-[0.3em] mb-1">
            {isFinished ? "Tournament Complete" : `Stage ${stageIndex + 1} / ${format.stages.length} — ${stage.name}`}
          </p>
        )}
        <div className="flex items-center justify-center gap-4 text-xs text-sand-dark uppercase tracking-[0.2em]">
          <button
            onClick={() => setShowPlayerManager(true)}
            className="inline-flex items-center gap-1 hover:text-spice transition-colors"
            title="Manage Players"
          >
            <UserCog size={12} />
            {state.players.length} Players
          </button>
          <span className="text-spice">|</span>
          <span>
            {isCustom && stage
              ? `Round ${stageRounds.length} / ${stage.rounds}`
              : `Round ${currentRound?.number ?? 0} / ${state.settings.totalQualifyingRounds}`}
          </span>
          <span className="text-spice">|</span>
          <span className="text-spice">{state.phase}</span>
          {isColosseum && (
            <>
              <span className="text-spice">|</span>
              <button
                onClick={() => exportGroupsCSV(state)}
                className="inline-flex items-center gap-1 text-sand-dark hover:text-fremen-blue transition-colors"
                title="Export Group Standings (XLSX)"
              >
                <Download size={12} />
                Export
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex justify-center gap-4 mb-8 flex-wrap">
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
        {isColosseum && (
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
              activeTab === "groups"
                ? "text-spice border-b-2 border-spice"
                : "text-sand-dark hover:text-sand"
            }`}
          >
            <Users size={16} />
            Standings
          </button>
        )}
        <button
          onClick={() => setActiveTab("standings")}
          className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
            activeTab === "standings"
              ? "text-spice border-b-2 border-spice"
              : "text-sand-dark hover:text-sand"
          }`}
        >
          <BarChart3 size={16} />
          Overall
        </button>
        {state.phase === "finished" && (
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
        )}
        {isColosseum && state.phase === "finished" && (
          <button
            onClick={() => setActiveTab("seats")}
            className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
              activeTab === "seats"
                ? "text-spice border-b-2 border-spice"
                : "text-sand-dark hover:text-sand"
            }`}
          >
            <Armchair size={16} />
            Seats
          </button>
        )}
        {state.rounds.filter((r) => r.isComplete).length > 1 && (
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
              activeTab === "history"
                ? "text-spice border-b-2 border-spice"
                : "text-sand-dark hover:text-sand"
            }`}
          >
            <History size={16} />
            History
          </button>
        )}
      </div>

      {/* Round Leaders button (Classic only) */}
      {!isColosseum && currentRound?.availableLeaders && (
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
          {/* Colosseum: Round Navigation */}
          {isColosseum && state.rounds.length > 0 && (
            <div className="flex justify-center gap-2 mb-6">
              {state.rounds
                .filter((r) => r.type === "qualifying")
                .map((round, idx) => {
                  const isActive = idx === displayRoundIndex;
                  const isComplete = round.isComplete;
                  const inProgress =
                    !isComplete && round.tables.some((t) => t.isComplete);
                  const tier = round.leaderTier ?? getTierForRound(round.number, false);
                  const tierColor = getTierColor(tiers, tier);
                  return (
                    <div key={round.number} className="flex flex-col items-center gap-1">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm border"
                        style={{ color: tierColor, borderColor: tierColor, background: `${tierColor}18` }}
                      >
                        {tier}
                      </span>
                      <button
                        onClick={() => setDisplayRoundIndex(idx)}
                        className={`px-4 py-2 text-xs uppercase tracking-widest rounded-sm border transition-all ${
                          isActive
                            ? "border-spice bg-spice/20 text-spice"
                            : isComplete
                            ? "border-spice/30 text-spice/60 hover:border-spice/50"
                            : inProgress
                            ? "border-fremen-blue/40 text-fremen-blue hover:border-fremen-blue/60"
                            : "border-white/10 text-sand-dark hover:border-white/20"
                        }`}
                      >
                        R{round.number}
                        {isComplete && " \u2713"}
                        {inProgress && !isComplete && " \u25CF"}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Custom: winner banner */}
          {isCustom && isFinished && customWinner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="text-center mb-10"
            >
              <div className="inline-block p-8 stone-card spice-glow rounded-sm">
                <Crown size={48} className="text-[#FFD700] mx-auto mb-4" />
                <h2 className="text-display text-3xl text-[#FFD700] mb-2">{customWinner.name}</h2>
                <p className="text-sm text-spice uppercase tracking-widest">Emperor of the Known Universe</p>
              </div>
            </motion.div>
          )}

          {/* Custom: Generate next round of the stage */}
          {canGenerateStageRound && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-8"
            >
              <button
                onClick={handleGenerateClick}
                className="btn-imperial-filled text-lg py-4 px-10"
              >
                <span className="flex items-center gap-3">
                  <Swords size={20} />
                  {stage?.name} &mdash; Round {stageRounds.length + 1}
                </span>
              </button>
              {stage?.pairing === "manual" && (
                <p className="text-xs text-sand-dark mt-2 uppercase tracking-widest">Tables are set manually</p>
              )}
            </motion.div>
          )}

          {/* Custom: stage complete → advance or finish */}
          {isCustom && !isFinished && stageComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-8"
            >
              <div className="glass-morphism-strong rounded-sm p-8 inline-block max-w-2xl">
                <Trophy size={32} className="text-spice mx-auto mb-4" />
                <h2 className="text-display text-xl text-spice mb-2">{stage?.name} Complete</h2>
                {nextStage ? (
                  <>
                    <p className="text-sm text-sand-dark mb-3">
                      {advancingIds.length} players advance to <span className="text-spice">{nextStage.name}</span>
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mb-5">
                      {advancingIds.map((id, i) => (
                        <span key={id} className="text-xs glass-morphism px-2 py-1 rounded-sm">
                          <span className="fremen-glow mr-1">{i + 1}</span>
                          {state.players.find((p) => p.id === id)?.name ?? id}
                        </span>
                      ))}
                    </div>
                    {advancingIds.length % 4 !== 0 && (
                      <p className="text-xs text-blood mb-3">
                        {advancingIds.length} players cannot be seated at tables of 4 &mdash; adjust the stage in Settings.
                      </p>
                    )}
                    <button
                      onClick={onAdvanceStage}
                      disabled={advancingIds.length === 0 || advancingIds.length % 4 !== 0}
                      className="btn-imperial-filled py-3 px-8 inline-flex items-center gap-2 disabled:opacity-40"
                    >
                      <ChevronRight size={18} />
                      Begin {nextStage.name}
                    </button>
                  </>
                ) : (
                  <button onClick={onAdvanceStage} className="btn-imperial-filled py-3 px-8 inline-flex items-center gap-2">
                    <Crown size={18} />
                    Crown the Emperor
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Classic: Generate Round / Advance */}
          {!isColosseum && !isCustom && needsNewRound && !qualifyingDone && (
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
                  {isColosseum
                    ? "The top players from each group advance to the Knockout Stage."
                    : "The top 16 players advance to the Landsraad Finals."}
                </p>
                <button
                  onClick={onStartTop8}
                  className="btn-imperial-filled py-3 px-8"
                >
                  {isColosseum ? "Begin Knockout Draw" : "Begin the Landsraad"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Table Grid */}
          {currentRound && (
            <div>
              <h2 className="text-display text-sm text-sand-dark mb-4 text-center">
                Round {currentRound.number} &mdash; {getRoundStageName(state, currentRound)}
                {currentRound.leaderTier && !isColosseum && (
                  <span
                    className="ml-2 inline-block px-2 py-0.5 text-[10px] uppercase tracking-widest rounded-sm border align-middle"
                    style={{
                      color: getTierColor(tiers, currentRound.leaderTier),
                      borderColor: getTierColor(tiers, currentRound.leaderTier),
                    }}
                  >
                    Tier {currentRound.leaderTier}
                  </span>
                )}
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
                enabled={dramaticReveal && !currentRound.isComplete && (isColosseum || leaderRevealDone)}
                labels={currentRound.tables.map((t) => `Table #${t.id}`)}
                onAllRevealed={() => setTablesRevealed(true)}
                gridClass="grid grid-cols-1 md:grid-cols-2 gap-4"
                items={currentRound.tables.map((table, index) => (
                  <TableCard
                    key={`r${currentRound.number}-t${table.id}`}
                    table={table}
                    players={state.players}
                    roundIndex={activeRoundIndex}
                    onSubmitResults={onSubmitResults}
                    animationDelay={dramaticReveal ? 0 : index}
                    allowEdit
                    {...getTableCardRoundProps(state, currentRound)}
                  />
                ))}
              />

              {/* Available Leaders for this round (Classic only) */}
              {!isColosseum && currentRound.availableLeaders && tablesRevealed && (
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
                            <LeaderImage leader={info} className="w-24 md:w-32 h-auto block" />
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
          {currentRound?.isComplete && !qualifyingDone && !isCustom && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mt-4"
            >
              <p className="text-sm text-sand-dark uppercase tracking-widest">
                Round {currentRound.number} Complete &mdash;{" "}
                {isColosseum
                  ? "Navigate to the next round above"
                  : "Review results above or generate the next round"}
              </p>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === "groups" && isColosseum && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GroupStandings players={state.players} rounds={state.rounds} />
        </motion.div>
      )}

      {activeTab === "standings" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {stageStandings && (
            <div className="flex justify-center gap-2 mb-4">
              {(["stage", "overall"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setStandingsView(view)}
                  className={`px-3 py-1 text-xs uppercase tracking-widest rounded-sm transition-all ${
                    standingsView === view
                      ? "bg-spice/20 text-spice border border-spice/40"
                      : "glass-morphism text-sand hover:text-spice border border-sand-dark/40"
                  }`}
                >
                  {view === "stage" ? `${stage?.name ?? "Stage"} Standings` : "Overall"}
                </button>
              ))}
            </div>
          )}
          {stageStandings && standingsView === "stage" ? (
            <Leaderboard
              players={stageStandings}
              finalStandings={stageStandings}
              rounds={state.rounds.filter((r) => r.stageIndex === stageIndex)}
              tiers={tiers}
              highlightTop={nextStage?.advancement.kind === "top-n" ? nextStage.advancement.n ?? 0 : 0}
            />
          ) : (
            <Leaderboard
              players={state.players}
              highlightTop={qualifyingDone ? 16 : 0}
              rounds={state.rounds}
              finalStandings={customFinalStandings}
              tiers={tiers}
            />
          )}
        </motion.div>
      )}

      {activeTab === "leaders" && state.phase === "finished" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <LeaderStatsPanel rounds={state.rounds} tiers={tiers} />
        </motion.div>
      )}

      {activeTab === "seats" && isColosseum && state.phase === "finished" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <SeatPickStatsPanel rounds={state.rounds} />
        </motion.div>
      )}

      {activeTab === "history" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <RoundHistory rounds={state.rounds} players={state.players} context={state} />
        </motion.div>
      )}

      {/* Leader Tier Reveal Overlay (Classic only) */}
      <AnimatePresence>
        {!isColosseum && showLeaderReveal && currentRound?.availableLeaders && (
          <LeaderReveal
            leaders={currentRound.availableLeaders}
            tier={currentRound.leaderTier ?? "A"}
            color={state.tiers ? getTierColor(tiers, currentRound.leaderTier) : undefined}
            skipToGrid={manualLeaderReveal}
            onComplete={() => {
              setShowLeaderReveal(false);
              setLeaderRevealDone(true);
              setManualLeaderReveal(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Manual table assignment (custom stages with manual pairing) */}
      {isCustom && (
        <ManualPairingModal
          isOpen={showManualPairing}
          players={stagePlayers}
          title={`${stage?.name ?? "Stage"} — Round ${stageRounds.length + 1} Tables`}
          onClose={() => setShowManualPairing(false)}
          onConfirm={(tables) => {
            setShowManualPairing(false);
            onGenerateRound(tables);
          }}
        />
      )}

      {/* Player Manager Modal */}
      <PlayerManager
        isOpen={showPlayerManager}
        onClose={() => setShowPlayerManager(false)}
        players={state.players}
        onRenamePlayer={onRenamePlayer}
        onDropPlayer={onDropPlayer}
        onAddPlayer={onAddPlayer}
      />
    </div>
  );
}
