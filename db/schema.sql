-- Bijoux v1 schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS cinemas (
  id    text PRIMARY KEY,
  name  text NOT NULL,
  lat   double precision NOT NULL,
  lng   double precision NOT NULL,
  url   text NOT NULL
);

CREATE TABLE IF NOT EXISTS films (
  id              bigserial PRIMARY KEY,
  tmdb_id         integer UNIQUE,
  title           text NOT NULL,
  original_title  text,
  director        text,
  year            integer,
  runtime         integer,
  poster          text,
  trailer         text,
  letterboxd_slug text,
  tags            text[] NOT NULL DEFAULT '{}',
  -- for unmatched films: normalised printed title, so the same title reuses one row
  title_key       text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screenings (
  film_id    bigint NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  cinema_id  text   NOT NULL REFERENCES cinemas(id),
  starts_at  timestamptz NOT NULL,
  vo         boolean NOT NULL DEFAULT false,
  special    boolean NOT NULL DEFAULT false,
  url        text,
  raw_title  text NOT NULL,
  seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cinema_id, starts_at, film_id)
);
CREATE INDEX IF NOT EXISTS screenings_starts_at ON screenings (starts_at);
CREATE INDEX IF NOT EXISTS screenings_film ON screenings (film_id);

-- printed title → TMDB id, so each title is resolved once
CREATE TABLE IF NOT EXISTS title_matches (
  title_key   text PRIMARY KEY,
  tmdb_id     integer,
  method      text NOT NULL,          -- tmdb | llm | none
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- App users. Identity lives in neon_auth (Managed Better Auth); this row holds preferences.
CREATE TABLE IF NOT EXISTS users (
  id                  text PRIMARY KEY,   -- neon_auth user id
  email               text NOT NULL,
  letterboxd_username text,
  lat                 double precision,
  lng                 double precision,
  radius_km           double precision NOT NULL DEFAULT 5,
  letterboxd_synced_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_films (
  user_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tmdb_id  integer NOT NULL,
  kind     text NOT NULL CHECK (kind IN ('watchlist', 'seen', 'favorite')),
  stars    numeric(2,1),
  PRIMARY KEY (user_id, tmdb_id, kind)
);

CREATE TABLE IF NOT EXISTS notifications (
  user_id  text   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id  bigint NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  rule     text   NOT NULL CHECK (rule IN ('watchlist_last', 'loved_special', 'rare_event')),
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, film_id, rule)
);
CREATE INDEX IF NOT EXISTS notifications_user_day ON notifications (user_id, sent_at);

CREATE TABLE IF NOT EXISTS runs (
  id          bigserial PRIMARY KEY,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok          boolean NOT NULL DEFAULT false,
  per_cinema  jsonb NOT NULL DEFAULT '{}',
  error       text
);

-- one admin alert per staleness episode, never one per day
CREATE TABLE IF NOT EXISTS alerts (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,
  since_run   bigint,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, since_run)
);

-- Letterboxd entries as read (public profile or CSV), resolved daily against films in cinemas
CREATE TABLE IF NOT EXISTS lb_entries (
  user_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind     text NOT NULL CHECK (kind IN ('watchlist', 'seen', 'favorite')),
  name     text NOT NULL,
  year     integer NOT NULL DEFAULT 0,
  slug     text,
  stars    numeric(2,1),
  PRIMARY KEY (user_id, kind, name, year)
);

-- Letterboxd slug → TMDB id, read from the film page once
CREATE TABLE IF NOT EXISTS lb_slugs (
  slug     text PRIMARY KEY,
  tmdb_id  integer
);

ALTER TABLE films ADD COLUMN IF NOT EXISTS accent text;

-- v2: more cities
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'milano';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'milano';
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'milano';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT 'milano';
CREATE INDEX IF NOT EXISTS runs_city_ok ON runs (city, ok, finished_at);
