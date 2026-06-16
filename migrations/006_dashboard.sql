-- Phase 5: Dashboard pending reviews

create table if not exists pending_reviews (
  id              uuid primary key default gen_random_uuid(),
  url_hash        text not null unique,
  article         jsonb not null,
  captions        jsonb not null,
  image_url       text,
  carousel_url    text,
  quote_card_url  text,
  video_script    text,
  status          text not null default 'pending',  -- pending | approved | rejected
  schedule_delay  int  not null default 0,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);
