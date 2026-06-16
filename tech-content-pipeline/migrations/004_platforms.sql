-- Phase 3: Extra platforms

create table if not exists threads_posts (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid references processed_articles(id) on delete cascade,
  post_id     text not null,
  url         text not null,
  posted_at   timestamptz not null,
  created_at  timestamptz not null default now()
);
