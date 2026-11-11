begin;

create table public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  bucket_id text not null check (bucket_id in ('documents', 'avatars', 'voice-recordings', 'project-files', 'knowledge-base', 'chat-exports', 'images')),
  storage_path text not null,
  original_name text not null check (char_length(trim(original_name)) between 1 and 1024),
  mime_type text,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text,
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'quarantined', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (bucket_id, storage_path)
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_file_id uuid unique references public.uploaded_files(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  source_type text not null check (source_type in ('upload', 'note', 'web_import', 'project')),
  status public.document_status not null default 'pending',
  current_version integer not null default 1 check (current_version > 0),
  checksum text,
  parser_version text,
  chunking_version text,
  embedding_model text,
  error_code text,
  error_detail text,
  metadata jsonb not null default '{}'::jsonb,
  indexed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_version integer not null check (document_version > 0),
  ordinal integer not null check (ordinal >= 0),
  content text not null,
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig, content)) stored,
  token_count integer check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_id, document_version, ordinal)
);

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_type text not null check (subject_type in ('knowledge_chunk', 'memory')),
  subject_id uuid not null,
  model_name text not null,
  model_version text not null,
  dimensions integer not null check (dimensions > 0 and dimensions <= 16000),
  embedding vector not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (subject_type, subject_id, model_name, model_version),
  check (vector_dims(embedding) = dimensions)
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  memory_type text not null check (memory_type in ('preference', 'instruction', 'fact', 'note')),
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'sensitive')),
  source_conversation_id uuid references public.conversations(id) on delete set null,
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  status text not null default 'active' check (status in ('candidate', 'active', 'superseded', 'deleted')),
  expires_at timestamptz,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  status public.ingestion_job_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  idempotency_key uuid not null default gen_random_uuid(),
  worker_reference text,
  error_code text,
  error_detail text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_id, idempotency_key)
);

create index uploaded_files_workspace_created_idx on public.uploaded_files (workspace_id, created_at desc);
create index uploaded_files_checksum_idx on public.uploaded_files (workspace_id, sha256) where sha256 is not null;
create index knowledge_documents_workspace_status_idx on public.knowledge_documents (workspace_id, status, updated_at desc) where deleted_at is null;
create index knowledge_chunks_document_ordinal_idx on public.knowledge_chunks (document_id, document_version, ordinal);
create index knowledge_chunks_workspace_idx on public.knowledge_chunks (workspace_id, document_id);
create index knowledge_chunks_search_gin_idx on public.knowledge_chunks using gin (search_vector);
create index embeddings_workspace_model_idx on public.embeddings (workspace_id, model_name, model_version);
create index memories_owner_active_idx on public.memories (owner_id, created_at desc) where status = 'active';
create index memories_workspace_type_idx on public.memories (workspace_id, memory_type, created_at desc) where status = 'active';
create index ingestion_jobs_document_created_idx on public.ingestion_jobs (document_id, created_at desc);
create index ingestion_jobs_active_idx on public.ingestion_jobs (status, created_at) where status in ('queued', 'running', 'retrying');

create trigger uploaded_files_set_updated_at before update on public.uploaded_files
  for each row execute procedure public.set_updated_at();
create trigger knowledge_documents_set_updated_at before update on public.knowledge_documents
  for each row execute procedure public.set_updated_at();
create trigger memories_set_updated_at before update on public.memories
  for each row execute procedure public.set_updated_at();
create trigger ingestion_jobs_set_updated_at before update on public.ingestion_jobs
  for each row execute procedure public.set_updated_at();

comment on table public.embeddings is 'Vector index is created by a later model-specific migration after the embedding-model ADR fixes a dimension. Metadata and keyword indexes support the initial generic model contract.';

commit;

