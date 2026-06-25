-- Cartoon Studio tables
-- Derived from lib/cartoon/types.ts interfaces

-- ── cartoon_stories ───────────────────────────────────────────────────────────
create table if not exists cartoon_stories (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  series_id         uuid references cartoon_stories(id) on delete set null,
  episode_number    integer,
  title             text not null,
  prompt            text not null,
  storyline         text,
  genre             text not null check (genre in ('adventure','comedy','drama','horror','romance','sci_fi','fantasy','thriller','mystery')),
  visual_style      text not null check (visual_style in ('anime','cartoon','comic_book','watercolor','pixel_art','clay','cinematic','sketch')),
  voice_id          text not null default 'tara',
  caption_style     text not null default 'default',
  status            text not null default 'draft' check (status in ('draft','generating_images','images_ready','generating_video','completed','failed')),
  scene_count       integer not null default 0,
  video_url         text,
  thumbnail_url     text,
  duration_seconds  integer not null default 0,
  credits_used      integer not null default 0,
  youtube_video_id  text,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table cartoon_stories enable row level security;

create policy "Users manage own cartoon stories"
  on cartoon_stories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── cartoon_characters ────────────────────────────────────────────────────────
create table if not exists cartoon_characters (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  story_id              uuid references cartoon_stories(id) on delete cascade,
  series_id             uuid references cartoon_stories(id) on delete set null,
  name                  text not null,
  role                  text not null check (role in ('main','supporting','villain','narrator')),
  description           text not null,
  visual_prompt         text not null,
  personality           text,
  reference_image_url   text,
  created_at            timestamptz not null default now()
);

alter table cartoon_characters enable row level security;

create policy "Users manage own cartoon characters"
  on cartoon_characters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── cartoon_scenes ────────────────────────────────────────────────────────────
create table if not exists cartoon_scenes (
  id                    uuid primary key default gen_random_uuid(),
  story_id              uuid not null references cartoon_stories(id) on delete cascade,
  scene_number          integer not null,
  title                 text,
  narration             text not null,
  image_prompt          text not null,
  visual_description    text,
  visual_keywords       text[] not null default '{}',
  characters_in_scene   text[] not null default '{}',
  visual_style          text check (visual_style in ('anime','cartoon','comic_book','watercolor','pixel_art','clay','cinematic','sketch')),
  motion_effect         text not null default 'ken_burns' check (motion_effect in ('zoom_in','zoom_out','pan_left','pan_right','ken_burns','static')),
  duration_seconds      integer not null default 5,
  image_url             text,
  image_status          text not null default 'pending' check (image_status in ('pending','generating','completed','failed')),
  generation_attempts   integer not null default 0,
  created_at            timestamptz not null default now(),
  unique (story_id, scene_number)
);

alter table cartoon_scenes enable row level security;

create policy "Users manage scenes of own stories"
  on cartoon_scenes for all
  using (
    exists (
      select 1 from cartoon_stories
      where cartoon_stories.id = cartoon_scenes.story_id
        and cartoon_stories.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from cartoon_stories
      where cartoon_stories.id = cartoon_scenes.story_id
        and cartoon_stories.user_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists cartoon_stories_user_id_idx      on cartoon_stories(user_id);
create index if not exists cartoon_stories_status_idx       on cartoon_stories(status);
create index if not exists cartoon_characters_story_id_idx  on cartoon_characters(story_id);
create index if not exists cartoon_scenes_story_id_idx      on cartoon_scenes(story_id);
create index if not exists cartoon_scenes_image_status_idx  on cartoon_scenes(image_status);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cartoon_stories_updated_at
  before update on cartoon_stories
  for each row execute function set_updated_at();
