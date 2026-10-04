# AGENTS.md — Dune Tournament Manager

React 19 app for managing Dune: Imperium tournaments, plus an optional Node API with Postgres.
- Browser mode (no `VITE_API_URL`): state in localStorage, deployed to GitHub Pages at `/duneTournament/`.
- Server mode (Docker): the API in `server/` runs the shared engine reducer and stores tournaments in Postgres.

**Stack**: TypeScript 5.9, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), Motion v12 (`motion/react`),
`lucide-react`, ESM (`"type": "module"`).

## Build / Lint / Dev Commands

```bash
npm run dev          # Start Vite dev server (http://localhost:5173/duneTournament/)
npm run build        # tsc -b && vite build (type-check then bundle)
npm run lint         # eslint .
npm run preview      # Preview production build locally
npm run deploy       # Build + deploy to GitHub Pages via gh-pages
```

```bash
npm test             # Run Vitest tests once (vitest run)
npm run test:watch   # Run Vitest in watch mode
```

```bash
cd server
npm run dev          # API with reload (needs DATABASE_URL)
npm run typecheck
TEST_DATABASE_URL=postgres://... npm test   # API tests (wipes that database)
```

```bash
docker compose -p dune-tournament-dev --env-file .env up -d --build   # full stack
./deploy/deploy.sh dev                                                # deploy to the Orange Pi
```

**Test framework**: Vitest 4. Tests live alongside source files (`*.test.ts`).
Engine tests: `src/engine/tournament.test.ts` (pairing, bracket, standings) and
`src/engine/format.test.ts` (formats, stages, tier rules, placement points, clock penalties).
Server tests: `server/test/api.test.ts` (real Postgres).

## Project Structure

```
dune-tournament/
  src/
    main.tsx                        # Entry point (createRoot + StrictMode)
    App.tsx                         # Root component — phase-based rendering
    index.css                       # Tailwind + custom theme + utility classes
    engine/
      types.ts                      # All shared interfaces, constants, leader data
      tournament.ts                 # Pure logic: pairing, scoring, standings
      format.ts                     # Formats/templates, stages, tier presets + rules, clock
      reducer.ts                    # Tournament state machine (browser + server)
      snapshot.ts                   # Spectator snapshot builder
    api/
      client.ts                     # API client (server mode)
    hooks/
      useTournamentState.ts         # Local reducer or server actions + persistence
    pages/
      RegistrationPage.tsx          # Player registration phase
      DashboardPage.tsx             # Qualifying rounds (Swiss pairing)
      Top8Page.tsx                  # Top 16 elimination bracket
    components/
      TableCard.tsx                 # Table result entry/display
      Leaderboard.tsx               # Standings table
      GuildNavigator.tsx            # Import/Export modal
      LeaderStatsPanel.tsx          # Leader (character) statistics
      TournamentSettingsModal.tsx   # Format, points, clock, tiers, stage tiers
      ManualPairingModal.tsx        # Organizer seats tables (manual pairing)
      animations/
        SandstormTransition.tsx     # Full-screen wipe transition
        SpiceExplosion.tsx          # Particle burst animation
        SandwormRegistration.tsx    # Player name input form
  server/
    src/app.ts                      # Fastify routes (/api/...)
    src/repository.ts               # TournamentState <-> normalized tables
    migrations/*.sql                # Schema, applied on startup
  deploy/deploy.sh                  # SSH + docker compose deploy (dev/prod)
  docker-compose.yml                # web (nginx) + api + db (Postgres)
  vite.config.ts                    # base: VITE_BASE or "/duneTournament/"
  eslint.config.js                  # ESLint 9 flat config
  tsconfig.json                     # Project references root
  tsconfig.app.json                 # App: ES2022, strict, verbatimModuleSyntax
  tsconfig.node.json                # Vite config: ES2023
```

## TypeScript

Strict mode with: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
`verbatimModuleSyntax: true` — **must use `import type` for type-only imports**.
`erasableSyntaxOnly: true`.

## Code Style Guidelines

### Formatting

Double quotes, 2-space indentation, semicolons required, trailing commas.
No Prettier — follow existing file conventions.

### Imports

Order: 1) React/framework 2) Third-party libs 3) Internal modules (relative paths only).
Use `import type` for type-only imports (enforced by compiler):
```ts
import type { Player, Round } from "./types";
import { getLeaderInfo } from "./types";
```

### Naming Conventions

| Element             | Convention        | Example                          |
|---------------------|-------------------|----------------------------------|
| Component files     | PascalCase        | `TableCard.tsx`, `DashboardPage.tsx` |
| Non-component files | camelCase         | `tournament.ts`, `useTournamentState.ts` |
| Page components     | `*Page` suffix    | `RegistrationPage`, `Top8Page`   |
| Hook files          | `use*` prefix     | `useTournamentState.ts`          |
| Components          | PascalCase        | `export function Leaderboard()`  |
| Functions (engine)  | camelCase         | `generateSwissPairing`, `applyResults` |
| Module constants    | UPPER_SNAKE_CASE  | `STORAGE_KEY`, `POINTS_MAP`      |
| Local variables     | camelCase         | `currentRound`, `completedCount` |
| Types/Interfaces    | PascalCase        | `Player`, `TournamentState`      |
| Props interfaces    | `*Props` suffix   | `TableCardProps`, `DashboardPageProps` |
| Unused variables    | `_` prefix        | `_showExplosion`                 |

### Types

- **Prefer `interface`** for all data structures and component props
- **Use `type`** only for union types and simple aliases:
  ```ts
  type LeaderTier = "A" | "B" | "C" | "none";
  type TabView = "tables" | "standings" | "leaders";
  ```
- Shared types go in `src/engine/types.ts`
- Component props interfaces stay local (same file, not exported)
- Discriminated unions for reducer actions:
  ```ts
  type Action = { type: "ADD_PLAYER"; name: string } | { type: "REMOVE_PLAYER"; id: string } | ...
  ```

### Components

- Functional components only — named function declarations (not arrow functions)
- Named exports (`export function X()`), except `App` which uses `export default`
- Destructure props in function signature. No barrel files.

### State Management

- One reducer (`engine/reducer.ts`) used by `useTournamentState` and by the API — no Context, no external libs
- New tournament behavior goes into the reducer/engine so both modes stay identical
- Props drilled from `App` → pages → components
- `structuredClone()` for deep copies in engine (not spread for nested mutations)
- localStorage key: `dune_tournament_state`

### Error Handling

- Early returns for invalid state: `if (!round) return state;`
- `alert()` for user-facing validation in form submissions
- Empty `catch` blocks acceptable for localStorage parse failures
- Non-null assertions (`!`) on Map lookups where existence is guaranteed
- No error boundaries or custom error types

### Styling

- Tailwind utility classes on JSX; custom theme in `index.css` (`obsidian`, `spice`, `fremen-blue`, `sand`, `stone`, `blood`)
- Utility classes: `.glass-morphism`, `.stone-card`, `.btn-imperial`, `.input-imperial`
- Template literals for conditional classes; inline `style` for dynamic values

### Comments

Section headers: `// ===== SECTION NAME =====`. JSDoc `/** */` on exported engine functions.

### Engine Architecture

`engine/` is **pure TypeScript** — zero React imports, zero browser APIs at module load (the
server imports it). Functions take state in, return new state.
Tournament rules (points, tiers, clock, stages) come from `state.format` and `state.tiers`;
never hard-code tiers or points in components — use the helpers in `format.ts`.

### Deployment

GitHub Actions deploys browser mode to GitHub Pages on push to `main`.
`dev` is tested on the Orange Pi (192.168.2.13) with `./deploy/deploy.sh dev`; CI runs on `dev` and PRs.

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any shell command containing `curl` or `wget` will be intercepted and blocked by the context-mode plugin. Do NOT retry.
Instead use:
- `context-mode_ctx_fetch_and_index(url, source)` to fetch and index web pages
- `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any shell command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` will be intercepted and blocked. Do NOT retry with shell.
Instead use:
- `context-mode_ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### Direct web fetching — BLOCKED
Do NOT use any direct URL fetching tool. Use the sandbox equivalent.
Instead use:
- `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Shell (>20 lines output)
Shell is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `context-mode_ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `context-mode_ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### File reading (for analysis)
If you are reading a file to **edit** it → reading is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `context-mode_ctx_execute_file(path, language, code)` instead. Only your printed summary enters context.

### grep / search (large results)
Search results can flood context. Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `upgrade` MCP tool, run the returned shell command, display as checklist |
