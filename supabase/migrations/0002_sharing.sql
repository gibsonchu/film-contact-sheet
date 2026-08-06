-- Public read paths for shared sheets.
--
-- A visitor holding a share token must be able to read the sheet without
-- authenticating, but must never see private notes, other people's sheets, or
-- anything writable. That is enforced here in one place: security-definer
-- functions that project only public columns.

create or replace function public.get_shared_sheet(share_token text, supplied_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link   public.share_links;
  sheet  public.contact_sheets;
begin
  select * into link from public.share_links where token = share_token;
  if link is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if link.expires_at is not null and link.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;
  if link.password_hash is not null
     and (supplied_password is null or encode(digest('fcs:' || supplied_password, 'sha256'), 'hex') <> link.password_hash) then
    return jsonb_build_object('error', 'password_required');
  end if;

  select * into sheet from public.contact_sheets
   where id = link.contact_sheet_id and deleted_at is null;
  if sheet is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object(
    'permission', link.permission,
    'sheet', to_jsonb(sheet) - 'user_id' - 'postcard',
    'photos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id, 'position', p.position, 'frameNumber', p.frame_number,
          'storagePath', p.storage_path, 'thumbPath', p.thumb_path,
          'width', p.width, 'height', p.height, 'rotation', p.rotation,
          'fit', p.fit, 'cropData', p.crop_data, 'status', p.status,
          'title', p.title, 'caption', p.caption, 'publicNote', p.public_note,
          'hidden', p.hidden, 'blank', p.blank
        ) order by p.position)
      from public.photos p where p.contact_sheet_id = sheet.id and p.hidden = false
    ), '[]'::jsonb),
    'annotations', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.z_index)
      from public.annotations a where a.contact_sheet_id = sheet.id
    ), '[]'::jsonb),
    'comments', case when sheet.comments_enabled then coalesce((
      select jsonb_agg(to_jsonb(c) - 'author_email' order by c.created_at)
      from public.comments c where c.contact_sheet_id = sheet.id
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.get_shared_sheet(text, text) from public;
grant execute on function public.get_shared_sheet(text, text) to anon, authenticated;

-- Commenting on a shared sheet, only when the link grants it.
create or replace function public.add_shared_comment(
  share_token text,
  photo uuid,
  author text,
  body text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.share_links;
  row  public.comments;
begin
  select * into link from public.share_links where token = share_token;
  if link is null or link.permission <> 'comment' then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if not exists (
    select 1 from public.contact_sheets s
     where s.id = link.contact_sheet_id and s.comments_enabled and s.deleted_at is null
  ) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if length(coalesce(body, '')) = 0 or length(body) > 2000 then
    return jsonb_build_object('error', 'invalid_body');
  end if;

  insert into public.comments (contact_sheet_id, photo_id, author_name, body)
  values (link.contact_sheet_id, photo, coalesce(nullif(author, ''), 'Anonymous'), body)
  returning * into row;

  return to_jsonb(row) - 'author_email';
end;
$$;

revoke all on function public.add_shared_comment(text, uuid, text, text) from public;
grant execute on function public.add_shared_comment(text, uuid, text, text) to anon, authenticated;

-- Storage: originals are private; access is granted through signed URLs issued
-- by the app after it has checked ownership or a valid share token.
insert into storage.buckets (id, name, public)
values ('contact-sheets', 'contact-sheets', false)
on conflict (id) do nothing;

create policy "owners read their objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'contact-sheets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owners write their objects"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'contact-sheets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owners delete their objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'contact-sheets' and (storage.foldername(name))[1] = auth.uid()::text);
