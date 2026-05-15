import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, X } from "lucide-react";

// SHA-256 hash of the admin password
// To change: run in browser console: crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword')).then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
// Default password: "colosseum2026"
const ADMIN_HASH = "6eaf9300058a9fbdc115b1de770ca1797a641e0088f8c1556650fa35ae7ae8bd";

async function hashPassword(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Session-level auth state (resets on page refresh)
let sessionAuthed = false;

interface PasswordGateProps {
  onUnlock: () => void;
  onCancel: () => void;
}

export function PasswordGate({ onUnlock, onCancel }: PasswordGateProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    setChecking(true);
    setError(false);
    const hash = await hashPassword(input);
    if (hash === ADMIN_HASH) {
      sessionAuthed = true;
      onUnlock();
    } else {
      setError(true);
    }
    setChecking(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-morphism-strong rounded-sm p-8 max-w-sm w-full text-center mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Lock size={28} className="text-spice mx-auto mb-3" style={{ filter: "drop-shadow(0 0 8px rgba(197,160,89,0.6))" }} />
        <h3 className="text-display text-lg text-spice mb-1 uppercase tracking-widest">Admin Access</h3>
        <p className="text-xs text-sand-dark mb-5 uppercase tracking-wider">Enter password to edit results</p>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Password..."
          className={`input-imperial w-full mb-3 text-center ${error ? "border-blood/60" : ""}`}
          autoFocus
        />
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-blood text-xs mb-3 uppercase tracking-wider">
              Incorrect password
            </motion.p>
          )}
        </AnimatePresence>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleSubmit}
            disabled={!input || checking}
            className={`px-6 py-2 bg-spice text-obsidian uppercase tracking-widest text-sm font-bold transition-colors ${
              !input || checking ? "opacity-40 cursor-not-allowed" : "hover:bg-spice-dark cursor-pointer"
            }`}
          >
            {checking ? "Checking..." : "Unlock"}
          </button>
          <button onClick={onCancel} className="btn-imperial text-sm py-2 px-4 flex items-center gap-1">
            <X size={14} /> Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function isSessionAuthed(): boolean {
  return sessionAuthed;
}

export function setSessionAuthed(val: boolean) {
  sessionAuthed = val;
}
