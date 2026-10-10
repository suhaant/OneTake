-- Tables owned by the messaging server. Safe to run repeatedly.
-- The backend's tables (submissions, score_events) are only read from; see src/store/tiger.ts.

create table if not exists messaging_profiles (
  user_id        text primary key,
  name           text not null,
  phone          text unique,
  photon_user_id text,
  opt_in         text not null default 'none' check (opt_in in ('none', 'pending', 'active', 'stopped')),
  persona        text not null default 'mentor' check (persona in ('mentor', 'drill', 'hype')),
  tz             text not null default 'UTC',
  created_at     timestamptz not null default now()
);

create table if not exists friend_edges (
  user_id        text not null,
  friend_phone   text not null,
  friend_name    text not null,
  friend_user_id text,
  created_at     timestamptz not null default now(),
  primary key (user_id, friend_phone)
);
create index if not exists friend_edges_friend_user on friend_edges (friend_user_id);
create index if not exists friend_edges_friend_phone on friend_edges (friend_phone);

create table if not exists challenges (
  id           text primary key,
  from_user_id text not null,
  to_phone     text not null,
  to_name      text not null,
  prompt_id    text not null,
  score        integer,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists notification_log (
  user_id    text not null,
  kind       text not null,
  subject    text not null,
  day        date not null,
  body       text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, subject, day)
);

create table if not exists coach_messages (
  id         bigint generated always as identity primary key,
  user_id    text not null,
  role       text not null check (role in ('user', 'coach')),
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user on coach_messages (user_id, created_at desc);
