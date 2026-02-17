import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Leaderboard } from "../components/Leaderboard";
import { fetchStandingsPaste } from "../utils/pasteService";
import type { StandingsSnapshot } from "../utils/gistService";
import type { Player } from "../engine/types";

interface SpectatorPageProps {
  pasteId: string; // dpaste ID (e.g., "ABC123")
}

type LoadingState = "loading" | "success" | "error";

export function SpectatorPage({ pasteId }: SpectatorPageProps) {
  const [state, setState] = useState<LoadingState>("loading");
  const [snapshot, setSnapshot] = useState<StandingsSnapshot | null>(null);
  const [error, setError] = useState<string>("");

  const loadStandings = async () => {
    setState("loading");
    setError("");

    try {
      // Fetch standings data from dpaste
      const pasteUrl = `https://dpaste.com/${pasteId}`;
      const standingsData = await fetchStandingsPaste(pasteUrl);

      setSnapshot(standingsData);
      setState("success");
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
  const players: Player[] = snapshot
    ? snapshot.standings.map((s) => ({
        id: s.name, // Use name as ID for spectator view
        name: s.name,
        points: s.points,
        totalVP: s.totalVP,
        efficiency: s.efficiency,
        opponents: [],
      }))
    : [];

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
            <span className="text-spice">|</span>
            <span className="text-fremen-blue">Updated: {timeAgo}</span>
          </div>
        </motion.div>

        {/* Standings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Leaderboard players={players} />
        </motion.div>

        {/* Footer hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <p className="text-xs text-sand-dark uppercase tracking-widest opacity-50">
            Refresh your browser to see the latest standings
          </p>
        </motion.div>
      </div>
    </div>
  );
}
