-- Phase 7: durable, tenant-scoped memory for the control plane.
-- The browser has read-only access through RLS. The trusted control plane is
-- the only writer (via its server-side Supabase credential).

create table if not exists public.memory_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid,
  source_message_id uuid,
  memory_kind text not null check (memory_kind in (
    'long_term_fact',
    'conversation_summary',
    'user_preference'
  )),
  status text not null default 'active' check (status in ('active', 'superseded', 'expired', 'deleted')),
  content text not null check (char_length(content) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb,
  importance smallint not null default 50 check (importance between 0 and 100),
  confidence numeric(4,3) not null default 0.800 check (confidence between 0 and 1),
  last_accessed_at timestamptz,
  access_count integer not null default 0 check (access_count >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memory_embeddings (
  memory_id uuid primary key references public.memory_records(id) on delete cascade,
  embedding vector not null,
  embedding_provider text not null,
  embedding_model text not null,
  created_at timestamptz not null default now()
);

create index if not exists memory_records_scope_active_idx
  on public.memory_records (workspace_id, user_id, memory_kind, updated_at desc)
  where status = 'active';

create index if not exists memory_records_conversation_idx
  on public.memory_records (workspace_id, conversation_id, created_at desc)
  where conversation_id is not null and status = 'active';

create index if not exists memory_records_expiry_idx
  on public.memory_records (expires_at)
  where expires_at is not null and status = 'active';

alter table public.memory_records enable row level security;
alter table public.memory_embeddings enable row level security;

drop policy if exists "members can read scoped memories" on public.memory_records;
create policy "members can read scoped memories"
  on public.memory_records for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members membership
      where membership.workspace_id = memory_records.workspace_id
        and membership.user_id = auth.uid()
    )
  );

drop policy if exists "members can read scoped memory embeddings" on public.memory_embeddings;
create policy "members can read scoped memory embeddings"
  on public.memory_embeddings for select
  using (
    exists (
      select 1
      from public.memory_records memory
      where memory.id = memory_embeddings.memory_id
        and (
          memory.user_id = auth.uid()
          or exists (
            select 1
            from public.workspace_members membership
            where membership.workspace_id = memory.workspace_id
              and membership.user_id = auth.uid()
          )
        )
    )
  );

-- The query vector must be produced by the configured embedding provider.
-- Qwen 2.5 remains the generation model; it is not silently repurposed as an
-- embedding model. The control plane supplies provider/model metadata.
create or replace function public.match_memory_records(
  p_workspace_id uuid,
  p_user_id uuid,
  p_embedding vector,
  p_match_count integer default 8,
  p_min_similarity real default 0.30
)
returns table (
  memory_id uuid,
  memory_kind text,
  content text,
  metadata jsonb,
  importance smallint,
  confidence numeric,
  similarity real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    memory.id,
    memory.memory_kind,
    memory.content,
    memory.metadata,
    memory.importance,
    memory.confidence,
    (1 - (embedding.embedding <=> p_embedding))::real as similarity
  from public.memory_records memory
  join public.memory_embeddings embedding on embedding.memory_id = memory.id
  where memory.workspace_id = p_workspace_id
    and memory.user_id = p_user_id
    and memory.status = 'active'
    and (memory.expires_at is null or memory.expires_at > now())
    and (1 - (embedding.embedding <=> p_embedding)) >= p_min_similarity
  order by
    (1 - (embedding.embedding <=> p_embedding)) desc,
    memory.importance desc,
    memory.last_accessed_at desc nulls last
  limit greatest(1, least(p_match_count, 20));
$$;

revoke all on function public.match_memory_records(uuid, uuid, vector, integer, real) from public, anon, authenticated;
grant execute on function public.match_memory_records(uuid, uuid, vector, integer, real) to service_role;

create or replace function public.increment_memory_access(p_memory_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.memory_records
  set access_count = access_count + 1,
      last_accessed_at = now(),
      updated_at = now()
  where id = p_memory_id;
$$;

revoke all on function public.increment_memory_access(uuid) from public, anon, authenticated;
grant execute on function public.increment_memory_access(uuid) to service_role;
