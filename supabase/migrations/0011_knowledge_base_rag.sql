-- Phase 8: RAG retrieval aligned with the canonical Phase 2 knowledge schema.
-- Documents, chunks, uploads, RLS and the private `knowledge-base` bucket are
-- already established by migrations 0005, 0007 and 0008. This migration only
-- adds retrieval indexes and an RPC over those canonical tables.
--
-- Embeddings stay in the shared `public.embeddings` table. A model-specific
-- ANN index is intentionally deferred until the embedding-model ADR fixes a
-- single vector dimension.

begin;

create index if not exists knowledge_documents_ready_scope_idx
  on public.knowledge_documents (workspace_id, updated_at desc)
  where status = 'ready' and deleted_at is null;

create index if not exists knowledge_documents_checksum_scope_idx
  on public.knowledge_documents (workspace_id, checksum)
  where checksum is not null and status <> 'deleted' and deleted_at is null;

create index if not exists embeddings_knowledge_chunk_scope_idx
  on public.embeddings (workspace_id, model_name, model_version, subject_id)
  where subject_type = 'knowledge_chunk';

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
  with eligible_embeddings as materialized (
    select embedding.subject_id, embedding.embedding
    from public.embeddings embedding
    where embedding.workspace_id = p_workspace_id
      and embedding.subject_type = 'knowledge_chunk'
      and embedding.dimensions = vector_dims(p_embedding)
  ), ranked_chunks as (
    select
      chunk.id as chunk_id,
      chunk.document_id,
      document.title as file_name,
      chunk.ordinal,
      chunk.content,
      chunk.metadata,
      (1 - (embedding.embedding <=> p_embedding))::real as similarity,
      (embedding.embedding <=> p_embedding) as distance
    from eligible_embeddings embedding
    join public.knowledge_chunks chunk on chunk.id = embedding.subject_id
    join public.knowledge_documents document on document.id = chunk.document_id
    where chunk.workspace_id = p_workspace_id
      and document.status = 'ready'
      and document.deleted_at is null
  )
  select chunk_id, document_id, file_name, ordinal, content, metadata, similarity
  from ranked_chunks
  where similarity >= p_min_similarity
  order by distance
  limit greatest(1, least(p_match_count, 20));
$$;

revoke all on function public.match_knowledge_chunks(uuid, vector, integer, real) from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks(uuid, vector, integer, real) to service_role;

comment on function public.match_knowledge_chunks(uuid, vector, integer, real)
  is 'Service-role semantic retrieval for Phase 2 workspace-scoped knowledge chunks.';

commit;
