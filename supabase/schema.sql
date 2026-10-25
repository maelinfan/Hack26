-- Nearby: database schema (SPEC.md section 3).
-- Paste this whole file into Supabase > SQL Editor > Run. Safe to run more than once.

-- USERS: one row per person. tags is a JSON list like [{"tag":"ramen","category":"food","weight":0.6}].
create table if not exists users (
  id            text primary key,           -- short name like 'maya', not a number
  name          text not null,
  handle        text not null,
  age           int  not null check (age >= 18),   -- 18+ only
  gender        text not null,
  bio           text not null default '',
  interests_raw text not null default '',   -- what the user typed
  tags          jsonb not null default '[]',
  adjacent_tags text[] not null default '{}',
  verified      boolean not null default true,
  avatar_url    text not null default ''
);

-- FOLLOWS: a directed edge. "maya follows jordan" is one row; jordan following back is another.
create table if not exists follows (
  follower_id  text not null references users(id) on delete cascade,
  followee_id  text not null references users(id) on delete cascade,
  close_friend boolean not null default false,   -- follower has followee as a close friend
  primary key (follower_id, followee_id)         -- can't follow the same person twice
);

-- FILTERS: who each user is willing to meet. One row per user.
create table if not exists filters (
  user_id         text primary key references users(id) on delete cascade,
  age_min         int  not null default 18,
  age_max         int  not null default 65,
  genders         text[] not null default '{woman,man,nonbinary}',
  follow_statuses text[] not null default '{anyone}',  -- close_friends|mutual|following|follows_you|anyone
  radius_mi       float not null default 1
);

-- PRESENCE: where a user is (simulated pin) and whether "Meet nearby" is on.
create table if not exists presence (
  user_id         text primary key references users(id) on delete cascade,
  lat             float not null,
  lng             float not null,
  available_until timestamptz,
  active          boolean not null default false
);

-- PROPOSALS: one row = one match shown to BOTH users at once.
create table if not exists proposals (
  id             uuid primary key default gen_random_uuid(),
  user_a         text not null references users(id) on delete cascade,
  user_b         text not null references users(id) on delete cascade,
  state          text not null default 'pending'
                 check (state in ('pending','both_accepted','confirmed','declined','expired')),
  a_response     text check (a_response in ('accept','decline')),
  b_response     text check (b_response in ('accept','decline')),
  decline_reason text check (decline_reason in ('not_now','not_interested')),
  why_a          text,                -- explanation written for user_a
  why_b          text,                -- explanation written for user_b
  icebreakers    jsonb,               -- array of exactly 3 conversation starters
  score          float,
  venue          jsonb,
  plan_reason    text,
  tool_calls     jsonb,               -- the venue agent's tool calls, shown in the AI panel
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  check (user_a <> user_b)
);

-- Safety net for "a user is in at most ONE active proposal" (the code also checks this in
-- a transaction). These indexes stop the same user appearing twice on the same side;
-- the cross case (user in A of one and B of another) is handled in code.
create unique index if not exists one_active_as_a on proposals (user_a) where state in ('pending','both_accepted');
create unique index if not exists one_active_as_b on proposals (user_b) where state in ('pending','both_accepted');
-- Speeds up cooldown lookups ("any proposal for this pair recently?").
create index if not exists proposals_pair_idx on proposals (user_a, user_b, created_at desc);

-- AI_CACHE: key = hash of the prompt, value = the model's JSON answer (also hand-seeded fallbacks).
create table if not exists ai_cache (
  key   text primary key,
  value jsonb not null
);

-- Lock the tables so the public (anon) key can't read them. Our server uses the secret key,
-- which bypasses these rules, so the backend still works.
alter table users     enable row level security;
alter table follows   enable row level security;
alter table filters   enable row level security;
alter table presence  enable row level security;
alter table proposals enable row level security;
alter table ai_cache  enable row level security;
