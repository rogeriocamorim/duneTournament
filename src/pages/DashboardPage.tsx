import { motion } from "motion/react";
import { useState, useRef, useCallback } from "react";
import { TableCard } from "../components/TableCard";
import { GroupStandings } from "../components/GroupStandings";
import { LeaderStatsPanel } from "../components/LeaderStatsPanel";
import { SeatPickStatsPanel } from "../components/SeatPickStatsPanel";
import { RoundHistory } from "../components/RoundHistory";
import type { TournamentState, TableResult } from "../engine/types";
import { generateRandomTableResults } from "../engine/testUtils";
import { Trophy, Swords, BarChart3, Crown, FlaskConical, History, Download, TrendingUp } from "lucide-react";
import { exportGroupsCSV } from "../utils/csvExport";

interface DashboardPageProps {
  state: TournamentState;
  onSubmitResults: (roundIndex: number, tableId: number, results: TableResult[]) => void;
  onBatchSubmitResults: (roundIndex: number, tables: { tableId: number; results: TableResult[] }[]) => void;
  onStartTop8: () => void;
  testMode: boolean;
}

type TabView = "tables" | "standings" | "leaders" | "draft" | "history";

export function DashboardPage({
  state,
  onSubmitResults,
  onBatchSubmitResults,
  onStartTop8,
  testMode,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<TabView>("tables");
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentRound = state.rounds[state.rounds.length - 1];
  const completedQualifying = state.rounds.filter(
    (r) => r.type === "qualifying" && r.isComplete
  ).length;
  const qualifyingDone = completedQualifying >= state.settings.totalQualifyingRounds;

  // Always clamp to valid range
  const displayRoundIdx = state.rounds.length === 0
    ? 0
    : Math.min(Math.max(0, activeRoundIdx), state.rounds.length - 1);
  const displayRound = state.rounds[displayRoundIdx];

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
    if (batch.length > 0) onBatchSubmitResults(roundIndex, batch);
  }, [currentRound, state.rounds.length, onBatchSubmitResults]);

  const handleExportCSV = useCallback(async () => {
    await exportGroupsCSV(state);
  }, [state]);

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
          <span>Round {currentRound?.number ?? 0} / {state.settings.totalQualifyingRounds}</span>
          <span className="text-spice">|</span>
          <span className="text-spice">{state.phase}</span>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex justify-center gap-4 mb-8">
        {(["tables", "standings", "leaders", "draft"] as TabView[]).map((tab) => {
          const icons = { tables: <Swords size={16} />, standings: <BarChart3 size={16} />, leaders: <Crown size={16} />, draft: <TrendingUp size={16} /> };
          const labels: Record<string, string> = { tables: "Tables", standings: "Standings", leaders: "Leaders", draft: "Draft" };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
                activeTab === tab ? "text-spice border-b-2 border-spice" : "text-sand hover:text-spice"
              }`}
            >
              {icons[tab as keyof typeof icons]}
              {labels[tab]}
            </button>
          );
        })}
        {state.rounds.filter((r) => r.isComplete).length > 1 && (
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
              activeTab === "history" ? "text-spice border-b-2 border-spice" : "text-sand hover:text-spice"
            }`}
          >
            <History size={16} />
            History
          </button>
        )}
      </div>

      {/* Tables Tab */}
      {activeTab === "tables" && (
        <div>
          {/* Qualifying Done */}
          {qualifyingDone && state.phase === "qualifying" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-8">
              <div className="glass-morphism-strong rounded-sm p-8 inline-block">
                <Trophy size={32} className="text-spice mx-auto mb-4" />
                <h2 className="text-display text-xl text-spice mb-2">Qualifying Complete</h2>
                <p className="text-sm text-sand-dark mb-4">The top players advance to the Finals.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={handleExportCSV} className="btn-imperial py-2 px-6 flex items-center gap-2 text-sm">
                    <Download size={16} />
                    Export CSV
                  </button>
                  <button onClick={onStartTop8} className="btn-imperial-filled py-3 px-8">
                    Begin the Finals
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Round Selector — free-form, any round any time */}
          {state.rounds.length > 0 && (
            <div className="flex justify-center gap-2 mb-6 flex-wrap">
              {state.rounds.map((r, idx) => {
                const tierColors: Record<string, string> = {
                  A: "text-red-400", B: "text-spice", C: "text-sky-400"
                };
                const tier = r.leaderTier && r.leaderTier !== "none" ? r.leaderTier : null;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveRoundIdx(idx)}
                    className={`px-4 py-1.5 text-xs uppercase tracking-widest rounded-sm border transition-all ${
                      displayRoundIdx === idx
                        ? "border-spice text-spice bg-black/60"
                        : "border-sand/30 text-sand bg-black/50 hover:border-spice/60 hover:text-spice"
                    }`}
                  >
                    {r.type === "qualifying" ? `Round ${r.number}` :
                     r.type === "semifinal" ? "SF1 / Elim" :
                     r.type === "winners-final" ? "SF2" :
                     r.type === "grand-final" ? "Final" : `Round ${r.number}`}
                    {tier && <span className={`ml-1 font-bold ${tierColors[tier] ?? ""}`}>{tier}</span>}
                    {r.isComplete && <span className="ml-1 text-spice/60">✓</span>}
                  </button>
                );
              })}
              <button
                onClick={handleExportCSV}
                className="px-4 py-1.5 text-xs uppercase tracking-widest rounded-sm border border-fremen-blue/50 text-fremen-blue bg-black/50 hover:bg-black/70 transition-all flex items-center gap-1"
              >
                <Download size={12} />
                XLSX
              </button>
            </div>
          )}

          {/* Table Grid — always editable, any round */}
          {displayRound && (
            <div>
              <h2 className="text-display text-sm text-sand-dark mb-4 text-center">
                Round {displayRound.number} — {displayRound.isComplete ? "Complete ✓" : "In Progress"}
              </h2>
              {testMode && !displayRound.isComplete && displayRoundIdx === state.rounds.length - 1 && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayRound.tables.map((table, index) => (
                  <TableCard
                    key={`r${displayRound.number}-t${table.id}`}
                    table={table}
                    players={state.players}
                    roundIndex={displayRoundIdx}
                    onSubmitResults={onSubmitResults}
                    animationDelay={index}
                    allowEdit
                    availableLeaders={displayRound.availableLeaders}
                  />
                ))}
              </div>
            </div>
          )}

          {qualifyingDone && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mt-4">
              <p className="text-sm text-spice uppercase tracking-widest">
                All rounds complete — ready for the Finals!
              </p>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === "standings" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GroupStandings players={state.players} rounds={state.rounds} />
        </motion.div>
      )}

      {activeTab === "draft" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <SeatPickStatsPanel rounds={state.rounds} />
        </motion.div>
      )}

      {activeTab === "leaders" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LeaderStatsPanel rounds={state.rounds} />
        </motion.div>
      )}

      {activeTab === "history" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <RoundHistory rounds={state.rounds} players={state.players} />
        </motion.div>
      )}
    </div>
  );
}
