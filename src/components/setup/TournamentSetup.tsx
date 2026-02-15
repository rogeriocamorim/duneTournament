import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../../context/TournamentContext';
import { validatePlayerNames } from '../../utils/validation/playerValidation';
import { importTournamentFromJson } from '../../utils/storage/exportImport';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { Modal } from '../shared/Modal';

export function TournamentSetup() {
  const navigate = useNavigate();
  const { createTournament, importTournament } = useTournament();
  
  const [tournamentName, setTournamentName] = useState('Dune Tournament');
  const [playerInput, setPlayerInput] = useState('');
  const [players, setPlayers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addPlayer = () => {
    const trimmed = playerInput.trim();
    if (!trimmed) {
      setError('Player name cannot be empty');
      return;
    }
    
    if (players.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      setError('Player name must be unique');
      return;
    }
    
    setPlayers([...players, trimmed]);
    setPlayerInput('');
    setError('');
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const handleStart = () => {
    const validation = validatePlayerNames(players);
    if (!validation.valid) {
      setError(validation.error || 'Invalid players');
      return;
    }
    
    createTournament(tournamentName, players);
    navigate('/draft');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const tournament = await importTournamentFromJson(file);
      importTournament(tournament);
      
      // Navigate based on tournament status
      if (tournament.status === 'finished') {
        navigate('/results');
      } else if (tournament.status === 'in-progress' || tournament.status === 'round-complete') {
        navigate('/round');
      } else {
        navigate('/draft');
      }
    } catch (err) {
      setError('Failed to import tournament file');
    }
    
    setShowImportModal(false);
  };

  const isValidCount = players.length >= 8 && players.length % 4 === 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sand-particles">
      <Card variant="elevated" className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-dune text-dune-spice-500 text-glow-strong mb-2">
            Tournament Setup
          </h2>
          <p className="text-dune-sand-400">
            "The spice must flow..." - Configure your tournament
          </p>
        </div>

        <div className="space-y-6">
          {/* Tournament Name */}
          <div>
            <label className="block text-dune-sand-300 font-dune mb-2">
              Tournament Name
            </label>
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="w-full px-4 py-3 bg-dune-desert-400 border border-dune-sand-700 rounded-lg text-dune-sand-100 focus:outline-none focus:border-dune-spice-500 focus:ring-2 focus:ring-dune-spice-500/50"
              placeholder="Enter tournament name"
            />
          </div>

          {/* Player Count Status */}
          <div className="bg-dune-desert-400/50 border-l-4 border-dune-spice-500 p-4 rounded">
            <p className="text-dune-sand-200">
              <span className="font-dune text-dune-spice-500 text-xl mr-2">
                {players.length}
              </span>
              players
              {isValidCount ? (
                <span className="ml-2 text-green-400">✓ Valid</span>
              ) : (
                <span className="ml-2 text-dune-spice-400">
                  (Need multiple of 4, minimum 8)
                </span>
              )}
            </p>
          </div>

          {/* Add Player */}
          <div>
            <label className="block text-dune-sand-300 font-dune mb-2">
              Add Players
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                className="flex-1 px-4 py-3 bg-dune-desert-400 border border-dune-sand-700 rounded-lg text-dune-sand-100 focus:outline-none focus:border-dune-spice-500 focus:ring-2 focus:ring-dune-spice-500/50"
                placeholder="Enter player name..."
              />
              <Button onClick={addPlayer} size="md">
                Add
              </Button>
            </div>
          </div>

          {/* Player List */}
          {players.length > 0 && (
            <div className="border border-dune-sand-800 rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {players.map((player, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-dune-desert-400/50 px-4 py-2 rounded border border-dune-sand-800"
                  >
                    <span className="text-dune-sand-200">
                      <span className="text-dune-spice-500 font-dune mr-3">
                        {index + 1}.
                      </span>
                      {player}
                    </span>
                    <button
                      onClick={() => removePlayer(index)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setShowImportModal(true)}
            >
              Import Tournament
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handleStart}
              disabled={!isValidCount || !tournamentName}
            >
              Begin Tournament
            </Button>
          </div>
        </div>
      </Card>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Tournament"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-dune-sand-300">
            Select a previously exported tournament JSON file to continue.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="w-full text-dune-sand-300"
          />
          <Button
            variant="secondary"
            onClick={() => setShowImportModal(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
