-- Phase 7: Multi-account tracking

create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  linkedin     jsonb,
  twitter      jsonb,
  instagram    jsonb,
  tone_profile text,
  created_at   timestamptz not null default now()
);
