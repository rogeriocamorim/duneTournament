-- Dune tournament schema: leaders, tier presets, format templates and
-- tournaments with their tiers, players, rounds, tables and results.

CREATE TABLE leaders (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  expansion     text NOT NULL,
  image_slug    text,
  is_community  boolean NOT NULL DEFAULT false,
  tts_id        text,
  active        boolean NOT NULL DEFAULT true
);

CREATE TABLE tier_presets (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  builtin      boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tier_preset_tiers (
  preset_id  text NOT NULL REFERENCES tier_presets(id) ON DELETE CASCADE,
  code       text NOT NULL,
  position   int  NOT NULL,
  label      text NOT NULL,
  color      text NOT NULL,
  PRIMARY KEY (preset_id, code)
);

CREATE TABLE tier_preset_leaders (
  preset_id  text NOT NULL,
  tier_code  text NOT NULL,
  leader_id  text NOT NULL REFERENCES leaders(id),
  position   int  NOT NULL,
  PRIMARY KEY (preset_id, tier_code, leader_id),
  FOREIGN KEY (preset_id, tier_code) REFERENCES tier_preset_tiers(preset_id, code) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE format_templates (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  mode            text NOT NULL,
  tier_preset_id  text,
  format          jsonb NOT NULL,
  builtin         boolean NOT NULL DEFAULT false
);

CREATE TABLE tournaments (
  id             uuid PRIMARY KEY,
  share_slug     text NOT NULL UNIQUE,
  name           text NOT NULL,
  mode           text NOT NULL,
  phase          text NOT NULL,
  current_round  int  NOT NULL DEFAULT 0,
  current_stage  int,
  settings       jsonb NOT NULL,
  format         jsonb,
  metadata       jsonb NOT NULL,
  version        int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tournament_tiers (
  tournament_id  uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  code           text NOT NULL,
  position       int  NOT NULL,
  label          text NOT NULL,
  color          text NOT NULL,
  PRIMARY KEY (tournament_id, code)
);

CREATE TABLE tournament_tier_leaders (
  tournament_id  uuid NOT NULL,
  tier_code      text NOT NULL,
  leader_id      text NOT NULL REFERENCES leaders(id),
  position       int  NOT NULL,
  PRIMARY KEY (tournament_id, tier_code, leader_id),
  FOREIGN KEY (tournament_id, tier_code) REFERENCES tournament_tiers(tournament_id, code) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE players (
  tournament_id  uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  id             text NOT NULL,
  position       int  NOT NULL,
  name           text NOT NULL,
  points         numeric NOT NULL DEFAULT 0,
  total_vp       int  NOT NULL DEFAULT 0,
  wins           int  NOT NULL DEFAULT 0,
  efficiency     int  NOT NULL DEFAULT 0,
  group_id       int,
  opponents      text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (tournament_id, id)
);

CREATE TABLE stage_entrants (
  tournament_id  uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage_index    int  NOT NULL,
  seed           int  NOT NULL,
  player_id      text NOT NULL,
  PRIMARY KEY (tournament_id, stage_index, seed)
);

CREATE TABLE rounds (
  tournament_id      uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  number             int  NOT NULL,
  type               text NOT NULL,
  is_complete        boolean NOT NULL DEFAULT false,
  stage_index        int,
  round_in_stage     int,
  leader_tier        text,
  tier_codes         text[],
  available_leaders  text[],
  placement_points   numeric[],
  PRIMARY KEY (tournament_id, number)
);

CREATE TABLE round_tables (
  tournament_id  uuid NOT NULL,
  round_number   int  NOT NULL,
  table_id       int  NOT NULL,
  is_complete    boolean NOT NULL DEFAULT false,
  player_ids     text[] NOT NULL,
  PRIMARY KEY (tournament_id, round_number, table_id),
  FOREIGN KEY (tournament_id, round_number) REFERENCES rounds(tournament_id, number) ON DELETE CASCADE
);

CREATE TABLE table_results (
  tournament_id   uuid NOT NULL,
  round_number    int  NOT NULL,
  table_id        int  NOT NULL,
  player_id       text NOT NULL,
  position        int  NOT NULL,
  vp              int  NOT NULL,
  leader          text,
  seat_position   int,
  pick_order      int,
  minutes_used    numeric,
  penalty_points  numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (tournament_id, round_number, table_id, player_id),
  FOREIGN KEY (tournament_id, round_number, table_id)
    REFERENCES round_tables(tournament_id, round_number, table_id) ON DELETE CASCADE
);

CREATE TABLE tournament_events (
  id             bigserial PRIMARY KEY,
  tournament_id  uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  action_type    text NOT NULL,
  action         jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tournament_events_tournament_idx ON tournament_events (tournament_id, id);
CREATE INDEX table_results_player_idx ON table_results (tournament_id, player_id);
