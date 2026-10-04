import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTournamentState } from "./hooks/useTournamentState";
import { ModeSelectorPage } from "./pages/ModeSelectorPage";
import { RegistrationPage } from "./pages/RegistrationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { Top8Page } from "./pages/Top8Page";
import { SpectatorPage } from "./pages/SpectatorPage";
import { SpinnerWheelPage } from "./pages/SpinnerWheelPage";
import { KnockoutRandomizer } from "./pages/KnockoutRandomizer";
import { GuildNavigator } from "./components/GuildNavigator";
import { ShareModal } from "./components/ShareModal";
import { SandstormTransition } from "./components/animations/SandstormTransition";
import { TournamentSettingsModal } from "./components/TournamentSettingsModal";
import { verifyResetPassphrase } from "./engine/types";
import { describeTierRule, getFormat, resolveTierRule } from "./engine/format";
import { setAdminToken } from "./api/client";
import {
  RotateCcw,
  Database,
  Sparkles,
  Share2,
  Lock,
  FlaskConical,
  Settings,
  LogOut,
  KeyRound,
  AlertTriangle,
} from "lucide-react";


function App() {
  // Check for spectator mode from URL params (?view= JSONBin snapshot, ?live= server tournament)
  const [spectatorBinId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("view"));
  const [spectatorLiveSlug] = useState<string | null>(() => new URLSearchParams(window.location.search).get("live"));

  const {
    state,
    apiMode,
    apiError,
    clearApiError,
    busy,
    loading,
    openTournament,
    createFromTemplate,
    updateFormat,
    addPlayers,
    advanceStage,
    addPlayer,
    removePlayer,
    renamePlayer,
    dropPlayer,
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
    // Colosseum-specific
    setGroupAssignments,
    confirmKnockoutDraw,
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
  const [showSettings, setShowSettings] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const needsToken = apiError?.status === 401;

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
      // Classic/custom: generate first round immediately (manual pairing waits for the organizer)
      // Colosseum mode: goes to group-draw phase, rounds generated after assignments
      const firstStage = getFormat(state).stages[0];
      if (state.mode === "classic" || (state.mode === "custom" && firstStage?.pairing !== "manual")) {
        generateRound();
      }
    });
  }, [transitionTo, startTournament, generateRound, state]);

  const handleStartTop8 = useCallback(() => {
    transitionTo(() => {
      startTop8();
    });
  }, [transitionTo, startTop8]);

  const handleReset = useCallback(() => {
    setResetVerifying(true);
    setResetError(false);
    const valid = verifyResetPassphrase(resetPassphrase);
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
  if (spectatorLiveSlug) {
    return <SpectatorPage liveSlug={spectatorLiveSlug} />;
  }
  if (spectatorBinId) {
    return <SpectatorPage pasteId={spectatorBinId} />;
  }

  // Colosseum knockout tier labels come from the bracket stage rules
  const bracketStage = getFormat(state).stages[1];
  const knockoutTierLabels = {
    sf1: describeTierRule(resolveTierRule(bracketStage, 1)),
    sf2: describeTierRule(resolveTierRule(bracketStage, 2)),
    final: describeTierRule(resolveTierRule(bracketStage, 3)),
  };
  const isCustom = state.mode === "custom";

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
            {busy && (
              <span className="text-[10px] uppercase tracking-widest text-fremen-blue animate-pulse mr-2">Saving…</span>
            )}
            {state.phase !== "home" && (
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-sand-dark hover:text-spice transition-colors"
                title="Tournament Settings (format, points, tiers, clock)"
              >
                <Settings size={16} />
              </button>
            )}
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
            {apiMode ? (
              state.phase !== "home" && (
                <button
                  onClick={resetTournament}
                  className="p-2 text-sand-dark hover:text-spice transition-colors"
                  title="Back to tournament list (data stays saved)"
                >
                  <LogOut size={16} />
                </button>
              )
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="p-2 text-sand-dark hover:text-blood transition-colors"
                title="Reset Tournament"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Server errors */}
      {apiError && !needsToken && (
        <div className="max-w-3xl mx-auto px-4">
          <div className="px-4 py-2 rounded-sm bg-blood/20 border border-blood/50 flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="flex-1">Server error: {apiError.message}</span>
            <button onClick={clearApiError} className="uppercase tracking-widest hover:text-white">Dismiss</button>
          </div>
        </div>
      )}

      {/* Loading a tournament from the server */}
      {loading && (
        <div className="text-center py-24">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-spice mb-4"></div>
          <p className="text-sand-dark uppercase tracking-widest text-sm">Loading tournament…</p>
        </div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {!loading && state.phase === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ModeSelectorPage
              onCreate={(templateId, tierPresetId, name) => void createFromTemplate(templateId, tierPresetId, name)}
              apiMode={apiMode}
              onOpenTournament={openTournament}
              busy={busy}
            />
          </motion.div>
        )}

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
              onAddPlayers={addPlayers}
              onRemovePlayer={removePlayer}
              onOpenSettings={() => setShowSettings(true)}
              format={state.format}
              onStart={handleStart}
              testMode={state.settings.testMode}
              mode={state.mode}
            />
          </motion.div>
        )}

        {state.phase === "group-draw" && (
          <motion.div
            key="group-draw"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SpinnerWheelPage
              players={state.players}
              onConfirm={(assignments: Map<string, number>) => {
                transitionTo(() => setGroupAssignments(assignments));
              }}
            />
          </motion.div>
        )}

        {(state.phase === "qualifying" || (isCustom && state.phase === "finished")) && (
          <motion.div
            key="qualifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DashboardPage
              state={state}
              onGenerateRound={generateRound}
              onAdvanceStage={() => transitionTo(advanceStage)}
              onSubmitResults={submitTableResults}
              onBatchSubmitResults={batchSubmitTableResults}
              onStartTop8={handleStartTop8}
              onRenamePlayer={renamePlayer}
              onDropPlayer={dropPlayer}
              onAddPlayer={addPlayer}
              dramaticReveal={state.settings.dramaticReveal}
              testMode={state.settings.testMode}
            />
          </motion.div>
        )}

        {state.phase === "knockout-draw" && (
          <motion.div
            key="knockout-draw"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <KnockoutRandomizer
              players={state.players}
              rounds={state.rounds}
              tierLabels={knockoutTierLabels}
              tiers={state.tiers}
              onConfirm={(sf1a, sf1b, elimA, elimB) => {
                const tables = [
                  sf1a.map((p) => p.id),
                  sf1b.map((p) => p.id),
                  elimA.map((p) => p.id),
                  elimB.map((p) => p.id),
                ];
                transitionTo(() => confirmKnockoutDraw(tables));
              }}
            />
          </motion.div>
        )}

        {!isCustom && (state.phase === "top8" || state.phase === "finished") && (
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

      {/* Tournament Settings */}
      <TournamentSettingsModal
        isOpen={showSettings}
        state={state}
        onClose={() => setShowSettings(false)}
        onSave={updateFormat}
      />

      {/* Admin token prompt (server rejected a change) */}
      <AnimatePresence>
        {needsToken && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass-morphism-strong rounded-sm p-8 max-w-sm w-full text-center">
              <KeyRound size={32} className="text-spice mx-auto mb-4" />
              <h3 className="text-display text-lg text-spice mb-2">Organizer Token</h3>
              <p className="text-sm text-sand-dark mb-6">
                Changes on this server need the organizer token. It is stored in this browser.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdminToken(tokenInput.trim());
                  setTokenInput("");
                  clearApiError();
                }}
              >
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Token..."
                  className="input-imperial w-full mb-4 text-center"
                  autoFocus
                />
                <div className="flex gap-3 justify-center">
                  <button type="submit" disabled={!tokenInput.trim()} className="btn-imperial-filled text-sm py-2 px-6 disabled:opacity-40">
                    Save
                  </button>
                  <button type="button" onClick={clearApiError} className="btn-imperial text-sm py-2">
                    Cancel
                  </button>
                </div>
              </form>
              <p className="text-[10px] text-sand-dark mt-4 uppercase tracking-widest">Then repeat the last action</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
