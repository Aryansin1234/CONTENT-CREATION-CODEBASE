-- Run this in your Supabase SQL editor to create the required tables

create extension if not exists "pgcrypto";

create table if not exists processed_articles (
  id           uuid primary key default gen_random_uuid(),
  url_hash     text not null unique,
  title        text not null,
  source       text not null,
  published_at timestamptz,
  content_type text,
  created_at   timestamptz not null default now()
);

create index if not exists processed_articles_url_hash_idx on processed_articles (url_hash);

create table if not exists post_results (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid references processed_articles(id) on delete cascade,
  platform    text not null,
  post_id     text not null,
  url         text not null,
  posted_at   timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists post_results_article_id_idx on post_results (article_id);
