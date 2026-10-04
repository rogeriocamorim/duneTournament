import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AlertTriangle, RefreshCw, Swords, BarChart3, Users, History } from "lucide-react";
import { Leaderboard } from "../components/Leaderboard";
import { GroupStandings } from "../components/GroupStandings";
import { RoundHistory } from "../components/RoundHistory";
import { TableCard } from "../components/TableCard";
import { fetchStandingsBin } from "../utils/jsonbinService";
import { getPublicSnapshot } from "../api/client";
import { getTierForRound } from "../engine/tournament";
import { getRoundStageName, getTableCardRoundProps, getTierColor } from "../engine/format";
import type { FormatContext } from "../engine/format";
import { getLeaderInfo } from "../engine/types";
import { LeaderImage } from "../components/LeaderImage";
import type { StandingsSnapshot } from "../utils/gistService";
import type { Player, Round } from "../engine/types";

interface SpectatorPageProps {
  /** JSONBin ID (e.g., "6993da5aae596e708f30912e") — legacy share links */
  pasteId?: string;
  /** Share slug of a tournament stored on the server (live view) */
  liveSlug?: string;
}

/** Live view refresh interval */
const LIVE_REFRESH_MS = 15_000;

type LoadingState = "loading" | "success" | "error";
type SpectatorTab = "tables" | "groups" | "standings" | "leaders" | "seats" | "history";

export function SpectatorPage({ pasteId, liveSlug }: SpectatorPageProps) {
  const [state, setState] = useState<LoadingState>("loading");
  const [snapshot, setSnapshot] = useState<StandingsSnapshot | null>(null);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<SpectatorTab>("standings");
  const [displayRoundIndex, setDisplayRoundIndex] = useState(0);

  const [reloadKey, setReloadKey] = useState(0);

  // Load the snapshot (and keep refreshing live views). State is only set in
  // promise callbacks; "Try Again" bumps reloadKey to run this again.
  useEffect(() => {
    let cancelled = false;
    const fetchSnapshot = () => (liveSlug ? getPublicSnapshot(liveSlug) : fetchStandingsBin(pasteId ?? ""));

    const load = (first: boolean) =>
      fetchSnapshot()
        .then((standingsData) => {
          if (cancelled) return;
          setSnapshot(standingsData);
          setState("success");
          // Default to the latest round for table view
          if (first && standingsData.rounds && standingsData.rounds.length > 0) {
            const navRounds = standingsData.metadata.mode === "custom"
              ? standingsData.rounds
              : standingsData.rounds.filter((r) => r.type === "qualifying");
            setDisplayRoundIndex(navRounds.length - 1);
          }
        })
        .catch((err: unknown) => {
          if (cancelled || !first) return;
          console.error("Failed to load standings:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load tournament standings. Please try again."
          );
          setState("error");
        });

    void load(true);
    const timer = liveSlug ? setInterval(() => void load(false), LIVE_REFRESH_MS) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pasteId, liveSlug, reloadKey]);

  const retry = () => {
    setState("loading");
    setError("");
    setReloadKey((k) => k + 1);
  };

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
  const penaltyMap = new Map<string, number>();
  if (snapshot) {
    for (const s of snapshot.standings) {
      vpSharePctMap.set(s.name, s.vpSharePct ?? 0);
      penaltyMap.set(s.name, s.penaltyPoints ?? 0);
    }
  }

  // Full data from snapshot (may be undefined for old share links)
  const rounds: Round[] = snapshot?.rounds ?? [];
  const players: Player[] = snapshot?.players ?? [];
  const hasFullData = rounds.length > 0 && players.length > 0;
  const isColosseum = snapshot?.metadata.mode === "colosseum";
  const isCustom = snapshot?.metadata.mode === "custom";
  const context: FormatContext = {
    mode: snapshot?.metadata.mode ?? "classic",
    format: snapshot?.format,
    tiers: snapshot?.tiers,
  };

  // Rounds for the tables tab (custom mode shows every stage)
  const qualifyingRounds = isCustom ? rounds : rounds.filter((r) => r.type === "qualifying");
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
            onClick={retry}
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
          {hasFullData && <TabBtn tab="tables" active={activeTab} onSelect={setActiveTab} icon={<Swords size={16} />} label="Tables" />}
          {hasFullData && isColosseum && <TabBtn tab="groups" active={activeTab} onSelect={setActiveTab} icon={<Users size={16} />} label="Standings" />}
          <TabBtn tab="standings" active={activeTab} onSelect={setActiveTab} icon={<BarChart3 size={16} />} label="Overall" />
          {hasFullData && completedRounds.length > 1 && <TabBtn tab="history" active={activeTab} onSelect={setActiveTab} icon={<History size={16} />} label="History" />}
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
                  const tier = round.leaderTier ?? (snapshot.tiers ? "" : getTierForRound(round.number, false));
                  const tierColor = getTierColor(snapshot.tiers, tier);
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
                  Round {currentRound.number} &mdash; {getRoundStageName(context, currentRound)}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentRound.tables.map((table, index) => (
                    <TableCard
                      key={`r${currentRound.number}-t${table.id}`}
                      table={table}
                      players={players}
                      roundIndex={displayRoundIndex}
                      onSubmitResults={() => {}}
                      animationDelay={index}
                      allowEdit={false}
                      {...getTableCardRoundProps(context, currentRound)}
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
              <Leaderboard
                players={players}
                rounds={rounds}
                tiers={snapshot.tiers}
                finalStandings={snapshot.metadata.phase === "finished"
                  ? snapshot.standings.map((s) => players.find((p) => p.name === s.name)).filter((p): p is Player => !!p)
                  : undefined}
              />
            ) : (
              <Leaderboard players={standingsPlayers} vpSharePctMap={vpSharePctMap} penaltyMap={penaltyMap} />
            )}
          </motion.div>
        )}

        {/* ---- History Tab ---- */}
        {activeTab === "history" && hasFullData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <RoundHistory rounds={rounds} players={players} context={context} />
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
            {liveSlug ? "Live — updates automatically" : "Refresh your browser to see the latest data"}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

interface TabBtnProps {
  tab: SpectatorTab;
  active: SpectatorTab;
  onSelect: (tab: SpectatorTab) => void;
  icon: React.ReactNode;
  label: string;
}

/** Tab button of the spectator view */
function TabBtn({ tab, active, onSelect, icon, label }: TabBtnProps) {
  return (
    <button
      onClick={() => onSelect(tab)}
      className={`flex items-center gap-2 px-4 py-2 text-sm uppercase tracking-widest transition-all ${
        active === tab
          ? "text-spice border-b-2 border-spice"
          : "text-sand-dark hover:text-sand"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
