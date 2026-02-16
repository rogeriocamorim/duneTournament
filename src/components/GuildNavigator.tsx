import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useCallback } from "react";
import { Download, Upload, X, AlertTriangle } from "lucide-react";
import type { TournamentState } from "../engine/types";
import { validateImportSchema } from "../engine/tournament";

interface GuildNavigatorProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (state: TournamentState) => void;
}

export function GuildNavigator({ isOpen, onClose, onExport, onImport }: GuildNavigatorProps) {
  const [error, setError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<TournamentState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportPreview(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!validateImportSchema(data)) {
          setError("Invalid tournament schema. The file does not match the expected format.");
          return;
        }
        setImportPreview(data as TournamentState);
      } catch {
        setError("Failed to parse JSON file. Please check the file format.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (importPreview) {
      onImport(importPreview);
      setImportPreview(null);
      onClose();
    }
  }, [importPreview, onImport, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="glass-morphism-strong rounded-sm p-8 max-w-lg w-full relative">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-sand-dark hover:text-spice transition-colors"
              >
                <X size={20} />
              </button>

              {/* Header */}
              <h2 className="text-display text-xl mb-1 text-spice spice-text-glow">
                Guild Navigator
              </h2>
              <p className="text-sm text-sand-dark mb-6 uppercase tracking-wider">
                Tournament Data Transport
              </p>

              {/* Export Section */}
              <div className="mb-6 p-4 glass-morphism rounded-sm">
                <h3 className="text-display text-sm mb-3 flex items-center gap-2">
                  <Download size={16} className="text-spice" />
                  Export State
                </h3>
                <p className="text-xs text-sand-dark mb-3">
                  Download the complete tournament state as a JSON file.
                </p>
                <button onClick={onExport} className="btn-imperial text-sm py-2 px-4">
                  Download JSON
                </button>
              </div>

              {/* Import Section */}
              <div className="p-4 glass-morphism rounded-sm">
                <h3 className="text-display text-sm mb-3 flex items-center gap-2">
                  <Upload size={16} className="text-spice" />
                  Import State
                </h3>
                <p className="text-xs text-sand-dark mb-3">
                  Upload a tournament JSON file to restore a previous state.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-imperial text-sm py-2 px-4"
                >
                  Select File
                </button>

                {/* Error display */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 bg-blood/20 border border-blood/40 rounded-sm flex items-start gap-2"
                  >
                    <AlertTriangle size={16} className="text-blood mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-red-300">{error}</span>
                  </motion.div>
                )}

                {/* Import preview */}
                {importPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 glass-morphism rounded-sm"
                  >
                    <p className="text-xs text-spice mb-2">
                      Tournament: {importPreview.metadata.tournamentName}
                    </p>
                    <p className="text-xs text-sand-dark">
                      Players: {importPreview.players.length} | Rounds:{" "}
                      {importPreview.rounds.length} | Phase: {importPreview.phase}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleConfirmImport}
                        className="btn-imperial-filled text-xs py-1 px-3"
                      >
                        Confirm Import
                      </button>
                      <button
                        onClick={() => setImportPreview(null)}
                        className="btn-imperial text-xs py-1 px-3"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
