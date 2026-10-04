import type { TournamentAction } from "../engine/reducer";
import type { StandingsSnapshot } from "../engine/snapshot";
import type { TierDef, TournamentMode, TournamentState } from "../engine/types";

// ===== TOURNAMENT API CLIENT =====
// Used when the app is built with VITE_API_URL (Docker deployment). Without it
// the app keeps everything in localStorage.

const API_URL: string = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "dune_admin_token";

export function isApiMode(): boolean {
  return API_URL.length > 0;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getAdminToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable — token lives only for this request
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAdminToken();
  if (token) headers["X-Admin-Token"] = token;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ===== TYPES =====

export interface TournamentSummary {
  id: string;
  name: string;
  mode: TournamentMode;
  phase: TournamentState["phase"];
  playerCount: number;
  shareSlug: string;
  updatedAt: string;
}

export interface TournamentRecord {
  id: string;
  shareSlug: string;
  state: TournamentState;
}

export interface ServerTierPreset {
  id: string;
  name: string;
  description: string;
  tiers: TierDef[];
}

// ===== ENDPOINTS =====

export function listTournaments(): Promise<TournamentSummary[]> {
  return request("GET", "/tournaments");
}

export function createTournament(input: {
  templateId?: string;
  tierPresetId?: string;
  name?: string;
  state?: TournamentState;
}): Promise<TournamentRecord> {
  return request("POST", "/tournaments", input);
}

export function getTournament(id: string): Promise<TournamentRecord> {
  return request("GET", `/tournaments/${encodeURIComponent(id)}`);
}

export function deleteTournament(id: string): Promise<void> {
  return request("DELETE", `/tournaments/${encodeURIComponent(id)}`);
}

export function postAction(id: string, action: TournamentAction): Promise<TournamentRecord> {
  return request("POST", `/tournaments/${encodeURIComponent(id)}/actions`, action);
}

export function getPublicSnapshot(shareSlug: string): Promise<StandingsSnapshot> {
  return request("GET", `/public/${encodeURIComponent(shareSlug)}`);
}

export function listTierPresets(): Promise<ServerTierPreset[]> {
  return request("GET", "/tier-presets");
}

export function saveTierPreset(preset: ServerTierPreset): Promise<ServerTierPreset> {
  return request("PUT", `/tier-presets/${encodeURIComponent(preset.id)}`, preset);
}

export function checkAdminToken(): Promise<{ ok: boolean }> {
  return request("GET", "/auth/check");
}
