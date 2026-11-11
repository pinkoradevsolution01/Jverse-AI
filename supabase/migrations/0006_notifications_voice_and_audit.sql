begin;

create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  preferred_voice text,
  speech_rate numeric(4,2) not null default 1.00 check (speech_rate between 0.50 and 2.00),
  push_to_talk_enabled boolean not null default true,
  wake_word_enabled boolean not null default false,
  wake_word_phrase text,
  recording_retention_days integer check (recording_retention_days between 1 and 3650),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind public.notification_kind not null default 'info',
  title text not null,
  body text,
  action jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  delivered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  device_id uuid references public.device_registrations(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  agent_action_id uuid references public.agent_actions(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  correlation_id uuid,
  outcome text not null check (outcome in ('attempted', 'allowed', 'denied', 'succeeded', 'failed', 'cancelled')),
  payload_redacted jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index audit_events_workspace_time_idx on public.audit_events (workspace_id, occurred_at desc);
create index audit_events_actor_time_idx on public.audit_events (actor_id, occurred_at desc);
create index audit_events_correlation_idx on public.audit_events (correlation_id) where correlation_id is not null;
create index audit_events_agent_action_idx on public.audit_events (agent_action_id, occurred_at) where agent_action_id is not null;

create trigger voice_profiles_set_updated_at before update on public.voice_profiles
  for each row execute procedure public.set_updated_at();

commit;

