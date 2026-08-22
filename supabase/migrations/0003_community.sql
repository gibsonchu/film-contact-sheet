-- Community: publishing, remixing/markup, binders, likes, bookmarks, and the
-- entitlement field. Additive only — 0001_init.sql and 0002_sharing.sql are
-- never edited once shipped.

-- ---------------------------------------------------- backfill: app drift
-- pick_mark, auto_advance and orientation were added to ContactSheet, and
-- font to Annotation, after 0001 shipped. Catching the schema up to the
-- current app types before layering community features on top of it.
alter table public.contact_sheets
  add column if not exists pick_mark    text not null default 'circle' check (pick_mark in ('circle', 'check', 'star', 'dot')),
  add column if not exists auto_advance boolean not null default false,
  add column if not exists orientation  text not null default 'landscape' check (orientation in ('landscape', 'portrait'));

alter table public.annotations
  add column if not exists font text;

-- --------------------------------------------------------------- profiles
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists plan       text not null default 'free' check (plan in ('free', 'plus', 'pro'));

-- A profile row is created automatically alongside the auth user — nothing
-- in the app has to remember to do it, including future OAuth sign-ins.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------- contact sheets
alter table public.contact_sheets
  add column if not exists visibility     text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  add column if not exists remixed_from   uuid references public.contact_sheets (id) on delete set null,
  add column if not exists published_at   timestamptz,
  -- Which of title/photographer/description/filmStock/camera/dateShot/
  -- location/annotations/notes are public, e.g. {"title": true, ...}. Same
  -- shape the Publish modal's checkboxes write directly.
  add column if not exists public_fields  jsonb not null default '{}'::jsonb;

create index if not exists contact_sheets_public_idx
  on public.contact_sheets (published_at desc)
  where visibility = 'public' and deleted_at is null;

-- ------------------------------------------------------------- share links
alter table public.share_links
  add column if not exists allow_markup   boolean not null default false,
  add column if not exists allow_download boolean not null default true,
  add column if not exists disabled       boolean not null default false;

-- ------------------------------------------------------------------ binders
-- source_sheet_id set = the auto-created markup collection for that sheet;
-- null = a manually-created folder. visibility exists now (default private,
-- no UI sets it yet) so a future "publish a binder" toggle needs no schema
-- change, only a UI control and the matching update statement.
create table if not exists public.binders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  title            text not null default 'Untitled Binder',
  source_sheet_id  uuid references public.contact_sheets (id) on delete cascade,
  visibility       text not null default 'private' check (visibility in ('private', 'public')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (source_sheet_id)
);

create index if not exists binders_user_idx on public.binders (user_id, updated_at desc);

create table if not exists public.binder_sheets (
  binder_id        uuid not null references public.binders (id) on delete cascade,
  contact_sheet_id uuid not null references public.contact_sheets (id) on delete cascade,
  added_at         timestamptz not null default now(),
  primary key (binder_id, contact_sheet_id)
);

-- Who besides the binder's owner can see it — the remixer, for a markup
-- binder. Kept as its own table (rather than folded into binder_sheets) so
-- "can view this binder" and "is a sheet in this binder" stay independent
-- questions — a future collaborator could see a binder without every sheet
-- in it being theirs.
create table if not exists public.binder_members (
  binder_id uuid not null references public.binders (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (binder_id, user_id)
);

do $$
begin
  drop trigger if exists binders_touch on public.binders;
  create trigger binders_touch before update on public.binders
    for each row execute function public.touch_updated_at();
end $$;

-- ------------------------------------------------------------- likes/saves
create table if not exists public.likes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  contact_sheet_id uuid not null references public.contact_sheets (id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (user_id, contact_sheet_id)
);

create table if not exists public.bookmarks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  contact_sheet_id uuid not null references public.contact_sheets (id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (user_id, contact_sheet_id)
);

create index if not exists likes_sheet_idx on public.likes (contact_sheet_id);
create index if not exists bookmarks_sheet_idx on public.bookmarks (contact_sheet_id);
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);

-- ------------------------------------------------------------------ security
alter table public.binders        enable row level security;
alter table public.binder_sheets  enable row level security;
alter table public.binder_members enable row level security;
alter table public.likes          enable row level security;
alter table public.bookmarks      enable row level security;

-- Public read: anyone can read a sheet (and its photos/annotations) once its
-- owner has published it. This is additive to the existing owner-only
-- policies from 0001 — Postgres RLS is a union of every matching policy, so
-- owners keep full access and everyone else gets read-only access to public
-- rows only.
create policy "public sheets are readable"
  on public.contact_sheets for select to anon, authenticated
  using (visibility = 'public' and deleted_at is null);

create policy "photos of public sheets are readable"
  on public.photos for select to anon, authenticated
  using (exists (
    select 1 from public.contact_sheets s
     where s.id = contact_sheet_id and s.visibility = 'public' and s.deleted_at is null
  ));

create policy "annotations of public sheets are readable"
  on public.annotations for select to anon, authenticated
  using (exists (
    select 1 from public.contact_sheets s
     where s.id = contact_sheet_id and s.visibility = 'public' and s.deleted_at is null
  ));

-- A remix is owned by the remixer — 0001's owner policy already covers
-- read/write for them. The original creator gets read-only visibility into
-- remixes of their own sheet (never write — only the remixer can publish or
-- edit their copy).
create policy "creators can read remixes of their sheets"
  on public.contact_sheets for select to authenticated
  using (exists (
    select 1 from public.contact_sheets orig
     where orig.id = remixed_from and orig.user_id = auth.uid()
  ));

-- Binders: owners manage theirs (0001-style pattern); members (the remixer
-- of a markup binder) get read access; a public binder is readable by
-- anyone, mirroring public sheets, ready for the day a "publish this binder"
-- toggle exists.
create policy "owners manage their binders"
  on public.binders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "members can read binders they're part of"
  on public.binders for select to authenticated
  using (exists (select 1 from public.binder_members m where m.binder_id = id and m.user_id = auth.uid()));

create policy "public binders are readable"
  on public.binders for select to anon, authenticated
  using (visibility = 'public');

create policy "owners manage their binder contents"
  on public.binder_sheets for all
  using (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = auth.uid()));

create policy "members can read binder contents"
  on public.binder_sheets for select to authenticated
  using (exists (select 1 from public.binder_members m where m.binder_id = binder_id and m.user_id = auth.uid()));

create policy "owners manage their binder membership"
  on public.binder_members for all
  using (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.binders b where b.id = binder_id and b.user_id = auth.uid()));

create policy "members can see their own membership"
  on public.binder_members for select to authenticated
  using (user_id = auth.uid());

-- Likes/bookmarks: everyone manages only their own row. Reading who liked a
-- public sheet isn't sensitive (it's a count, not a DM), so read access
-- follows the sheet's own visibility rather than being owner-only; a
-- private sheet's likes stay invisible to everyone but the liker.
create policy "users manage their own likes"
  on public.likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "likes on public sheets are readable"
  on public.likes for select to anon, authenticated
  using (exists (
    select 1 from public.contact_sheets s where s.id = contact_sheet_id and s.visibility = 'public'
  ));

create policy "users manage their own bookmarks"
  on public.bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------------ remix
-- Turns a valid, markup-enabled share link into a brand-new sheet the caller
-- owns: validates the link exactly like get_shared_sheet, copies photos and
-- annotations, and files the copy into the source sheet's markup binder
-- (creating it on first remix) with both parties as members. One
-- security-definer call keeps this atomic instead of racy multi-step client
-- code juggling RLS from the browser.
create or replace function public.create_remix(share_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  link      public.share_links;
  source    public.contact_sheets;
  new_id    uuid;
  binder    public.binders;
  caller    uuid := auth.uid();
begin
  if caller is null then
    return jsonb_build_object('error', 'sign_in_required');
  end if;

  select * into link from public.share_links where token = share_token;
  if link is null or link.disabled or not link.allow_markup then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if link.expires_at is not null and link.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  select * into source from public.contact_sheets
   where id = link.contact_sheet_id and deleted_at is null;
  if source is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  insert into public.contact_sheets (
    user_id, title, subtitle, description, roll_number, date_shot, photographer,
    location, camera, film_stock, template_id, template_settings, postcard,
    pick_mark, auto_advance, orientation, remixed_from
  )
  select caller, title, subtitle, description, roll_number, date_shot, photographer,
         location, camera, film_stock, template_id, template_settings, postcard,
         pick_mark, auto_advance, orientation, source.id
    from public.contact_sheets where id = source.id
  returning id into new_id;

  insert into public.photos (
    contact_sheet_id, storage_path, thumb_path, original_filename, mime_type,
    width, height, file_size, position, frame_number, title, caption,
    public_note, status, rotation, fit, crop_data, exif_data, hidden, blank
  )
  select new_id, storage_path, thumb_path, original_filename, mime_type,
         width, height, file_size, position, frame_number, title, caption,
         public_note, status, rotation, fit, crop_data, exif_data, hidden, blank
    from public.photos where contact_sheet_id = source.id;

  insert into public.annotations (
    contact_sheet_id, photo_id, anchor, type, tool, color, stroke_width,
    opacity, geometry, text, tape_kind, font, z_index, locked
  )
  select new_id, photo_id, anchor, type, tool, color, stroke_width,
         opacity, geometry, text, tape_kind, font, z_index, locked
    from public.annotations where contact_sheet_id = source.id;

  select * into binder from public.binders where source_sheet_id = source.id;
  if binder is null then
    insert into public.binders (user_id, title, source_sheet_id)
    values (source.user_id, source.title, source.id)
    returning * into binder;
    insert into public.binder_members (binder_id, user_id) values (binder.id, source.user_id)
      on conflict do nothing;
  end if;
  insert into public.binder_sheets (binder_id, contact_sheet_id) values (binder.id, new_id)
    on conflict do nothing;
  insert into public.binder_members (binder_id, user_id) values (binder.id, caller)
    on conflict do nothing;

  return jsonb_build_object('sheetId', new_id, 'binderId', binder.id);
end;
$$;

revoke all on function public.create_remix(text) from public;
grant execute on function public.create_remix(text) to authenticated;
