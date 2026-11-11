-- Phase 8: private, workspace-scoped knowledge-base ingestion and retrieval.
-- File parsing, embeddings, and writes are owned by the trusted control plane.

insert into storage.buckets (id, name, public)
select 'knowledge-base', 'knowledge-base', false
where not exists (select 1 from storage.buckets where id = 'knowledge-base');

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'knowledge-base' check (storage_bucket = 'knowledge-base'),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 512),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  )),
  byte_size bigint not null check (byte_size > 0),
  checksum_sha256 text,
  ingestion_status text not null default 'queued' check (ingestion_status in (
    'queued', 'extracting', 'chunking', 'embedding', 'ready', 'failed', 'deleted'
  )),
  failure_code text,
  failure_message text,
  chunk_count integer not null default 0 check (chunk_count >= 0),
  embedding_provider text,
  embedding_model text,
  metadata jsonb not null default '{}'::jsonb,
  ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  content text not null check (char_length(content) between 1 and 24000),
  token_estimate integer not null default 0 check (token_estimate >= 0),
  metadata jsonb not null default '{}'::jsonb,
  embedding vector not null,
  embedding_provider text not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

create index if not exists knowledge_documents_ready_scope_idx
  on public.knowledge_documents (workspace_id, created_at desc)
  where ingestion_status = 'ready';

create index if not exists knowledge_documents_checksum_scope_idx
  on public.knowledge_documents (workspace_id, checksum_sha256)
  where checksum_sha256 is not null and ingestion_status != 'deleted';

create index if not exists knowledge_chunks_document_idx
  on public.knowledge_chunks (document_id, ordinal);

create index if not exists knowledge_chunks_workspace_idx
  on public.knowledge_chunks (workspace_id, document_id);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

drop policy if exists "members can read knowledge documents" on public.knowledge_documents;
create policy "members can read knowledge documents"
  on public.knowledge_documents for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.workspace_members membership
      where membership.workspace_id = knowledge_documents.workspace_id
        and membership.user_id = auth.uid()
    )
  );

drop policy if exists "members can read knowledge chunks" on public.knowledge_chunks;
create policy "members can read knowledge chunks"
  on public.knowledge_chunks for select
  using (
    exists (
      select 1 from public.knowledge_documents document
      where document.id = knowledge_chunks.document_id
        and (
          document.owner_id = auth.uid()
          or exists (
            select 1 from public.workspace_members membership
            where membership.workspace_id = document.workspace_id
              and membership.user_id = auth.uid()
          )
        )
    )
  );

create or replace function public.match_knowledge_chunks(
  p_workspace_id uuid,
  p_embedding vector,
  p_match_count integer default 8,
  p_min_similarity real default 0.30
)
returns table (
  chunk_id uuid,
  document_id uuid,
  file_name text,
  ordinal integer,
  content text,
  metadata jsonb,
  similarity real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    chunk.id,
    chunk.document_id,
    document.file_name,
    chunk.ordinal,
    chunk.content,
    chunk.metadata,
    (1 - (chunk.embedding <=> p_embedding))::real as similarity
  from public.knowledge_chunks chunk
  join public.knowledge_documents document on document.id = chunk.document_id
  where chunk.workspace_id = p_workspace_id
    and document.ingestion_status = 'ready'
    and (1 - (chunk.embedding <=> p_embedding)) >= p_min_similarity
  order by (chunk.embedding <=> p_embedding)
  limit greatest(1, least(p_match_count, 20));
$$;

revoke all on function public.match_knowledge_chunks(uuid, vector, integer, real) from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks(uuid, vector, integer, real) to service_role;
