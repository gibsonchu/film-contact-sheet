-- Film Contact Sheet — initial schema.
--
-- Mirrors src/lib/types.ts one-to-one. JSON is used only where the shape is
-- genuinely open-ended (template settings, annotation geometry, crop, EXIF,
-- export settings); everything queryable is a real column.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------- contact sheets
create type public.sharing_mode as enum ('private', 'link-view', 'link-comment', 'password');

create table if not exists public.contact_sheets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  title             text not null default 'Untitled Roll',
  subtitle          text not null default '',
  description       text not null default '',
  roll_number       text not null default '',
  date_shot         text not null default '',
  photographer      text not null default '',
  location          text not null default '',
  camera            text not null default '',
  film_stock        text not null default '',
  template_id       text not null default 'classic-35mm',
  template_settings jsonb not null default '{}'::jsonb,
  postcard          jsonb not null default '{}'::jsonb,
  sharing_mode      public.sharing_mode not null default 'private',
  comments_enabled  boolean not null default false,
  downloads_enabled boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  deleted_at        timestamptz
);

create index if not exists contact_sheets_user_idx on public.contact_sheets (user_id, updated_at desc);
create index if not exists contact_sheets_live_idx on public.contact_sheets (user_id) where deleted_at is null;

-- -------------------------------------------------------------------- photos
create type public.review_status as enum ('unreviewed', 'favorite', 'selected', 'maybe', 'rejected');

create table if not exists public.photos (
  id                uuid primary key default gen_random_uuid(),
  contact_sheet_id  uuid not null references public.contact_sheets (id) on delete cascade,
  storage_path      text not null,
  thumb_path        text not null default '',
  original_filename text not null default '',
  mime_type         text not null default 'image/jpeg',
  width             integer not null default 0,
  height            integer not null default 0,
  file_size         bigint not null default 0,
  position          integer not null default 0,
  frame_number      integer not null default 0,
  title             text not null default '',
  caption           text not null default '',
  private_note      text not null default '',
  public_note       text not null default '',
  status            public.review_status not null default 'unreviewed',
  rotation          smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  fit               text not null default 'fit' check (fit in ('fit', 'fill', 'original')),
  crop_data         jsonb,
  exif_data         jsonb,
  hidden            boolean not null default false,
  blank             boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (contact_sheet_id, position) deferrable initially deferred
);

create index if not exists photos_sheet_idx on public.photos (contact_sheet_id, position);

-- --------------------------------------------------------------- annotations
create table if not exists public.annotations (
  id               uuid primary key default gen_random_uuid(),
  contact_sheet_id uuid not null references public.contact_sheets (id) on delete cascade,
  photo_id         uuid references public.photos (id) on delete cascade,
  anchor           jsonb,
  type             text not null,
  tool             text not null,
  color            text not null default '#d81f26',
  stroke_width     real not null default 4,
  opacity          real not null default 1 check (opacity between 0 and 1),
  geometry         jsonb not null,
  text             text,
  tape_kind        text,
  z_index          integer not null default 0,
  locked           boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists annotations_sheet_idx on public.annotations (contact_sheet_id, z_index);

-- ------------------------------------------------------------------ comments
create table if not exists public.comments (
  id               uuid primary key default gen_random_uuid(),
  contact_sheet_id uuid not null references public.contact_sheets (id) on delete cascade,
  photo_id         uuid references public.photos (id) on delete cascade,
  author_name      text not null default 'Anonymous',
  author_email     text,
  body             text not null,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index if not exists comments_sheet_idx on public.comments (contact_sheet_id, created_at);

-- --------------------------------------------------------------- share links
create table if not exists public.share_links (
  id               uuid primary key default gen_random_uuid(),
  contact_sheet_id uuid not null references public.contact_sheets (id) on delete cascade,
  token            text not null unique,
  password_hash    text,
  permission       text not null default 'view' check (permission in ('view', 'comment')),
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists share_links_token_idx on public.share_links (token);

-- ------------------------------------------------------------------- exports
create table if not exists public.exports (
  id               uuid primary key default gen_random_uuid(),
  contact_sheet_id uuid not null references public.contact_sheets (id) on delete cascade,
  type             text not null,
  settings         jsonb not null default '{}'::jsonb,
  storage_path     text,
  status           text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------- updated_at hooks
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'contact_sheets', 'photos', 'annotations'] loop
    execute format(
      'drop trigger if exists %I_touch on public.%I; create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;

-- ------------------------------------------------------------------ security
alter table public.profiles       enable row level security;
alter table public.contact_sheets enable row level security;
alter table public.photos         enable row level security;
alter table public.annotations    enable row level security;
alter table public.comments       enable row level security;
alter table public.share_links    enable row level security;
alter table public.exports        enable row level security;

create policy "profiles are self-service"
  on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "owners manage their sheets"
  on public.contact_sheets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Child rows follow their sheet's ownership. Anonymous read access for shared
-- sheets is served through security-definer RPCs (0002), never by relaxing
-- these policies — that is what keeps private notes private.
create policy "owners manage sheet photos"
  on public.photos for all
  using (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()));

create policy "owners manage sheet annotations"
  on public.annotations for all
  using (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()));

create policy "owners read sheet comments"
  on public.comments for select
  using (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()));

create policy "owners manage share links"
  on public.share_links for all
  using (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()));

create policy "owners manage exports"
  on public.exports for all
  using (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.user_id = auth.uid()));
