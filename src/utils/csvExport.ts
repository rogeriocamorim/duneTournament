import type { TournamentState, Player, Round } from "../engine/types";
import ExcelJS from "exceljs";

const GROUP_NAMES = [
  "House Atreides", "House Harkonnen", "House Corrino", "Spacing Guild",
  "Bene Tleilaxu", "Ixian", "Bene Gesserit", "Fremen",
];

const GROUP_SCHEDULE: [number[], number[]][] = [
  [[0,1,2,3],[4,5,6,7]],
  [[0,1,4,5],[2,3,6,7]],
  [[0,2,4,6],[1,3,5,7]],
  [[0,3,5,6],[1,2,4,7]],
];

// 8 distinct pastel colors per player seat
const PLAYER_COLORS = [
  "FFCCE5", "CCE8B4", "FFD580", "B3D9FF",
  "FFC8A0", "D4B3FF", "B3F0E0", "FFA0A0",
];

const SECTION_BG = "1A1A2E";
const HEADER_BG  = "2C2C2C";

// ── Stat helpers ──

function getVpSharePct(playerId: string, rounds: Round[]): number {
  let totalPct = 0, games = 0;
  for (const round of rounds)
    for (const table of round.tables) {
      if (!table.isComplete || !table.results.length) continue;
      const r = table.results.find((r) => r.playerId === playerId);
      if (!r) continue;
      const total = table.results.reduce((s, x) => s + x.vp, 0);
      if (total > 0) totalPct += (r.vp / total) * 100;
      games++;
    }
  return games > 0 ? totalPct / games : 0;
}

function getGamesPlayed(playerId: string, rounds: Round[]): number {
  let c = 0;
  for (const round of rounds)
    for (const table of round.tables)
      if (table.results.find((r) => r.playerId === playerId)) c++;
  return c;
}

function getWins(playerId: string, rounds: Round[]): number {
  let w = 0;
  for (const round of rounds)
    for (const table of round.tables)
      if (table.results.find((r) => r.playerId === playerId && r.position === 1)) w++;
  return w;
}

function getTotalVP(playerId: string, rounds: Round[]): number {
  let vp = 0;
  for (const round of rounds)
    for (const table of round.tables) {
      const r = table.results.find((r) => r.playerId === playerId);
      if (r) vp += r.vp;
    }
  return vp;
}

function sortGroup(players: Player[], rounds: Round[]): Player[] {
  const cache = new Map<string, number>();
  for (const p of players) cache.set(p.id, getVpSharePct(p.id, rounds));
  return [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const d = (cache.get(b.id) ?? 0) - (cache.get(a.id) ?? 0);
    if (d !== 0) return d;
    if (b.totalVP !== a.totalVP) return b.totalVP - a.totalVP;
    return a.name.localeCompare(b.name);
  });
}

// ── Style helpers ──

type CellValue = string | number;

function applySection(row: ExcelJS.Row, label: string, numCols: number) {
  row.getCell(1).value = label;
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FFEEEEEE" }, name: "Arial", size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + SECTION_BG } };
    cell.alignment = { vertical: "middle" };
  }
  row.height = 22;
}

function applyHeader(row: ExcelJS.Row, cols: string[]) {
  cols.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFEEEEEE" }, name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + HEADER_BG } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
      right: { style: "thin", color: { argb: "FFB0B0B0" } },
    };
  });
  row.height = 18;
}

function applyDataRow(row: ExcelJS.Row, values: CellValue[], colorHex: string, boldCols: number[] = []) {
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colorHex } };
    cell.font = { name: "Arial", size: 10, bold: boldCols.includes(i + 1), color: { argb: "FF111111" } };
    cell.alignment = { horizontal: i === 1 ? "left" : "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
      right: { style: "thin", color: { argb: "FFD0D0D0" } },
    };
  });
  row.height = 17;
}

// ── Main export ──

export async function exportGroupsCSV(state: TournamentState): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "The Colosseum";
  wb.created = new Date();

  const groups = new Map<number, Player[]>();
  for (let i = 0; i < 8; i++) groups.set(i, []);
  for (const p of state.players) groups.get(p.groupId ?? 0)?.push(p);

  for (let gid = 0; gid < 8; gid++) {
    const groupPlayers = groups.get(gid) ?? [];
    const groupName = GROUP_NAMES[gid] ?? `Group ${gid + 1}`;

    const seatedPlayers = [...groupPlayers].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );

    // Map player id → color
    const playerColor = new Map<string, string>();
    seatedPlayers.forEach((p, i) => playerColor.set(p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]));

    const ws = wb.addWorksheet(groupName.slice(0, 31));

    // Column widths
    ws.columns = [
      { width: 8 },  // Rank/Game
      { width: 28 }, // Name/Table
      { width: 16 }, // col3
      { width: 8 },  // col4
      { width: 16 }, // col5
      { width: 8 },  // col6
      { width: 16 }, // col7
      { width: 8 },  // col8
      { width: 16 }, // col9
      { width: 8 },  // col10
    ];

    // ── SECTION 1: STANDINGS ──
    applySection(ws.addRow([""]), groupName + " — Standings", 7);
    applyHeader(ws.addRow([""]), ["Rank", "Name", "Played", "Won", "VP Scored", "VP%", "Points"]);

    const sorted = sortGroup(groupPlayers, state.rounds);
    sorted.forEach((p, idx) => {
      const color = playerColor.get(p.id) ?? "FFFFFF";
      const vpPct = parseFloat(getVpSharePct(p.id, state.rounds).toFixed(1));
      applyDataRow(ws.addRow([""]),
        [idx + 1, p.name, getGamesPlayed(p.id, state.rounds), getWins(p.id, state.rounds),
         getTotalVP(p.id, state.rounds), vpPct, p.points],
        color, [2, 7]
      );
    });

    ws.addRow([]);
    ws.addRow([]);

    // ── SECTION 2: GAME SCHEDULE ──
    applySection(ws.addRow([""]), groupName + " — Game Schedule", 6);
    applyHeader(ws.addRow([""]), ["Game", "Round / Table", "Seat 1", "Seat 2", "Seat 3", "Seat 4"]);

    let gameNum = 1;
    for (let roundIdx = 0; roundIdx < 4; roundIdx++) {
      const [tableA, tableB] = GROUP_SCHEDULE[roundIdx];
      const roundLabel = `Round ${roundIdx + 1}`;
      for (const [seats, label] of [[tableA, "A"], [tableB, "B"]] as [number[], string][]) {
        const row = ws.addRow([""]);
        row.getCell(1).value = gameNum;
        row.getCell(2).value = `${roundLabel} — Table ${label}`;
        (seats as number[]).forEach((si, ci) => {
          const p = seatedPlayers[si];
          const cell = row.getCell(3 + ci);
          cell.value = p?.name ?? "";
          if (p) {
            const color = playerColor.get(p.id) ?? "FFFFFF";
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
          }
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = { horizontal: "center" };
          cell.border = { bottom: { style: "thin", color: { argb: "FFD0D0D0" } }, right: { style: "thin", color: { argb: "FFD0D0D0" } } };
        });
        row.getCell(1).font = { name: "Arial", size: 10 };
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).font = { name: "Arial", size: 10 };
        row.height = 17;
        gameNum++;
      }
    }

    ws.addRow([]);
    ws.addRow([]);

    // ── SECTION 3: GAME RESULTS ──
    applySection(ws.addRow([""]), groupName + " — Game Results", 10);
    applyHeader(ws.addRow([""]), ["Game", "Round / Table", "1st Place", "1st VP", "2nd Place", "2nd VP", "3rd Place", "3rd VP", "4th Place", "4th VP"]);

    gameNum = 1;
    const groupTableOffset = gid * 2;
    for (let roundIdx = 0; roundIdx < 4; roundIdx++) {
      const roundLabel = `Round ${roundIdx + 1}`;
      const appRound = state.rounds[roundIdx];
      for (let t = 0; t < 2; t++) {
        const tableLabel = `${roundLabel} — Table ${t === 0 ? "A" : "B"}`;
        const appTable = appRound?.tables[groupTableOffset + t];
        const results = [...(appTable?.results ?? [])].sort((a, b) => a.position - b.position);
        const getName = (pid: string) => state.players.find((p) => p.id === pid)?.name ?? "";

        const row = ws.addRow([""]);
        row.getCell(1).value = gameNum;
        row.getCell(2).value = tableLabel;
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(1).font = { name: "Arial", size: 10 };
        row.getCell(2).font = { name: "Arial", size: 10 };

        for (let pos = 0; pos < 4; pos++) {
          const r = results[pos];
          const name = r ? getName(r.playerId) : "";
          const vp = r?.vp ?? "";
          const color = r ? (playerColor.get(r.playerId) ?? "FFFFFF") : "FFFFFF";

          const nameCell = row.getCell(3 + pos * 2);
          const vpCell = row.getCell(4 + pos * 2);

          nameCell.value = name;
          vpCell.value = typeof vp === "number" ? vp : "";

          if (name) {
            nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
            vpCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
          }
          nameCell.font = { name: "Arial", size: 10 };
          vpCell.font = { name: "Arial", size: 10 };
          nameCell.alignment = { horizontal: "center" };
          vpCell.alignment = { horizontal: "center" };
          nameCell.border = { bottom: { style: "thin", color: { argb: "FFD0D0D0" } }, right: { style: "thin", color: { argb: "FFD0D0D0" } } };
          vpCell.border = { bottom: { style: "thin", color: { argb: "FFD0D0D0" } }, right: { style: "thin", color: { argb: "FFD0D0D0" } } };
        }
        row.height = 17;
        gameNum++;
      }
    }
  }

  // Download via blob
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  a.href = url;
  a.download = `colosseum_standings_${timestamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
