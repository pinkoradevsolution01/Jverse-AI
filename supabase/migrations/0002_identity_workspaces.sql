begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text not null default 'personal' check (kind in ('personal', 'team')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  default_workspace_id uuid references public.workspaces(id) on delete set null,
  preferred_model text,
  local_inference_enabled boolean not null default true,
  reduced_motion boolean not null default false,
  data_retention_days integer check (data_retention_days between 1 and 3650),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.device_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_name text not null check (char_length(trim(device_name)) between 1 and 120),
  platform text not null check (platform in ('windows', 'macos', 'linux', 'web')),
  app_version text,
  public_key_fingerprint text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.capability_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.device_registrations(id) on delete cascade,
  capability text not null,
  scope jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (user_id, device_id, capability)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  version text not null,
  granted boolean not null,
  granted_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  unique (user_id, consent_type, version)
);

create table public.system_configurations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.device_registrations(id) on delete cascade,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, device_id)
);

create index workspace_members_user_workspace_idx on public.workspace_members (user_id, workspace_id);
create index device_registrations_user_active_idx on public.device_registrations (user_id, last_seen_at desc) where revoked_at is null;
create index capability_grants_active_idx on public.capability_grants (user_id, device_id, capability) where revoked_at is null;

create function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and owner_id = auth.uid()
  );
$$;

create function public.owns_registered_device(target_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.device_registrations
    where id = target_device_id
      and user_id = auth.uid()
      and revoked_at is null
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  personal_workspace_id uuid;
  personal_slug text;
begin
  insert into public.profiles (id, display_name, avatar_path)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  personal_slug := 'personal-' || replace(new.id::text, '-', '');
  insert into public.workspaces (owner_id, name, slug, kind)
  values (new.id, 'Personal Workspace', personal_slug, 'personal')
  returning id into personal_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (personal_workspace_id, new.id, 'owner');

  insert into public.settings (user_id, default_workspace_id)
  values (new.id, personal_workspace_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute procedure public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
  for each row execute procedure public.set_updated_at();
create trigger device_registrations_set_updated_at before update on public.device_registrations
  for each row execute procedure public.set_updated_at();
create trigger system_configurations_set_updated_at before update on public.system_configurations
  for each row execute procedure public.set_updated_at();

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.owns_registered_device(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_owner(uuid) to authenticated, service_role;
grant execute on function public.owns_registered_device(uuid) to authenticated, service_role;

commit;

