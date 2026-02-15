import { useTournament } from '../../context/TournamentContext';

export function Header() {
  const { state } = useTournament();
  const tournament = state.tournament;

  return (
    <header className="bg-dune-desert-400/50 border-b-2 border-dune-spice-700 backdrop-blur-md sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-dune text-dune-spice-500 text-glow-strong">
              DUNE IMPERIUM BLOODLINES
            </h1>
            <p className="text-sm text-dune-sand-400 font-sans mt-1">
              Tournament Manager
            </p>
          </div>
          
          {tournament && (
            <div className="text-right">
              <p className="text-dune-sand-300 font-dune text-lg">
                {tournament.name}
              </p>
              <p className="text-dune-sand-500 text-sm">
                Round {tournament.currentRound} of {tournament.maxRounds}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
