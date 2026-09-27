-- Compatible with existing clients: personal avatars use <uid>/..., while
-- group pictures use groups/<conversation-id>/... and require a current admin.
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);
create policy "Users can update own avatar" on storage.objects for update to authenticated
using (bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);
create policy "Users can delete own avatar" on storage.objects for delete to authenticated
using (bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "Current admins manage group avatars" on storage.objects;
create policy "Current admins manage group avatars" on storage.objects for all to authenticated
using (bucket_id='avatars' and split_part(name,'/',1)='groups' and exists (
  select 1 from public.conversation_members m where m.conversation_id::text=split_part(name,'/',2)
  and m.user_id=auth.uid() and m.role='admin'
))
with check (bucket_id='avatars' and split_part(name,'/',1)='groups' and exists (
  select 1 from public.conversation_members m where m.conversation_id::text=split_part(name,'/',2)
  and m.user_id=auth.uid() and m.role='admin'
));

update storage.buckets set file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'] where id='avatars';
