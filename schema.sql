-- Run this in your Neon project's SQL Editor
-- (Neon dashboard -> your project -> SQL Editor -> New query).
--
-- Safe to run again even if you already ran an earlier version of this
-- file -- the CREATE TABLE lines are skipped if the tables already exist,
-- and the ALTER TABLE line below only adds the new "participants" column
-- if it isn't already there.

create table if not exists polls (
  code text primary key,
  title text not null,
  notes text not null default '',
  slots jsonb not null,
  participants jsonb not null default '[]'::jsonb,
  closed boolean not null default false,
  manage_passcode text not null,
  created_at timestamptz not null default now()
);

-- Adds the participants column for anyone who ran an earlier version of
-- this schema before the pre-set name list feature existed.
alter table polls add column if not exists participants jsonb not null default '[]'::jsonb;

create table if not exists groups (
  id bigserial primary key,
  name text not null,
  members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists responses (
  id bigserial primary key,
  poll_code text not null references polls(code) on delete cascade,
  name text not null,
  slug text not null,
  choices jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (poll_code, slug)
);

-- No row-level security setup needed here: the app only ever connects
-- using your DATABASE_URL connection string, which lives in server-side
-- environment variables and is never exposed to the browser. There's no
-- separate public/anon key like some hosted-Postgres platforms have, so
-- access is already limited to your own server code by construction.
