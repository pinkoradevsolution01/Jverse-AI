begin;

create extension if not exists pgcrypto;
create extension if not exists vector;

create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.message_role as enum ('system', 'user', 'assistant', 'tool');
create type public.document_status as enum ('pending', 'scanning', 'extracting', 'embedding', 'ready', 'failed', 'deleted');
create type public.agent_run_status as enum ('created', 'contextualizing', 'planning', 'awaiting_approval', 'executing', 'synthesizing', 'completed', 'failed', 'cancelled', 'expired');
create type public.agent_action_status as enum ('proposed', 'awaiting_approval', 'approved', 'denied', 'executing', 'completed', 'failed', 'cancelled', 'expired');
create type public.ingestion_job_status as enum ('queued', 'running', 'retrying', 'completed', 'failed', 'cancelled');
create type public.notification_kind as enum ('info', 'success', 'warning', 'error', 'agent', 'system');

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
strict
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

commit;

