import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTournamentState } from "./hooks/useTournamentState";
import { RegistrationPage } from "./pages/RegistrationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { Top8Page } from "./pages/Top8Page";
import { SpectatorPage } from "./pages/SpectatorPage";
import { GuildNavigator } from "./components/GuildNavigator";
import { ShareModal } from "./components/ShareModal";
import { SandstormTransition } from "./components/animations/SandstormTransition";
import {
  RotateCcw,
  Database,
  Sparkles,
  Share2,
} from "lucide-react";


function App() {
  // Check for spectator mode from URL params
  const [spectatorBinId, setSpectatorBinId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const binId = params.get("view");
    if (binId) {
      setSpectatorBinId(binId);
    }
  }, []);

  const {
    state,
    addPlayer,
    removePlayer,
    startTournament,
    generateRound,
    submitTableResults,
    startTop8,
    generateTop8Round,
    importState,
    exportState,
    resetTournament,
    toggleDramaticReveal,
    generateShareableLink,
  } = useTournamentState();

  const [showNavigator, setShowNavigator] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Wrap phase transitions with sandstorm
  const transitionTo = useCallback((action: () => void) => {
    setTransitioning(true);
    // Execute action after sandstorm covers the screen
    setTimeout(() => {
      action();
      // Start removing the sandstorm after a brief hold
      setTimeout(() => {
        setTransitioning(false);
      }, 300);
    }, 600);
  }, []);

  const handleStart = useCallback(() => {
    transitionTo(() => {
      startTournament();
      generateRound();
    });
  }, [transitionTo, startTournament, generateRound]);

  const handleStartTop8 = useCallback(() => {
    transitionTo(() => {
      startTop8();
    });
  }, [transitionTo, startTop8]);

  const handleReset = useCallback(() => {
    resetTournament();
    setShowResetConfirm(false);
  }, [resetTournament]);

  const handleShare = useCallback(async () => {
    setSharingInProgress(true);
    try {
      const url = await generateShareableLink();
      setShareUrl(url);
      setShowShareModal(true);
    } catch (error) {
      console.error("Failed to generate share link:", error);
      alert("Failed to generate share link. Please try again.");
    } finally {
      setSharingInProgress(false);
    }
  }, [generateShareableLink]);

  // If in spectator mode, render SpectatorPage only
  if (spectatorBinId) {
    return <SpectatorPage binId={spectatorBinId} />;
  }

  return (
    <div className="min-h-screen relative">
      {/* Sandstorm Transition Overlay */}
      <SandstormTransition show={transitioning} />

      {/* Top Bar */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30"
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDramaticReveal}
              className={`p-2 transition-colors ${
                state.settings.dramaticReveal
                  ? "text-spice"
                  : "text-sand-dark hover:text-spice"
              }`}
              title={`Dramatic Reveal: ${state.settings.dramaticReveal ? "ON" : "OFF"}`}
            >
              <Sparkles size={16} />
            </button>
            <button
              onClick={() => setShowNavigator(true)}
              className="p-2 text-sand-dark hover:text-spice transition-colors"
              title="Guild Navigator (Import/Export)"
            >
              <Database size={16} />
            </button>
            <button
              onClick={handleShare}
              disabled={sharingInProgress || state.phase === "registration"}
              className={`p-2 transition-colors ${
                sharingInProgress || state.phase === "registration"
                  ? "text-sand-dark/30 cursor-not-allowed"
                  : "text-sand-dark hover:text-fremen-blue"
              }`}
              title="Share Standings"
            >
              <Share2 size={16} className={sharingInProgress ? "animate-pulse" : ""} />
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="p-2 text-sand-dark hover:text-blood transition-colors"
              title="Reset Tournament"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {state.phase === "registration" && (
          <motion.div
            key="registration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RegistrationPage
              players={state.players}
              onAddPlayer={addPlayer}
              onRemovePlayer={removePlayer}
              onStart={handleStart}
            />
          </motion.div>
        )}

        {state.phase === "qualifying" && (
          <motion.div
            key="qualifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DashboardPage
              state={state}
              onGenerateRound={generateRound}
              onSubmitResults={submitTableResults}
              onStartTop8={handleStartTop8}
              dramaticReveal={state.settings.dramaticReveal}
            />
          </motion.div>
        )}

        {(state.phase === "top8" || state.phase === "finished") && (
          <motion.div
            key="top8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Top8Page
              state={state}
              onSubmitResults={submitTableResults}
              onGenerateTop8Round={generateTop8Round}
              onStartTop8={startTop8}
              dramaticReveal={state.settings.dramaticReveal}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guild Navigator Modal */}
      <GuildNavigator
        isOpen={showNavigator}
        onClose={() => setShowNavigator(false)}
        onExport={exportState}
        onImport={importState}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareUrl={shareUrl}
      />

      {/* Reset Confirmation */}
      <AnimatePresence>
        {showResetConfirm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/80 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
            />
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="glass-morphism-strong rounded-sm p-8 max-w-sm w-full text-center">
                <RotateCcw size={32} className="text-blood mx-auto mb-4" />
                <h3 className="text-display text-lg text-spice mb-2">
                  Reset Tournament?
                </h3>
                <p className="text-sm text-sand-dark mb-6">
                  This will destroy all tournament data. This action cannot be
                  undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReset}
                    className="px-6 py-2 bg-blood text-white uppercase tracking-widest text-sm font-bold cursor-pointer hover:bg-red-700 transition-colors"
                  >
                    Destroy
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="btn-imperial text-sm py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
