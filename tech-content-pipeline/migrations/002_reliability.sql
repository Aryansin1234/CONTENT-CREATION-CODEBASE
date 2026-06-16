-- Phase 1: Reliability tables

create table if not exists failed_posts (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null,
  caption     text,
  image_url   text,
  error       text not null,
  job_data    jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists source_health (
  id                uuid primary key default gen_random_uuid(),
  source_name       text not null unique,
  consecutive_fails int  not null default 0,
  last_success_at   timestamptz,
  last_fail_at      timestamptz,
  updated_at        timestamptz not null default now()
);

create table if not exists rejection_reasons (
  id          uuid primary key default gen_random_uuid(),
  url_hash    text not null,
  reason_code int  not null,  -- 1=off-brand 2=low-quality 3=already-covered 4=too-promotional
  reason_text text not null,
  created_at  timestamptz not null default now()
);

create table if not exists platform_rate_limits (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null unique,
  posts_today  int  not null default 0,
  window_start timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
