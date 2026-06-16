-- Phase 2: Analytics and caption variants

create table if not exists post_analytics (
  id               uuid primary key default gen_random_uuid(),
  post_result_id   uuid references post_results(id) on delete cascade,
  platform         text not null,
  likes            int  not null default 0,
  comments         int  not null default 0,
  shares           int  not null default 0,
  reach            int  not null default 0,
  clicks           int  not null default 0,
  fetched_at       timestamptz not null default now()
);

create table if not exists caption_variants (
  id             uuid primary key default gen_random_uuid(),
  url_hash       text not null,
  platform       text not null,
  variant_index  int  not null,  -- 0 = A, 1 = B
  chosen         boolean not null default false,
  created_at     timestamptz not null default now()
);
