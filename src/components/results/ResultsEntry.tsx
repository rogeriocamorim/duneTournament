import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../context/TournamentContext';
import { validateTableResults } from '../../utils/validation/playerValidation';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import type { TableResult } from '../../types/round';

export function ResultsEntry() {
  const navigate = useNavigate();
  const { state, completeRound, setStatus } = useTournament();
  const tournament = state.tournament;

  const [results, setResults] = useState<Record<number, TableResult[]>>({});
  const [error, setError] = useState('');

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

  const updateResult = (tableNumber: number, playerId: string, field: 'placement' | 'victoryPoints', value: any) => {
    const tableResults = results[tableNumber] || currentRound.tables
      .find(t => t.tableNumber === tableNumber)?.playerIds.map(id => ({
        playerId: id,
        placement: 1 as 1 | 2 | 3 | 4,
        victoryPoints: 0,
      })) || [];

    const updated = tableResults.map(r => {
      if (r.playerId === playerId) {
        return { ...r, [field]: field === 'placement' ? parseInt(value) : parseInt(value) || 0 };
      }
      return r;
    });

    setResults({ ...results, [tableNumber]: updated });
  };

  const handleSubmit = () => {
    // Validate all tables have results
    const tables = currentRound.tables.map(table => {
      const tableResults = results[table.tableNumber];
      
      if (!tableResults || tableResults.length !== 4) {
        setError(`Table ${table.tableNumber} is missing results`);
        return null;
      }

      const validation = validateTableResults(tableResults);
      if (!validation.valid) {
        setError(`Table ${table.tableNumber}: ${validation.error}`);
        return null;
      }

      return {
        ...table,
        results: tableResults,
      };
    });

    if (tables.some(t => t === null)) {
      return;
    }

    completeRound(tournament.currentRound, tables as any[]);
    setStatus('round-complete');
    navigate('/standings');
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-dune text-dune-spice-500 text-glow-strong mb-2">
            Record Results - Round {tournament.currentRound}
          </h2>
          <p className="text-dune-sand-400">
            Enter placement and victory points for each player
          </p>
        </div>

        <div className="space-y-6 mb-8">
          {currentRound.tables.map((table) => {
            const tableResults = results[table.tableNumber] || table.playerIds.map(id => ({
              playerId: id,
              placement: 1 as 1 | 2 | 3 | 4,
              victoryPoints: 0,
            }));

            return (
              <Card key={table.tableNumber} variant="elevated">
                <h3 className="text-2xl font-dune text-dune-spice-500 mb-4 text-glow">
                  Table {table.tableNumber}
                </h3>
                <div className="space-y-3">
                  {table.playerIds.map((playerId) => {
                    const result = tableResults.find(r => r.playerId === playerId);
                    
                    return (
                      <div
                        key={playerId}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-dune-desert-400/50 p-4 rounded border border-dune-sand-800"
                      >
                        <div className="flex items-center">
                          <span className="text-dune-sand-100 font-medium">
                            {getPlayerName(playerId)}
                          </span>
                        </div>
                        
                        <div>
                          <label className="block text-dune-sand-400 text-sm mb-1">
                            Placement
                          </label>
                          <select
                            value={result?.placement || 1}
                            onChange={(e) => updateResult(table.tableNumber, playerId, 'placement', e.target.value)}
                            className="w-full px-3 py-2 bg-dune-desert-500 border border-dune-sand-700 rounded text-dune-sand-100 focus:outline-none focus:border-dune-spice-500"
                          >
                            <option value="1">1st (5 pts)</option>
                            <option value="2">2nd (3 pts)</option>
                            <option value="3">3rd (2 pts)</option>
                            <option value="4">4th (1 pt)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-dune-sand-400 text-sm mb-1">
                            Victory Points
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={result?.victoryPoints || 0}
                            onChange={(e) => updateResult(table.tableNumber, playerId, 'victoryPoints', e.target.value)}
                            className="w-full px-3 py-2 bg-dune-desert-500 border border-dune-sand-700 rounded text-dune-sand-100 focus:outline-none focus:border-dune-spice-500"
                            placeholder="VP"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 mb-6">
            {error}
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/round')}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
          >
            Submit Results
          </Button>
        </div>
      </div>
    </div>
  );
}
