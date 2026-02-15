import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTournament } from '../../context/TournamentContext';
import { Button } from '../shared/Button';
import { DUNE_QUOTES, ANIMATION_DURATIONS } from '../../utils/constants';

export function TableDraft() {
  const navigate = useNavigate();
  const { state, startRound, setStatus } = useTournament();
  const tournament = state.tournament;
  
  const [currentQuote, setCurrentQuote] = useState(0);
  const [showTables, setShowTables] = useState(false);
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [skipAnimation, setSkipAnimation] = useState(false);

  const nextRound = tournament ? tournament.currentRound + 1 : 1;
  const currentRound = tournament?.rounds.find(r => r.roundNumber === nextRound);

  useEffect(() => {
    if (!tournament) {
      navigate('/setup');
      return;
    }

    // Start the round if not already started
    if (!currentRound) {
      startRound(nextRound);
    }
  }, [tournament, currentRound, nextRound]);

  useEffect(() => {
    if (skipAnimation && currentRound) {
      setShowTables(true);
      setCurrentTableIndex(currentRound.tables.length);
      return;
    }

    // Quote rotation
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % DUNE_QUOTES.length);
    }, 3000);

    // Start showing tables after quote displays
    const tableTimeout = setTimeout(() => {
      setShowTables(true);
    }, 2000);

    return () => {
      clearInterval(quoteInterval);
      clearTimeout(tableTimeout);
    };
  }, [skipAnimation, currentRound]);

  useEffect(() => {
    if (!showTables || !currentRound || skipAnimation) return;

    if (currentTableIndex < currentRound.tables.length) {
      const timeout = setTimeout(() => {
        setCurrentTableIndex(prev => prev + 1);
      }, ANIMATION_DURATIONS.tableDelay);

      return () => clearTimeout(timeout);
    }
  }, [showTables, currentTableIndex, currentRound, skipAnimation]);

  const handleContinue = () => {
    setStatus('in-progress');
    navigate('/round');
  };

  const allTablesRevealed = currentRound && currentTableIndex >= currentRound.tables.length;

  if (!tournament || !currentRound) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-dune-sand-300">Preparing draft...</p>
    </div>;
  }

  const getPlayerName = (playerId: string) => {
    return tournament.players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 sand-particles opacity-30" />
      
      {/* Sandworm Silhouette */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-dune-desert-500/50 to-transparent"
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        transition={{ duration: 3, ease: 'easeOut' }}
      />

      <div className="relative z-10 w-full max-w-6xl">
        {/* Quote Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuote}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-6xl font-dune text-dune-spice-500 text-glow-strong animate-text-shimmer">
              "{DUNE_QUOTES[currentQuote]}"
            </h2>
          </motion.div>
        </AnimatePresence>

        {/* Round Title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center mb-8"
        >
          <h3 className="text-3xl font-dune text-dune-sand-100 mb-2">
            Round {nextRound}
          </h3>
          <p className="text-dune-sand-400">Table Assignments</p>
        </motion.div>

        {/* Tables Grid */}
        {showTables && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {currentRound.tables.slice(0, currentTableIndex).map((table, index) => (
              <motion.div
                key={table.tableNumber}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  duration: 0.6,
                  delay: index * 0.2,
                  type: 'spring',
                  stiffness: 100,
                }}
                className="bg-dune-desert-200/90 border-2 border-dune-spice-600 rounded-lg p-6 shadow-spice-glow backdrop-blur-sm"
              >
                <h4 className="text-2xl font-dune text-dune-spice-500 text-center mb-4 text-glow">
                  Table {table.tableNumber}
                </h4>
                <div className="space-y-2">
                  {table.playerIds.map((playerId, playerIndex) => (
                    <motion.div
                      key={playerId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ 
                        delay: index * 0.2 + playerIndex * 0.15,
                        duration: 0.3,
                      }}
                      className="flex items-center bg-dune-desert-400/50 px-4 py-2 rounded border border-dune-sand-800"
                    >
                      <span className="text-dune-spice-400 mr-3">👤</span>
                      <span className="text-dune-sand-100 font-medium">
                        {getPlayerName(playerId)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex justify-center gap-4"
        >
          {!allTablesRevealed && !skipAnimation && (
            <Button
              variant="secondary"
              onClick={() => setSkipAnimation(true)}
            >
              Skip Animation →
            </Button>
          )}
          
          {allTablesRevealed && (
            <Button
              variant="primary"
              size="lg"
              onClick={handleContinue}
              className="animate-spice-pulse"
            >
              Continue to Round {nextRound}
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
