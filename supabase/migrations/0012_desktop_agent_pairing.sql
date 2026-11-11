-- Phase 9/10: paired Electron delivery using the existing agent audit lifecycle.
-- The raw paired-device token is shown once by the Python Agent and is never
-- stored in Supabase or exposed to the Electron renderer.

begin;

alter table public.device_registrations
  add column if not exists desktop_token_hash text;

create unique index if not exists device_registrations_desktop_token_hash_uidx
  on public.device_registrations (desktop_token_hash)
  where desktop_token_hash is not null;

create index if not exists agent_actions_device_delivery_idx
  on public.agent_actions (device_id, status, approval_expires_at, created_at)
  where device_id is not null and status in ('approved', 'executing');

comment on column public.device_registrations.desktop_token_hash
  is 'SHA-256 hash of the paired Electron device token. Raw token is never stored.';

commit;
