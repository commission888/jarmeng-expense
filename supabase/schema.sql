-- Jarmeng Expense — Supabase schema
-- Run in the Supabase SQL editor, or: supabase db push

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Phase 1: users, transactions, keyword mapping
-- ─────────────────────────────────────────────────────────────

create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  line_user_id  text unique not null,
  display_name  text,
  created_at    timestamptz not null default now()
);

create type transaction_direction as enum ('income', 'expense');
create type transaction_source    as enum ('line_chat', 'gmail', 'manual');

create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  direction    transaction_direction not null,
  amount       numeric(12, 2) not null check (amount > 0),
  category     text not null,
  description  text,
  source       transaction_source not null default 'line_chat',
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Dashboard reads are always "this user, this period, newest first".
create index if not exists transactions_user_occurred_idx
  on public.transactions (user_id, occurred_at desc);

-- The cost-saving table: a hit here means we skip the AI call entirely.
create table if not exists public.keywords (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  keyword     text not null,
  category    text not null,
  direction   transaction_direction not null,
  hit_count   integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

create index if not exists keywords_user_keyword_idx
  on public.keywords (user_id, keyword);

-- Bumping the counter in SQL keeps it a single round trip and avoids the
-- read-modify-write race two concurrent messages would create.
create or replace function public.touch_keyword(p_user_id uuid, p_keyword text)
returns void
language sql
as $$
  update public.keywords
     set hit_count = hit_count + 1,
         updated_at = now()
   where user_id = p_user_id
     and keyword = p_keyword;
$$;

-- ─────────────────────────────────────────────────────────────
-- Phase 2: Gmail sync
-- ─────────────────────────────────────────────────────────────

create table if not exists public.gmail_accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  email                  text not null,
  refresh_token          text not null,
  history_id             text,
  last_synced_at         timestamptz,
  created_at             timestamptz not null default now(),
  unique (user_id, email)
);

-- Gmail delivers the same message more than once; this is the dedupe guard.
create table if not exists public.processed_emails (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  gmail_message_id  text not null,
  transaction_id    uuid references public.transactions(id) on delete set null,
  processed_at      timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

-- ─────────────────────────────────────────────────────────────
-- RLS: every table is closed. All access goes through the server
-- with the service-role key, after the caller's LINE identity is verified.
-- ─────────────────────────────────────────────────────────────

alter table public.users            enable row level security;
alter table public.transactions     enable row level security;
alter table public.keywords         enable row level security;
alter table public.gmail_accounts   enable row level security;
alter table public.processed_emails enable row level security;
