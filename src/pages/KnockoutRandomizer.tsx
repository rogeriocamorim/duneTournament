import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shuffle, Trophy, Swords, ChevronRight } from "lucide-react";
import type { Player, Round } from "../engine/types";
import { getVpSharePct } from "../engine/tournament";

interface KnockoutRandomizerProps {
  players: Player[];
  rounds: Round[];
  onConfirm: (sf1a: Player[], sf1b: Player[], elimA: Player[], elimB: Player[]) => void;
}

function sortGroupPlayers(players: Player[], rounds: Round[]): Player[] {
  const cache = new Map<string, number>();
  for (const p of players) cache.set(p.id, getVpSharePct(p.id, rounds));
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const d = (cache.get(b.id) ?? 0) - (cache.get(a.id) ?? 0);
    if (d !== 0) return d;
    return b.totalVP - a.totalVP;
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const GROUP_NAMES = [
  "House Atreides","House Harkonnen","House Corrino","Spacing Guild",
  "Bene Tleilaxu","Ixian","Bene Gesserit","Fremen",
];

function TierBadge({ tier }: { tier: "A"|"B"|"C" }) {
  const colors = { A:"#ef4444", B:"#c5a059", C:"#38bdf8" };
  const c = colors[tier];
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-sm border ml-2"
      style={{ color:c, borderColor:c, background:`${c}18` }}>
      {tier} TIER
    </span>
  );
}

function PlayerPill({ player, label, accent }: { player: Player; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-sand-dark w-28 flex-shrink-0 truncate">{label}</span>
      <span className="text-display text-sm text-sand flex-1 truncate">{player.name}</span>
      <span className="text-xs font-bold" style={{ color: accent }}>{player.points}pts</span>
    </div>
  );
}

function TableCard({ title, players, groupNames, accent, tier }: {
  title: string; players: Player[]; groupNames: string[]; accent: string; tier: "A"|"B"|"C";
}) {
  return (
    <div className="glass-morphism rounded-sm overflow-hidden" style={{ border:`1px solid ${accent}30` }}>
      <div className="px-4 py-2.5 flex items-center justify-between"
        style={{ background:`${accent}12`, borderBottom:`1px solid ${accent}20` }}>
        <span className="text-display text-xs uppercase tracking-widest font-bold" style={{ color:accent }}>{title}</span>
        <TierBadge tier={tier} />
      </div>
      <div className="px-4 py-2">
        {players.map((p, i) => (
          <PlayerPill key={p.id} player={p} label={groupNames[i] ?? ""} accent={accent} />
        ))}
      </div>
    </div>
  );
}

export function KnockoutRandomizer({ players, rounds, onConfirm }: KnockoutRandomizerProps) {
  // Build group winners (1st) and runners-up (2nd) per group
  const groups = new Map<number, Player[]>();
  for (let i = 0; i < 8; i++) groups.set(i, []);
  for (const p of players) groups.get(p.groupId ?? 0)?.push(p);

  const groupWinners: { player: Player; groupName: string }[] = [];
  const groupRunnerUps: { player: Player; groupName: string }[] = [];

  for (let gid = 0; gid < 8; gid++) {
    const gPlayers = groups.get(gid) ?? [];
    const sorted = sortGroupPlayers(gPlayers, rounds);
    const groupName = GROUP_NAMES[gid];
    if (sorted[0]) groupWinners.push({ player: sorted[0], groupName });
    if (sorted[1]) groupRunnerUps.push({ player: sorted[1], groupName });
  }

  const [sf1a, setSf1a] = useState<{ player: Player; groupName: string }[]>([]);
  const [sf1b, setSf1b] = useState<{ player: Player; groupName: string }[]>([]);
  const [elimA, setElimA] = useState<{ player: Player; groupName: string }[]>([]);
  const [elimB, setElimB] = useState<{ player: Player; groupName: string }[]>([]);
  const [drawn, setDrawn] = useState(false);
  const [animating, setAnimating] = useState(false);

  const handleDraw = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      // SF1: 8 group winners randomly split into 2 tables of 4
      const shuffledWinners = shuffle(groupWinners);
      setSf1a(shuffledWinners.slice(0, 4));
      setSf1b(shuffledWinners.slice(4, 8));

      // Elim: 8 runner-ups randomly split into 2 tables of 4
      const shuffledRunners = shuffle(groupRunnerUps);
      setElimA(shuffledRunners.slice(0, 4));
      setElimB(shuffledRunners.slice(4, 8));

      setDrawn(true);
      setAnimating(false);
    }, 600);
  }, [groupWinners, groupRunnerUps]);

  const handleReshuffle = useCallback(() => {
    setDrawn(false);
    setTimeout(handleDraw, 100);
  }, [handleDraw]);

  const handleConfirm = useCallback(() => {
    onConfirm(
      sf1a.map(x => x.player), sf1b.map(x => x.player),
      elimA.map(x => x.player), elimB.map(x => x.player)
    );
  }, [sf1a, sf1b, elimA, elimB, onConfirm]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center mb-8">
        <Trophy size={36} className="text-spice mx-auto mb-3"
          style={{ filter:"drop-shadow(0 0 12px rgba(197,160,89,0.6))" }} />
        <h1 className="text-display text-3xl text-spice spice-text-glow mb-2 uppercase tracking-widest">
          Knockout Draw
        </h1>
        <p className="text-sm text-sand-dark uppercase tracking-widest">
          8 Group Winners · 8 Runner-Ups · 16 Gladiators Remain
        </p>
      </motion.div>

      {/* Bracket legend */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
        className="glass-morphism rounded-sm p-4 mb-8 border border-white/10 text-xs space-y-1.5">
        <p className="text-sand uppercase tracking-wider font-bold mb-2">Bracket Path</p>
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-bold w-32">SF1 A + SF1 B</span>
          <span className="text-sand-dark">8 group winners → 2 tables of 4</span>
          <TierBadge tier="A" />
          <span className="text-sand-dark ml-2">→ 2 winners advance to Final</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-bold w-32">Elim A + Elim B</span>
          <span className="text-sand-dark">8 runner-ups → 2 tables of 4</span>
          <TierBadge tier="A" />
          <span className="text-sand-dark ml-2">→ 2 winners advance to SF2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-spice font-bold w-32">SF2 A + SF2 B</span>
          <span className="text-sand-dark">SF1 losers (6) + Elim winners (2) → 2 tables of 4</span>
          <TierBadge tier="B" />
          <span className="text-sand-dark ml-2">→ 2 winners advance to Final</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sky-400 font-bold w-32">Final</span>
          <span className="text-sand-dark">SF1A + SF1B + SF2A + SF2B winners</span>
          <TierBadge tier="C" />
        </div>
      </motion.div>

      {/* Pre-draw seedings */}
      {!drawn && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="glass-morphism rounded-sm p-4 border border-red-500/20">
            <p className="text-display text-xs text-red-400 uppercase tracking-widest mb-3 font-bold">
              Group Winners — Seeds 1–8
            </p>
            {groupWinners.map(({ player, groupName }) => (
              <PlayerPill key={player.id} player={player} label={groupName} accent="#ef4444" />
            ))}
          </div>
          <div className="glass-morphism rounded-sm p-4 border border-spice/20">
            <p className="text-display text-xs text-spice uppercase tracking-widest mb-3 font-bold">
              Runner-Ups — Seeds 9–16
            </p>
            {groupRunnerUps.map(({ player, groupName }) => (
              <PlayerPill key={player.id} player={player} label={groupName} accent="#c5a059" />
            ))}
          </div>
        </div>
      )}

      {/* Draw button */}
      {!drawn && (
        <div className="flex justify-center mb-8">
          <motion.button onClick={handleDraw} disabled={animating}
            whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
            className="btn-imperial-filled px-12 py-4 text-base uppercase tracking-widest flex items-center gap-3">
            <Shuffle size={20} className={animating ? "animate-spin" : ""} />
            {animating ? "Drawing..." : "Draw the Bracket"}
          </motion.button>
        </div>
      )}

      {/* Draw results */}
      <AnimatePresence>
        {drawn && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="space-y-6">

            {/* SF1 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={14} className="text-red-400" />
                <span className="text-display text-xs text-red-400 uppercase tracking-widest font-bold">
                  Semi-Final 1
                </span>
                <span className="text-xs text-sand-dark">— 8 group winners split randomly</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TableCard title="SF1 — Table A" players={sf1a.map(x=>x.player)}
                  groupNames={sf1a.map(x=>x.groupName)} accent="#ef4444" tier="A" />
                <TableCard title="SF1 — Table B" players={sf1b.map(x=>x.player)}
                  groupNames={sf1b.map(x=>x.groupName)} accent="#ef4444" tier="A" />
              </div>
            </div>

            {/* Eliminators */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Swords size={14} className="text-red-400" />
                <span className="text-display text-xs text-red-400 uppercase tracking-widest font-bold">
                  Eliminator
                </span>
                <span className="text-xs text-sand-dark">— 8 runner-ups split randomly</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TableCard title="Eliminator A" players={elimA.map(x=>x.player)}
                  groupNames={elimA.map(x=>x.groupName)} accent="#ef4444" tier="A" />
                <TableCard title="Eliminator B" players={elimB.map(x=>x.player)}
                  groupNames={elimB.map(x=>x.groupName)} accent="#ef4444" tier="A" />
              </div>
            </div>

            {/* SF2 preview */}
            <div className="glass-morphism rounded-sm p-4 border border-spice/20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-display text-xs text-spice uppercase tracking-widest font-bold">
                  Semi-Final 2
                </span>
                <TierBadge tier="B" />
              </div>
              <p className="text-xs text-sand-dark">
                SF1A losers (3) + SF1B losers (3) + Elim A winner + Elim B winner
                → randomly drawn into SF2 A &amp; SF2 B (2 tables of 4)
              </p>
            </div>

            {/* Final preview */}
            <div className="glass-morphism rounded-sm p-4 border border-sky-400/20">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={14} className="text-sky-400" />
                <span className="text-display text-xs text-sky-400 uppercase tracking-widest font-bold">
                  The Final
                </span>
                <TierBadge tier="C" />
              </div>
              <p className="text-xs text-sand-dark">
                SF1A winner + SF1B winner + SF2A winner + SF2B winner
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-4 pt-2">
              <button onClick={handleReshuffle}
                className="btn-imperial py-2 px-6 flex items-center gap-2 text-sm">
                <Shuffle size={14} /> Reshuffle
              </button>
              <button onClick={handleConfirm}
                className="btn-imperial-filled py-3 px-10 flex items-center gap-2">
                Confirm Draw <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
