begin;

create function public.assert_message_conversation_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_owner_id uuid;
begin
  select owner_id into expected_owner_id from public.conversations where id = new.conversation_id;
  if expected_owner_id is null or expected_owner_id <> new.owner_id then
    raise exception 'message owner must match conversation owner';
  end if;
  return new;
end;
$$;

create function public.assert_agent_run_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_workspace_id uuid;
  expected_owner_id uuid;
begin
  if new.conversation_id is not null then
    select workspace_id, owner_id into expected_workspace_id, expected_owner_id
    from public.conversations where id = new.conversation_id;
    if expected_workspace_id is null
       or expected_workspace_id <> new.workspace_id
       or expected_owner_id <> new.owner_id then
      raise exception 'agent run must match its conversation workspace and owner';
    end if;
  end if;
  return new;
end;
$$;

create function public.assert_agent_action_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_workspace_id uuid;
  expected_owner_id uuid;
  device_owner_id uuid;
begin
  select workspace_id, owner_id into expected_workspace_id, expected_owner_id
  from public.agent_runs where id = new.agent_run_id;
  if expected_workspace_id is null
     or expected_workspace_id <> new.workspace_id
     or expected_owner_id <> new.owner_id then
    raise exception 'agent action must match its agent run workspace and owner';
  end if;

  if new.device_id is not null then
    select user_id into device_owner_id from public.device_registrations where id = new.device_id;
    if device_owner_id is null or device_owner_id <> new.owner_id then
      raise exception 'agent action device must belong to action owner';
    end if;
  end if;
  return new;
end;
$$;

create function public.assert_chat_export_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_owner_id uuid;
begin
  select owner_id into expected_owner_id from public.conversations where id = new.conversation_id;
  if expected_owner_id is null or expected_owner_id <> new.owner_id then
    raise exception 'chat export owner must match conversation owner';
  end if;
  return new;
end;
$$;

create function public.assert_project_note_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_workspace_id uuid;
begin
  select workspace_id into expected_workspace_id from public.projects where id = new.project_id;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'project note must match project workspace';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.author_id
  ) then
    raise exception 'project note author must be a workspace member';
  end if;
  return new;
end;
$$;

create function public.assert_task_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_workspace_id uuid;
begin
  if new.project_id is not null then
    select workspace_id into expected_workspace_id from public.projects where id = new.project_id;
    if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
      raise exception 'task must match project workspace';
    end if;
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.created_by
  ) then
    raise exception 'task creator must be a workspace member';
  end if;
  if new.assignee_id is not null and not exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.assignee_id
  ) then
    raise exception 'task assignee must be a workspace member';
  end if;
  return new;
end;
$$;

create function public.assert_knowledge_document_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_workspace_id uuid;
begin
  if new.uploaded_file_id is not null then
    select workspace_id into expected_workspace_id from public.uploaded_files where id = new.uploaded_file_id;
    if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
      raise exception 'knowledge document must match uploaded file workspace';
    end if;
  end if;
  return new;
end;
$$;

create function public.assert_knowledge_chunk_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_workspace_id uuid;
begin
  select workspace_id into expected_workspace_id from public.knowledge_documents where id = new.document_id;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'knowledge chunk must match document workspace';
  end if;
  return new;
end;
$$;

create function public.assert_embedding_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_workspace_id uuid;
begin
  if new.subject_type = 'knowledge_chunk' then
    select workspace_id into expected_workspace_id from public.knowledge_chunks where id = new.subject_id;
  else
    select workspace_id into expected_workspace_id from public.memories where id = new.subject_id;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'embedding must match its subject workspace';
  end if;
  return new;
end;
$$;

create function public.assert_memory_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  expected_workspace_id uuid;
  expected_owner_id uuid;
begin
  if new.source_conversation_id is not null then
    select workspace_id, owner_id into expected_workspace_id, expected_owner_id
    from public.conversations where id = new.source_conversation_id;
    if expected_workspace_id is null
       or expected_workspace_id <> new.workspace_id
       or expected_owner_id <> new.owner_id then
      raise exception 'memory source conversation must match memory workspace and owner';
    end if;
  end if;
  return new;
end;
$$;

create function public.assert_ingestion_job_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_workspace_id uuid;
begin
  select workspace_id into expected_workspace_id from public.knowledge_documents where id = new.document_id;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'ingestion job must match document workspace';
  end if;
  return new;
end;
$$;

create function public.assert_device_owner_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare expected_user_id uuid;
begin
  if new.device_id is not null then
    select user_id into expected_user_id from public.device_registrations where id = new.device_id;
    if expected_user_id is null or expected_user_id <> new.user_id then
      raise exception 'device must belong to user';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_assert_conversation_owner
  before insert or update on public.messages
  for each row execute procedure public.assert_message_conversation_owner();
create trigger agent_runs_assert_scope
  before insert or update on public.agent_runs
  for each row execute procedure public.assert_agent_run_scope();
create trigger agent_actions_assert_scope
  before insert or update on public.agent_actions
  for each row execute procedure public.assert_agent_action_scope();
create trigger chat_exports_assert_owner
  before insert or update on public.chat_exports
  for each row execute procedure public.assert_chat_export_owner();
create trigger project_notes_assert_scope
  before insert or update on public.project_notes
  for each row execute procedure public.assert_project_note_scope();
create trigger tasks_assert_scope
  before insert or update on public.tasks
  for each row execute procedure public.assert_task_scope();
create trigger knowledge_documents_assert_scope
  before insert or update on public.knowledge_documents
  for each row execute procedure public.assert_knowledge_document_scope();
create trigger knowledge_chunks_assert_scope
  before insert or update on public.knowledge_chunks
  for each row execute procedure public.assert_knowledge_chunk_scope();
create trigger embeddings_assert_scope
  before insert or update on public.embeddings
  for each row execute procedure public.assert_embedding_scope();
create trigger memories_assert_scope
  before insert or update on public.memories
  for each row execute procedure public.assert_memory_scope();
create trigger ingestion_jobs_assert_scope
  before insert or update on public.ingestion_jobs
  for each row execute procedure public.assert_ingestion_job_scope();
create trigger capability_grants_assert_device_owner
  before insert or update on public.capability_grants
  for each row execute procedure public.assert_device_owner_scope();
create trigger system_configurations_assert_device_owner
  before insert or update on public.system_configurations
  for each row execute procedure public.assert_device_owner_scope();

drop policy workspace_members_update_owner on public.workspace_members;
create policy workspace_members_update_owner
on public.workspace_members
for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (
  public.is_workspace_owner(workspace_id)
  and (
    user_id <> (select owner_id from public.workspaces where id = workspace_id)
    or role = 'owner'
  )
);

drop policy workspace_members_delete_owner on public.workspace_members;
create policy workspace_members_delete_owner
on public.workspace_members
for delete
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  and user_id <> (select owner_id from public.workspaces where id = workspace_id)
);

commit;

