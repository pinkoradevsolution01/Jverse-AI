-- Open-source model relay: Python queues model work; the authenticated paired
-- Electron host runs it with its localhost-only Ollama runtime. No prompt is
-- sent to a third-party model provider.

begin;

create table public.desktop_model_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.device_registrations(id) on delete cascade,
  model_name text not null,
  messages jsonb not null check (jsonb_typeof(messages) = 'array'),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'expired')),
  response_text text not null default '',
  error_code text,
  expires_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index desktop_model_jobs_device_queue_idx
  on public.desktop_model_jobs (device_id, created_at)
  where status = 'queued';

create index desktop_model_jobs_user_recent_idx
  on public.desktop_model_jobs (user_id, created_at desc);

create trigger desktop_model_jobs_set_updated_at before update on public.desktop_model_jobs
  for each row execute procedure public.set_updated_at();

alter table public.desktop_model_jobs enable row level security;

-- Browser access is mediated by the Python Agent. This avoids exposing prompts
-- or model output to any other authenticated client through a direct table API.
revoke all on table public.desktop_model_jobs from anon, authenticated;

comment on table public.desktop_model_jobs
  is 'Durable private relay between the Python Agent and a paired Electron Ollama host.';

commit;
