import { useState, useCallback } from "react";

interface SandwormRegistrationProps {
  onAddPlayer: (name: string) => void;
}

export function SandwormRegistration({ onAddPlayer }: SandwormRegistrationProps) {
  const [name, setName] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) return;

      onAddPlayer(trimmed);
      setName("");
    },
    [name, onAddPlayer]
  );

  return (
    <div className="flex gap-4 items-end w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-4 items-end w-full">
        <div className="flex-1">
          <label className="block text-xs text-sand-dark uppercase tracking-[0.2em] mb-2 opacity-60">
            Summon a Champion
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Name..."
            className="input-imperial"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="btn-imperial-filled px-6 py-3 whitespace-nowrap"
          disabled={!name.trim()}
        >
          Summon
        </button>
      </form>
    </div>
  );
}
