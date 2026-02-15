import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../context/TournamentContext';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';

export function RoundManager() {
  const navigate = useNavigate();
  const { state } = useTournament();
  const tournament = state.tournament;

  if (!tournament) {
    navigate('/setup');
    return null;
  }

  const currentRound = tournament.rounds.find(r => r.roundNumber === tournament.currentRound);

  if (!currentRound) {
    navigate('/setup');
    return null;
  }

  const getPlayerName = (playerId: string) => {
    return tournament.players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  const handleRecordResults = () => {
    navigate('/results');
  };

  const handleViewStandings = () => {
    navigate('/standings');
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-dune text-dune-spice-500 text-glow-strong mb-2">
            Round {tournament.currentRound} of {tournament.maxRounds}
          </h2>
          <p className="text-dune-sand-400">
            Games in progress...
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {currentRound.tables.map((table) => (
            <Card key={table.tableNumber} variant="elevated">
              <h3 className="text-2xl font-dune text-dune-spice-500 mb-4 text-glow">
                Table {table.tableNumber}
              </h3>
              <ul className="space-y-2">
                {table.playerIds.map((playerId) => (
                  <li
                    key={playerId}
                    className="flex items-center text-dune-sand-200 py-1"
                  >
                    <span className="text-dune-spice-400 mr-2">•</span>
                    {getPlayerName(playerId)}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={handleViewStandings}
          >
            View Current Standings
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleRecordResults}
          >
            Record Results for Round {tournament.currentRound}
          </Button>
        </div>
      </div>
    </div>
  );
}
