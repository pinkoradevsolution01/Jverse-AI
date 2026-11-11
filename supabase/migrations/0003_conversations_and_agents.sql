begin;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  model_preference text,
  archived_at timestamptz,
  pinned_at timestamptz,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sequence_number bigint not null,
  role public.message_role not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  model_name text,
  token_count integer check (token_count is null or token_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, sequence_number)
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  parent_run_id uuid references public.agent_runs(id) on delete set null,
  status public.agent_run_status not null default 'created',
  requested_model text,
  effective_model text,
  prompt_version text,
  correlation_id uuid not null default gen_random_uuid(),
  context_manifest jsonb not null default '{}'::jsonb,
  error_code text,
  error_detail text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.device_registrations(id) on delete set null,
  action_type text not null,
  risk_tier smallint not null check (risk_tier between 0 and 4),
  status public.agent_action_status not null default 'proposed',
  input_payload jsonb not null default '{}'::jsonb,
  target_summary text not null,
  approval_token_hash text,
  approval_expires_at timestamptz,
  approved_at timestamptz,
  executed_at timestamptz,
  completed_at timestamptz,
  idempotency_key uuid not null default gen_random_uuid(),
  result_summary jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, idempotency_key)
);

create table public.chat_exports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text,
  format text not null check (format in ('markdown', 'pdf', 'json')),
  status text not null check (status in ('queued', 'processing', 'ready', 'failed')),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index conversations_owner_last_message_idx on public.conversations (owner_id, last_message_at desc nulls last) where archived_at is null;
create index conversations_workspace_created_idx on public.conversations (workspace_id, created_at desc);
create index messages_conversation_sequence_idx on public.messages (conversation_id, sequence_number);
create index messages_owner_created_idx on public.messages (owner_id, created_at desc);
create index agent_runs_owner_created_idx on public.agent_runs (owner_id, created_at desc);
create index agent_runs_workspace_status_idx on public.agent_runs (workspace_id, status, created_at desc);
create unique index agent_runs_correlation_uidx on public.agent_runs (correlation_id);
create index agent_actions_run_created_idx on public.agent_actions (agent_run_id, created_at);
create index agent_actions_owner_status_idx on public.agent_actions (owner_id, status, created_at desc);
create index agent_actions_pending_approval_idx on public.agent_actions (owner_id, approval_expires_at) where status = 'awaiting_approval';
create index chat_exports_owner_created_idx on public.chat_exports (owner_id, created_at desc);
create index activity_logs_workspace_time_idx on public.activity_logs (workspace_id, occurred_at desc);
create index activity_logs_user_time_idx on public.activity_logs (user_id, occurred_at desc);

create trigger conversations_set_updated_at before update on public.conversations
  for each row execute procedure public.set_updated_at();
create trigger agent_runs_set_updated_at before update on public.agent_runs
  for each row execute procedure public.set_updated_at();
create trigger agent_actions_set_updated_at before update on public.agent_actions
  for each row execute procedure public.set_updated_at();
create trigger chat_exports_set_updated_at before update on public.chat_exports
  for each row execute procedure public.set_updated_at();

commit;

