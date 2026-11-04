-- 0010: account auth with @username + password. No email, no recovery.
-- Usernames are unique case-insensitively and permanent.
create table if not exists accounts (
  user_id text primary key,
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create unique index if not exists accounts_username_unique
  on accounts (lower(username));

alter table accounts enable row level security;

alter table profiles add column if not exists username text;

create unique index if not exists profiles_username_unique
  on profiles (lower(username)) where username is not null;
