import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../context/TournamentContext';
import { calculateStandings } from '../../utils/scoring/calculateStandings';
import { exportTournamentToJson } from '../../utils/storage/exportImport';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { MAX_ROUNDS } from '../../utils/constants';

export function Standings() {
  const navigate = useNavigate();
  const { state } = useTournament();
  const tournament = state.tournament;

  if (!tournament) {
    navigate('/setup');
    return null;
  }

  const standings = calculateStandings(tournament.players);
  const isFinished = tournament.status === 'finished' || tournament.currentRound === MAX_ROUNDS;

  const handleContinue = () => {
    if (isFinished) {
      navigate('/final');
    } else {
      navigate('/draft');
    }
  };

  const handleExport = () => {
    if (tournament) {
      exportTournamentToJson(tournament);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-dune text-dune-spice-500 text-glow-strong mb-2">
            {isFinished ? 'Final' : 'Current'} Standings
          </h2>
          <p className="text-dune-sand-400">
            After Round {tournament.currentRound} of {MAX_ROUNDS}
          </p>
        </div>

        <Card variant="elevated" className="mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-dune-spice-700">
                  <th className="text-left py-3 px-4 font-dune text-dune-spice-500">Rank</th>
                  <th className="text-left py-3 px-4 font-dune text-dune-spice-500">Player</th>
                  <th className="text-center py-3 px-4 font-dune text-dune-spice-500">Points</th>
                  <th className="text-center py-3 px-4 font-dune text-dune-spice-500">VP</th>
                  <th className="text-center py-3 px-4 font-dune text-dune-spice-500">Wins</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, index) => (
                  <tr
                    key={standing.player.id}
                    className={`border-b border-dune-sand-800 ${
                      index === 0 ? 'bg-dune-spice-900/20' : ''
                    } ${standing.tied ? 'bg-yellow-900/10' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <span className={`font-dune text-lg ${
                        index === 0 ? 'text-dune-spice-400' : 'text-dune-sand-300'
                      }`}>
                        {standing.rank}
                        {standing.tied && '*'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-medium ${
                        index === 0 ? 'text-dune-spice-300' : 'text-dune-sand-200'
                      }`}>
                        {standing.player.name}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="font-bold text-dune-sand-100 text-lg">
                        {standing.player.totalPoints}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-dune-sand-300">
                        {standing.player.totalVictoryPoints}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="text-dune-sand-300">
                        {standing.player.firstPlaces}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {standings.some(s => s.tied) && (
            <div className="mt-4 text-sm text-dune-sand-400 italic">
              * Indicates tied positions
            </div>
          )}
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={handleExport}
          >
            Export Standings
          </Button>
          {!isFinished && (
            <Button
              variant="primary"
              size="lg"
              onClick={handleContinue}
            >
              Continue to Round {tournament.currentRound + 1}
            </Button>
          )}
          {isFinished && (
            <Button
              variant="primary"
              size="lg"
              onClick={handleContinue}
            >
              View Final Results
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
