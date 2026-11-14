-- Nudge Me schema. Paste into the Neon SQL Editor and run once.

create table if not exists users (
  id          uuid primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists credentials (
  id          text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  public_key  text not null,
  counter     bigint not null default 0,
  transports  text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists nudges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  text          text not null,
  due_at        timestamptz not null,
  status        text not null default 'pending'
                check (status in ('pending', 'firing', 'done', 'cancelled')),
  seq           integer not null default 0,
  next_fire_at  timestamptz,
  queued        boolean not null default false,
  fire_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);

create index if not exists nudges_user_status on nudges (user_id, status);
create index if not exists nudges_sweep on nudges (status, queued, next_fire_at);
create index if not exists credentials_user on credentials (user_id);
create index if not exists push_subscriptions_user on push_subscriptions (user_id);
