import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AlertTriangle, RefreshCw, Swords, BarChart3, Crown, Users, Armchair, History } from "lucide-react";
import { Leaderboard } from "../components/Leaderboard";
import { GroupStandings } from "../components/GroupStandings";
import { LeaderStatsPanel } from "../components/LeaderStatsPanel";
import { SeatPickStatsPanel } from "../components/SeatPickStatsPanel";
import { RoundHistory } from "../components/RoundHistory";
import { TableCard } from "../components/TableCard";
import { fetchStandingsBin } from "../utils/jsonbinService";
import { getTierForRound } from "../engine/tournament";
import { getLeaderInfo, getLeaderImageUrl } from "../engine/types";
import type { StandingsSnapshot } from "../utils/gistService";
import type { Player, Round } from "../engine/types";

interface SpectatorPageProps {
  pasteId: string; // JSONBin ID (e.g., "6993da5aae596e708f30912e")
}

type LoadingState = "loading" | "success" | "error";
type SpectatorTab = "tables" | "groups" | "standings" | "leaders" | "seats" | "history";

export function SpectatorPage({ pasteId }: SpectatorPageProps) {
  const [state, setState] = useState<LoadingState>("loading");
  const [snapshot, setSnapshot] = useState<StandingsSnapshot | null>(null);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<SpectatorTab>("standings");
  const [displayRoundIndex, setDisplayRoundIndex] = useState(0);

  const loadStandings = async () => {
    setState("loading");
    setError("");

    try {
      const standingsData = await fetchStandingsBin(pasteId);
      setSnapshot(standingsData);
      setState("success");

      // Default to the latest round for table view
      if (standingsData.rounds && standingsData.rounds.length > 0) {
        setDisplayRoundIndex(standingsData.rounds.filter((r) => r.type === "qualifying").length - 1);
      }
    } catch (err) {
      console.error("Failed to load standings:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load tournament standings. Please try again."
      );
      setState("error");
    }
  };

  useEffect(() => {
    loadStandings();
  }, [pasteId]);

  // Convert snapshot standings to Player format for Leaderboard component
  const standingsPlayers: Player[] = snapshot
    ? snapshot.standings.map((s) => ({
        id: s.name,
        name: s.name,
        points: s.points,
        wins: s.wins ?? 0,
        totalVP: s.totalVP,
        efficiency: s.efficiency,
        opponents: [],
      }))
    : [];

  // Build pre-computed VP Share % map from snapshot
  const vpSharePctMap = new Map<string, number>();
  if (snapshot) {
    for (const s of snapshot.standings) {
      vpSharePctMap.set(s.name, s.vpSharePct ?? 0);
    }
  }

  // Full data from snapshot (may be undefined for old share links)
  const rounds: Round[] = snapshot?.rounds ?? [];
  const players: Player[] = snapshot?.players ?? [];
  const hasFullData = rounds.length > 0 && players.length > 0;
  const isColosseum = snapshot?.metadata.mode === "colosseum";

  // Qualifying rounds for the tables tab
  const qualifyingRounds = rounds.filter((r) => r.type === "qualifying");
  const currentRound = qualifyingRounds[displayRoundIndex] ?? null;
  const completedRounds = rounds.filter((r) => r.isComplete);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-spice mb-4"></div>
          <p className="text-sand-dark uppercase tracking-widest text-sm">
            Fetching Latest Standings...
          </p>
        </motion.div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-morphism-strong rounded-sm p-8 max-w-md w-full text-center"
        >
          <AlertTriangle size={48} className="text-blood mx-auto mb-4" />
          <h2 className="text-display text-xl text-spice mb-2">
            Tournament Not Found
          </h2>
          <p className="text-sm text-sand-dark mb-6">{error}</p>
          <button
            onClick={loadStandings}
            className="btn-imperial-filled py-2 px-6 inline-flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  if (!snapshot) return null;

  // Calculate time since last update
  const lastUpdated = new Date(snapshot.metadata.timestamp);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastUpdated.getTime()) / 60000);
  const timeAgo =
    diffMinutes < 1
      ? "Just now"
      : diffMinutes < 60
      ? `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`
      : `${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) > 1 ? "s" : ""} ago`;

  /** Tab button helper */
  const TabBtn = ({ tab, icon, label }: { tab: SpectatorTab; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
        activeTab === tab
          ? "text-spice border-b-2 border-spice"
          : "text-sand-dark hover:text-sand"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-display text-3xl md:text-4xl text-spice spice-text-glow mb-2">
            IMPERIUM ARBITER
          </h1>
          <h2 className="text-display text-xl md:text-2xl text-sand mb-4">
            {snapshot.metadata.tournamentName}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-sand-dark uppercase tracking-[0.2em]">
            <span>{snapshot.standings.length} Players</span>
            <span className="text-spice">|</span>
            <span>
              Round {snapshot.metadata.currentRound} / {snapshot.metadata.totalRounds}
            </span>
            <span className="text-spice">|</span>
            <span>{snapshot.metadata.phase}</span>
            {isColosseum && (
              <>
                <span className="text-spice">|</span>
                <span className="text-fremen-blue">Colosseum</span>
              </>
            )}
            <span className="text-spice">|</span>
            <span className="text-fremen-blue">Updated: {timeAgo}</span>
          </div>
        </motion.div>

        {/* Tab Bar */}
        <div className="flex justify-center gap-1 mb-6 flex-wrap border-b border-white/10 pb-2">
          {hasFullData && <TabBtn tab="tables" icon={<Swords size={16} />} label="Tables" />}
          {hasFullData && isColosseum && <TabBtn tab="groups" icon={<Users size={16} />} label="Groups" />}
          <TabBtn tab="standings" icon={<BarChart3 size={16} />} label="Standings" />
          {hasFullData && <TabBtn tab="leaders" icon={<Crown size={16} />} label="Leaders" />}
          {hasFullData && isColosseum && <TabBtn tab="seats" icon={<Armchair size={16} />} label="Seats" />}
          {hasFullData && completedRounds.length > 1 && <TabBtn tab="history" icon={<History size={16} />} label="History" />}
        </div>

        {/* ---- Tables Tab ---- */}
        {activeTab === "tables" && hasFullData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Round Navigation */}
            {qualifyingRounds.length > 0 && (
              <div className="flex justify-center gap-2 mb-6 flex-wrap">
                {qualifyingRounds.map((round, idx) => {
                  const isActive = idx === displayRoundIndex;
                  const isComplete = round.isComplete;
                  const inProgress = !isComplete && round.tables.some((t) => t.isComplete);
                  const tier = round.leaderTier ?? getTierForRound(round.number, false);
                  const tierColors: Record<string, string> = { A: "#ef4444", B: "#c5a059", C: "#38bdf8" };
                  const tierColor = tierColors[tier] ?? "#c5a059";
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

            {/* Table Cards (read-only) */}
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
                <div className={isColosseum ? "grid grid-cols-1 gap-4 max-w-2xl mx-auto" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
                  {currentRound.tables.map((table, index) => (
                    <TableCard
                      key={`r${currentRound.number}-t${table.id}`}
                      table={table}
                      players={players}
                      roundIndex={displayRoundIndex}
                      onSubmitResults={() => {}}
                      animationDelay={index}
                      allowEdit={false}
                      availableLeaders={isColosseum ? undefined : currentRound.availableLeaders}
                      leaderTier={isColosseum ? undefined : currentRound.leaderTier}
                      mode={snapshot.metadata.mode}
                    />
                  ))}
                </div>

                {/* Available Leaders for this round (Classic only) */}
                {!isColosseum && currentRound.availableLeaders && (
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
                              style={{ boxShadow: "0 0 12px rgba(197, 160, 89, 0.15)" }}
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
          </motion.div>
        )}

        {/* ---- Groups Tab (Colosseum only) ---- */}
        {activeTab === "groups" && hasFullData && isColosseum && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GroupStandings players={players} rounds={rounds} />
          </motion.div>
        )}

        {/* ---- Standings Tab ---- */}
        {activeTab === "standings" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {hasFullData ? (
              <Leaderboard players={players} rounds={rounds} />
            ) : (
              <Leaderboard players={standingsPlayers} vpSharePctMap={vpSharePctMap} />
            )}
          </motion.div>
        )}

        {/* ---- Leaders Tab ---- */}
        {activeTab === "leaders" && hasFullData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LeaderStatsPanel rounds={rounds} />
          </motion.div>
        )}

        {/* ---- Seats Tab (Colosseum only) ---- */}
        {activeTab === "seats" && hasFullData && isColosseum && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <SeatPickStatsPanel rounds={rounds} />
          </motion.div>
        )}

        {/* ---- History Tab ---- */}
        {activeTab === "history" && hasFullData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <RoundHistory rounds={rounds} players={players} />
          </motion.div>
        )}

        {/* Footer hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <p className="text-xs text-sand-dark uppercase tracking-widest opacity-50">
            Refresh your browser to see the latest data
          </p>
        </motion.div>
      </div>
    </div>
  );
}
