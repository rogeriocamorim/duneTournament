import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTournament } from '../../context/TournamentContext';
import { calculateStandings } from '../../utils/scoring/calculateStandings';
import { exportTournamentToJson } from '../../utils/storage/exportImport';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';

export function FinalResults() {
  const navigate = useNavigate();
  const { state, resetTournament } = useTournament();
  const tournament = state.tournament;

  if (!tournament) {
    navigate('/setup');
    return null;
  }

  const standings = calculateStandings(tournament.players);
  const champion = standings[0];
  const secondPlace = standings[1];
  const thirdPlace = standings[2];

  const handleNewTournament = () => {
    if (window.confirm('Start a new tournament? Current data will be cleared.')) {
      resetTournament();
      navigate('/setup');
    }
  };

  const handleExport = () => {
    exportTournamentToJson(tournament);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 overflow-hidden">
      {/* Confetti effect with sand particles */}
      <div className="fixed inset-0 sand-particles opacity-40 animate-sand-flow" />
      
      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Champion Section */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: 'spring',
            stiffness: 100,
            damping: 15,
            duration: 1,
          }}
          className="text-center mb-12"
        >
          <div className="inline-block">
            <div className="text-8xl mb-4 animate-spice-pulse">🏆</div>
            <h2 className="text-5xl md:text-6xl font-dune text-dune-spice-500 text-glow-strong mb-4 animate-text-shimmer">
              CHAMPION
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-4xl md:text-5xl font-dune text-dune-sand-100 mb-2"
            >
              {champion.player.name}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-2xl text-dune-spice-400"
            >
              {champion.player.totalPoints} Points • {champion.player.totalVictoryPoints} VP
            </motion.p>
          </div>
        </motion.div>

        {/* Podium */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {/* 2nd Place */}
          <Card variant="glow" className="text-center">
            <div className="text-4xl mb-2">🥈</div>
            <h3 className="text-xl font-dune text-dune-spice-400 mb-2">2nd Place</h3>
            <p className="text-2xl text-dune-sand-100 font-medium mb-1">
              {secondPlace.player.name}
            </p>
            <p className="text-dune-sand-400">
              {secondPlace.player.totalPoints} pts
            </p>
          </Card>

          {/* Champion Card (repeated for symmetry) */}
          <Card variant="glow" className="text-center md:scale-110 shadow-2xl">
            <div className="text-5xl mb-2">👑</div>
            <h3 className="text-2xl font-dune text-dune-spice-500 mb-2 text-glow">Champion</h3>
            <p className="text-3xl text-dune-sand-100 font-bold mb-1">
              {champion.player.name}
            </p>
            <p className="text-dune-spice-400 font-dune">
              {champion.player.totalPoints} points
            </p>
          </Card>

          {/* 3rd Place */}
          <Card variant="glow" className="text-center">
            <div className="text-4xl mb-2">🥉</div>
            <h3 className="text-xl font-dune text-dune-spice-400 mb-2">3rd Place</h3>
            <p className="text-2xl text-dune-sand-100 font-medium mb-1">
              {thirdPlace.player.name}
            </p>
            <p className="text-dune-sand-400">
              {thirdPlace.player.totalPoints} pts
            </p>
          </Card>
        </motion.div>

        {/* Full Rankings */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <Card variant="elevated">
            <h3 className="text-2xl font-dune text-dune-spice-500 mb-4 text-center text-glow">
              Full Rankings
            </h3>
            <div className="space-y-2">
              {standings.slice(3).map((standing) => (
                <div
                  key={standing.player.id}
                  className="flex items-center justify-between bg-dune-desert-400/50 px-4 py-3 rounded border border-dune-sand-800"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-dune-spice-400 font-dune text-xl w-8">
                      {standing.rank}.
                    </span>
                    <span className="text-dune-sand-100 font-medium">
                      {standing.player.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-dune-sand-100 font-bold text-lg">
                      {standing.player.totalPoints} pts
                    </span>
                    <span className="text-dune-sand-400 text-sm ml-2">
                      ({standing.player.totalVictoryPoints} VP)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mt-8"
        >
          <Button
            variant="secondary"
            size="lg"
            onClick={handleExport}
          >
            Download Results
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleNewTournament}
          >
            Start New Tournament
          </Button>
        </motion.div>

        {/* Dune Quote */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="text-center mt-12"
        >
          <p className="text-dune-sand-500 italic font-dune text-lg">
            "He who controls the spice controls the universe"
          </p>
        </motion.div>
      </div>
    </div>
  );
}
