-- Phase 4: Reporting

create table if not exists competitor_articles (
  id           uuid primary key default gen_random_uuid(),
  competitor   text not null,
  url          text not null unique,
  title        text not null,
  published_at timestamptz,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);

create table if not exists competitor_clusters (
  id           uuid primary key default gen_random_uuid(),
  topic        text not null,
  article_ids  uuid[] not null,
  reported_at  timestamptz not null default now()
);
