begin;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  color text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text,
  body jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  assignee_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 500),
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  position numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index projects_workspace_status_idx on public.projects (workspace_id, status, updated_at desc);
create index project_notes_project_updated_idx on public.project_notes (project_id, updated_at desc);
create index tasks_workspace_status_position_idx on public.tasks (workspace_id, status, position, created_at);
create index tasks_project_status_due_idx on public.tasks (project_id, status, due_at) where project_id is not null;
create index tasks_assignee_open_idx on public.tasks (assignee_id, due_at) where assignee_id is not null and completed_at is null;

create trigger projects_set_updated_at before update on public.projects
  for each row execute procedure public.set_updated_at();
create trigger project_notes_set_updated_at before update on public.project_notes
  for each row execute procedure public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute procedure public.set_updated_at();

commit;

