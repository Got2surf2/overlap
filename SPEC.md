# Overlap — Project Spec

A scheduling-poll tool (Doodle-style): propose some dates, share one link,
see who's free when. Built as a real Next.js + Postgres app rather than a
Claude artifact, specifically to get true one-click shareable links and
server-enforced passcodes — both of which a client-only artifact couldn't
provide.

Repo location (local): `/Users/sanjaypatel/Developer/GitHub/overlap`

## Stack

- **Frontend + API**: Next.js 14 (Pages Router), plain React, no CSS
  framework — hand-rolled `styles/globals.css` with CSS custom properties
- **Database**: Neon (serverless Postgres, free tier), accessed via
  `@neondatabase/serverless`
- **Hosting**: Vercel (free/Hobby tier), connected to a GitHub repo for
  auto-deploy on push
- No auth system / user accounts anywhere in the app — access control is
  entirely via shared passcodes (see Security model below)

## Core concepts

- **Poll**: a proposed set of dates/times for something, identified by a
  short 6-character code (e.g. `K3P9QZ`). Has a title, optional notes, a
  list of time slots, an optional pre-set participant list, an open/closed
  state, and a manage passcode.
- **Response**: one person's availability against a poll's slots. Keyed by
  a slug of their name, scoped to one poll. Submitting again with the same
  name updates the existing response (upsert) rather than creating a
  duplicate.
- **Group**: a reusable, named list of people (e.g. "Family", "Poker
  night") that can be loaded into a new poll's participant list instead of
  typing names each time. Independent of any specific poll.

## Data model (`schema.sql`)

```sql
polls
  code            text primary key       -- 6-char shareable code
  title           text not null
  notes           text default ''
  slots           jsonb not null         -- [{id, date, time, label}]
  participants    jsonb default '[]'     -- ["Name", "Name", ...] — optional
  closed          boolean default false
  manage_passcode text not null          -- set by creator, per-poll
  created_at      timestamptz default now()

responses
  id              bigserial primary key
  poll_code       text references polls(code) on delete cascade
  name            text not null
  slug            text not null          -- slugified name, used for upsert key
  choices         jsonb not null         -- {slotId: "yes"|"maybe"|"no"}
  submitted_at    timestamptz default now()
  unique (poll_code, slug)

groups
  id              bigserial primary key
  name            text not null
  members         jsonb default '[]'     -- ["Name", "Name", ...]
  created_at      timestamptz default now()
```

No row-level security policies — access is controlled entirely at the
application layer (API routes), since the Postgres connection string
(`DATABASE_URL`) lives only in server-side environment variables and is
never exposed to the browser.

## Security model

Two distinct passcodes, both plain strings compared server-side (not
hashed — acceptable for this tool's threat model, a small private group,
not a public product):

1. **`CREATE_PASSCODE`** (env var, one shared value for the whole app) —
   required to create a new poll (`POST /api/polls`) and to access groups
   at all (`/groups` page and all `/api/groups*` routes). Checked via a
   custom `x-create-passcode` request header on group endpoints, and via
   request body on poll creation.
2. **Manage passcode** (per-poll, set by the creator at poll-creation
   time, stored in `polls.manage_passcode`) — required to edit or delete
   an existing poll (`PATCH`/`DELETE /api/polls/[code]`). Not tied to a
   device or account, so the creator (or anyone they share it with) can
   manage the poll from anywhere.

Responding to a poll (`POST /api/polls/[code]/respond`) requires **no
passcode at all** — this was an explicit requirement. Anyone with the poll
link can add or update their own availability.

All passcode checks happen inside API routes (server-side), not in
client-side JavaScript — this was a deliberate fix after an earlier
Claude-artifact version of this tool could only do client-side checks,
which are visible to anyone inspecting the code.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing page — "start a new poll" CTA, plus a manual code-entry fallback |
| `/create` | Passcode-gated poll creation form |
| `/poll/[code]` | The poll itself — real server-rendered dynamic route (this is what makes shareable links work: `/poll/ABC123` is an actual page, not a query string) |
| `/groups` | Passcode-gated group management (CRUD) |

| API route | Method(s) | Purpose |
|---|---|---|
| `/api/polls` | `POST` | Create a poll (passcode required) |
| `/api/polls/[code]` | `GET` | Fetch a poll + its responses (no passcode) |
| `/api/polls/[code]` | `PATCH` | Update title/notes/slots/participants/closed (manage passcode required) |
| `/api/polls/[code]` | `DELETE` | Delete a poll and its responses (manage passcode required) |
| `/api/polls/[code]/respond` | `POST` | Submit/update a response (no passcode) |
| `/api/groups` | `GET` | List all groups (create passcode required, via header) |
| `/api/groups` | `POST` | Create a group (create passcode required) |
| `/api/groups/[id]` | `PATCH` | Rename a group and/or replace its member list (create passcode required) |
| `/api/groups/[id]` | `DELETE` | Delete a group (create passcode required) |

## Features implemented

**Poll creation** (`/create`)
- Title + optional notes
- A single "time" field applied to every date in the poll (not per-slot)
- Add dates manually (date picker, one at a time)
- Generate a recurring set of dates: start date + frequency (daily /
  weekly / every 2 weeks / monthly) + count — manual and generated dates
  can be mixed in the same poll
- Optional participant list ("Who's invited?") — add names as chips; if
  left empty, responders can type any name freely
- "Load from a group" dropdown (populated once passcode is entered) —
  selecting a saved group replaces the participant list with that group's
  members, which can still be edited afterward
- Manage passcode field (per-poll, set once at creation)

**Responding** (`/poll/[code]`)
- If the poll has a participant list: a dropdown of names, with a
  "Someone else…" option that reveals a free-text field as fallback
- If no participant list: plain free-text name field
- Tap-to-cycle availability per slot: unset → Yes → If need be → No
- Submitting again with the same name updates the existing response

**Poll management** (unlocked via manage passcode, inside `/poll/[code]`)
- Edit title and notes
- Add/remove time slots
- Add/remove participants
- Toggle the poll open/closed (closed = no new/changed responses accepted)
- Delete the poll (with a confirm step)

**Results** (`/poll/[code]`, visible to anyone)
- Per-slot tally (yes count, maybe count)
- Best-scoring slot(s) highlighted (yes counts full, maybe counts half)
- List of who's responded so far

**Groups** (`/groups`)
- Full CRUD: create a group with a name + initial members, rename it, add/
  remove members, delete it
- Shared across all poll creation — not tied to a specific poll

## Deliberate design decisions (context for why, not just what)

- **Real dynamic routes, not query strings.** An earlier version of this
  tool was a Claude artifact using `?poll=CODE` in the URL. That approach
  silently failed — the hosting layer didn't preserve the query string, so
  links landed on the app's home screen instead of the poll. Moving to a
  real Next.js app with `/poll/[code]` as an actual route fixed this
  completely. Don't reintroduce query-string-based routing for anything
  that needs to be a shareable, click-once link.
- **No accounts, ever, for responders.** Explicit requirement — the person
  filling out a poll should only ever need to provide a name and click
  slots. No sign-up, no login, no passcode.
- **Manage passcode is per-poll and device-independent**, not tied to
  "whoever created it on this browser." An earlier artifact version tried
  detecting the creator via a browser-local storage key, which broke as
  soon as the creator switched devices. The current approach (a passcode
  chosen at creation, checked server-side) works from anywhere.
- **Groups are passcode-gated the same way poll creation is** — they're
  effectively creator-only data (reusable name lists), not public poll
  data, so they sit behind `CREATE_PASSCODE` rather than being open like
  poll responses are.
- **Upsert on response, not append.** Submitting a response twice under
  the same name (case-insensitive, slugified) overwrites rather than
  duplicates — this matters for people who want to change their answer
  after the fact.

## Known gaps / things not yet built

These came up as ideas or edge cases during development but weren't
requested as firm requirements — flagging them as candidates for future
work, not as bugs:

- Passcodes are plain-text string comparisons, not hashed. Fine for the
  current low-stakes/small-group threat model; would need hashing
  (bcrypt/argon2) if this ever handled anything more sensitive.
- No rate limiting on any endpoint (poll creation, responses, or group
  passcode attempts).
- No email/SMS notifications when someone responds, when a poll is about
  to close, etc. — sharing is entirely manual (copy/paste the link).
- No timezone handling — slot times are stored as entered and displayed
  as-is; there's no per-viewer timezone conversion.
- No way to see historical/past polls in one place (no "my polls" list) —
  you need to already have the code/link for any given poll.
- No pagination anywhere — fine at small scale (a handful of polls,
  dozens of responses), would need attention if usage grew significantly.
- No tests (unit, integration, or e2e) exist yet.

## Environment variables

```
DATABASE_URL       # Neon pooled connection string
CREATE_PASSCODE     # shared passcode required to create polls / manage groups
```

Set locally in `.env.local` (see `.env.example`), and in Vercel under
Project → Settings → Environment Variables for production.

## Deploy

See `README.md` in the repo for the full step-by-step (Neon project setup,
running `schema.sql`, connecting to Vercel). Current live setup uses the
Neon-Vercel marketplace integration, which auto-populates `DATABASE_URL`
on connect — `CREATE_PASSCODE` still needs to be added manually in
Vercel's environment variables.
