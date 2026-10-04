# 🏜️ Dune Imperium Bloodlines Tournament Manager

Tournament manager for Dune: Imperium Bloodlines events. Tables always seat four players. Each tournament sets its own format, placement points, leader tiers and chess clock.

![Dune Theme](https://img.shields.io/badge/Theme-Dune-orange)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Postgres](https://img.shields.io/badge/Postgres-16-blue)

## ✨ Features

### Tournament formats (per tournament)
- **Templates**: Classic (Swiss + Top 16 bracket), Colosseum (groups of 8 + knockout), Swiss + Top 8, and Swiss + Final Table. Pick one, then change anything.
- **Stages**: any number of stages. Each stage sets:
  - **Rounds**: how many rounds the stage plays.
  - **Table distribution**:
    - Swiss: balanced snake draft with no rematches.
    - Random: no rematches when possible.
    - Seeded snake: 1-8-9-16, 2-7-10-15 …
    - Seeded blocks: 1-4, 5-8 …
    - Fixed groups of 8: the Colosseum schedule.
    - Manual: the organizer seats every table.
  - **Who plays**: everyone, the Top N of the previous stage, or the best N of each table in the previous stage's last round.
  - **Ranking basis**: points carried over from earlier stages, or only points scored in this stage.
- **Placement points**: points for 1st, 2nd, 3rd and 4th, with optional per-stage overrides. The default is 6 / 3 / 2 / 1.
- The settings dialog shows how many players and tables each stage will have. It blocks starting a tournament whose field cannot be seated at tables of 4.

### Leader tiers (per tournament)
- **Presets**: "Bloodlines S–E (TTS)" uses the same six tiers as the Bloodlines TTS mod. "Classic A/B/C" uses the original tiers.
- **Editing**: tiers are copied into each tournament, where you can rename, recolor, add or remove them and move leaders between them. On the server you can save them as a new preset.
- **Stage tiers**: for every stage, and optionally every round, choose which tiers supply the leader pool:
  - **Combined**: e.g. S+A.
  - **One at random**: picks one of the listed tiers.
  - **Pool size**: every leader of the tier(s), or a random draw of N.

### Chess clock
- Optional per tournament. Set the minutes per player, points lost per minute over, an optional cap per game, and how partial minutes count.
- Organizers type each player's minutes used when entering results. The penalty is shown live, saved with the result and subtracted from tournament points. Totals can go negative.
- Stages can turn the clock off or use a different budget.

### Everything else
- Dramatic table and leader reveals, round history, leader statistics, spectator view, and JSON import/export.

## 🏗️ Architecture

```
┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│  web (nginx) │ ───▶ │  api (Node)     │ ───▶ │  Postgres 16 │
│  React build │ /api │  Fastify +      │      │  tournaments,│
│              │      │  shared engine  │      │  tiers, ...  │
└──────────────┘      └─────────────────┘      └──────────────┘
```

- `src/engine/` is pure TypeScript and holds pairing, scoring, formats, tiers, the clock and the reducer. The browser and the server run the same code.
- **Server mode** (Docker, built with `VITE_API_URL`): every action is sent to the API. The API runs the reducer in a transaction and stores the result in normalized tables (`tournaments`, `tournament_tiers`, `players`, `rounds`, `round_tables`, `table_results` with `minutes_used` and `penalty_points`, and so on). Each action is also logged in `tournament_events`.
- **Browser mode** (GitHub Pages, no `VITE_API_URL`): state lives in localStorage, as before.
- **Spectators**: `?live=<share-slug>` refreshes from the server every 15 s. `?view=<id>` still opens JSONBin snapshots.

## 🚀 Quick Start (browser mode)

```bash
npm install
npm run dev        # http://localhost:5173/duneTournament/
npm test           # engine unit tests
npm run build
```

## 🐳 Server mode with Docker

```bash
cp .env.example .env         # set POSTGRES_PASSWORD and ADMIN_TOKEN
docker compose -p dune-tournament-dev --env-file .env up -d --build
# → http://localhost:8090  (WEB_PORT)
```

The organizer token (`ADMIN_TOKEN`) is needed for every change. The app asks for it once and remembers it in the browser.

Server development without Docker:

```bash
cd server && npm install
DATABASE_URL=postgres://dune:dune@localhost:5432/dune_tournament ADMIN_TOKEN=dev npm run dev
# in another terminal, from the repo root:
VITE_API_URL=http://localhost:3000/api npm run dev
```

Server tests need a Postgres database they may wipe:

```bash
cd server && TEST_DATABASE_URL=postgres://dune:dune@localhost:5432/dune_tournament_test npm test
```

## 🚢 Deployment

| Branch | Where | How |
|--------|-------|-----|
| `dev`  | Orange Pi test server, `192.168.2.22:8090` | `./deploy/deploy.sh dev` |
| `main` | GitHub Pages (browser mode) | GitHub Actions on push |
| `main` | Production server (Docker) | `PROD_HOST=<server> ./deploy/deploy.sh prod` |

`deploy/deploy.sh` copies the repo to the server over SSH and runs `docker compose up -d --build` there.
- **SSH**: user `root` with key `~/.ssh/id_rsa_dunerank`. Override with `SSH_USER` and `SSH_KEY`.
- **First deploy**: creates the server's `.env` with a random database password and organizer token.
- **Other commands**:

```bash
./deploy/deploy.sh dev token     # show the organizer token
./deploy/deploy.sh dev status    # container status
./deploy/deploy.sh dev logs api  # follow API logs
./deploy/deploy.sh dev backup    # pg_dump into ./backups/
```

The Orange Pi needs Docker with the compose plugin. All images (`node:22-alpine`, `postgres:16-alpine`, `nginx:alpine`) support ARM64.

CI (`.github/workflows/ci.yml`) runs unit tests, the build, server API tests against Postgres, and the Docker image build on `dev` and on pull requests.

## 🎮 Default rules (Classic template)

- **Points**: 1st 6, 2nd 3, 3rd 2, 4th 1.
- **Tie-breakers**: points → 1st-place finishes → VP share % → total VP → average finish.
- **Qualifying**: Swiss pairing with snake-draft balance and no rematches.
- **Bracket**: Top 16 double-chance bracket (semifinal → redemption → grand final).

## 📝 License

MIT License - feel free to use for your tournaments!

---

**"The spice must flow..."** 🏜️
