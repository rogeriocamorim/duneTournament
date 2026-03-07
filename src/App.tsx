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
import { verifyResetPassphrase } from "./engine/types";
import {
  RotateCcw,
  Database,
  Sparkles,
  Share2,
  Lock,
  FlaskConical,
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
    batchSubmitTableResults,
    startTop8,
    generateTop8Round,
    importState,
    exportState,
    resetTournament,
    toggleDramaticReveal,
    toggleTestMode,
    generateShareableLink,
  } = useTournamentState();

  const [showNavigator, setShowNavigator] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassphrase, setResetPassphrase] = useState("");
  const [resetError, setResetError] = useState(false);
  const [resetVerifying, setResetVerifying] = useState(false);

  // ===== ESCAPE KEY HANDLER =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showShareModal) setShowShareModal(false);
        else if (showNavigator) setShowNavigator(false);
        else if (showResetConfirm) setShowResetConfirm(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showShareModal, showNavigator, showResetConfirm]);

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

  const handleReset = useCallback(async () => {
    setResetVerifying(true);
    setResetError(false);
    const valid = await verifyResetPassphrase(resetPassphrase);
    if (valid) {
      resetTournament();
      setShowResetConfirm(false);
      setResetPassphrase("");
      setResetError(false);
    } else {
      setResetError(true);
    }
    setResetVerifying(false);
  }, [resetTournament, resetPassphrase]);

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
    return <SpectatorPage pasteId={spectatorBinId} />;
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
              onClick={toggleTestMode}
              className={`p-2 transition-colors ${
                state.settings.testMode
                  ? "text-fremen-blue"
                  : "text-sand-dark hover:text-fremen-blue"
              }`}
              title={`Test Mode: ${state.settings.testMode ? "ON" : "OFF"}`}
            >
              <FlaskConical size={16} />
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
              testMode={state.settings.testMode}
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
              onBatchSubmitResults={batchSubmitTableResults}
              onStartTop8={handleStartTop8}
              dramaticReveal={state.settings.dramaticReveal}
              testMode={state.settings.testMode}
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
              onBatchSubmitResults={batchSubmitTableResults}
              onGenerateTop8Round={generateTop8Round}
              onStartTop8={startTop8}
              dramaticReveal={state.settings.dramaticReveal}
              testMode={state.settings.testMode}
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

      {/* Reset Confirmation with Passphrase */}
      <AnimatePresence>
        {showResetConfirm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/80 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowResetConfirm(false);
                setResetPassphrase("");
                setResetError(false);
              }}
            />
            <motion.div
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="glass-morphism-strong rounded-sm p-8 max-w-sm w-full text-center">
                <Lock size={32} className="text-blood mx-auto mb-4" />
                <h3 className="text-display text-lg text-spice mb-2">
                  Reset Tournament?
                </h3>
                <p className="text-sm text-sand-dark mb-6">
                  This will destroy all tournament data. Enter the passphrase to confirm.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleReset();
                  }}
                >
                  <input
                    type="password"
                    value={resetPassphrase}
                    onChange={(e) => {
                      setResetPassphrase(e.target.value);
                      setResetError(false);
                    }}
                    placeholder="Enter passphrase..."
                    className={`input-imperial w-full mb-3 text-center ${
                      resetError ? "border-blood/60" : ""
                    }`}
                    autoFocus
                  />
                  {resetError && (
                    <p className="text-blood text-xs mb-3 uppercase tracking-wider">
                      Wrong passphrase
                    </p>
                  )}
                  <div className="flex gap-3 justify-center">
                    <button
                      type="submit"
                      disabled={!resetPassphrase || resetVerifying}
                      className={`px-6 py-2 bg-blood text-white uppercase tracking-widest text-sm font-bold transition-colors ${
                        !resetPassphrase || resetVerifying
                          ? "opacity-40 cursor-not-allowed"
                          : "cursor-pointer hover:bg-red-700"
                      }`}
                    >
                      {resetVerifying ? "Verifying..." : "Destroy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetConfirm(false);
                        setResetPassphrase("");
                        setResetError(false);
                      }}
                      className="btn-imperial text-sm py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
