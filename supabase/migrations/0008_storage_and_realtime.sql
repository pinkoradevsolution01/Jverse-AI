begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 52428800, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']),
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('voice-recordings', 'voice-recordings', false, 52428800, array['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']),
  ('project-files', 'project-files', false, 52428800, null),
  ('knowledge-base', 'knowledge-base', false, 52428800, null),
  ('chat-exports', 'chat-exports', false, 52428800, array['application/pdf', 'application/json', 'text/markdown']),
  ('images', 'images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function public.storage_workspace_id(object_name text)
returns uuid
language sql
stable
security definer
set search_path = public, storage
as $$
  select public.safe_uuid((storage.foldername(object_name))[1]);
$$;

revoke all on function public.storage_workspace_id(text) from public;
grant execute on function public.storage_workspace_id(text) to authenticated, service_role;

create policy storage_objects_select_workspace_member
on storage.objects
for select
to authenticated
using (
  bucket_id = any (array['documents', 'avatars', 'voice-recordings', 'project-files', 'knowledge-base', 'chat-exports', 'images'])
  and public.is_workspace_member(public.storage_workspace_id(name))
);

create policy storage_objects_insert_workspace_member
on storage.objects
for insert
to authenticated
with check (
  bucket_id = any (array['documents', 'avatars', 'voice-recordings', 'project-files', 'knowledge-base', 'images'])
  and public.is_workspace_member(public.storage_workspace_id(name))
);

alter table public.conversations replica identity full;
alter table public.messages replica identity full;
alter table public.agent_runs replica identity full;
alter table public.agent_actions replica identity full;
alter table public.projects replica identity full;
alter table public.project_notes replica identity full;
alter table public.tasks replica identity full;
alter table public.knowledge_documents replica identity full;
alter table public.ingestion_jobs replica identity full;
alter table public.notifications replica identity full;

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.agent_runs;
alter publication supabase_realtime add table public.agent_actions;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.project_notes;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.knowledge_documents;
alter publication supabase_realtime add table public.ingestion_jobs;
alter publication supabase_realtime add table public.notifications;

commit;

