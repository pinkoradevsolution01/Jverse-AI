begin;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.settings enable row level security;
alter table public.device_registrations enable row level security;
alter table public.capability_grants enable row level security;
alter table public.consents enable row level security;
alter table public.system_configurations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_actions enable row level security;
alter table public.chat_exports enable row level security;
alter table public.activity_logs enable row level security;
alter table public.projects enable row level security;
alter table public.project_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.embeddings enable row level security;
alter table public.memories enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_select_member on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_insert_owner on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy workspaces_update_owner on public.workspaces for update to authenticated using (public.is_workspace_owner(id)) with check (owner_id = auth.uid());
create policy workspaces_delete_owner on public.workspaces for delete to authenticated using (public.is_workspace_owner(id));

create policy workspace_members_select_member on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_members_insert_owner on public.workspace_members for insert to authenticated with check (public.is_workspace_owner(workspace_id));
create policy workspace_members_update_owner on public.workspace_members for update to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy workspace_members_delete_owner on public.workspace_members for delete to authenticated using (public.is_workspace_owner(workspace_id));

create policy settings_select_self on public.settings for select to authenticated using (user_id = auth.uid());
create policy settings_insert_self on public.settings for insert to authenticated with check (user_id = auth.uid());
create policy settings_update_self on public.settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy devices_select_self on public.device_registrations for select to authenticated using (user_id = auth.uid());
create policy devices_insert_self on public.device_registrations for insert to authenticated with check (user_id = auth.uid());
create policy devices_update_self on public.device_registrations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_delete_self on public.device_registrations for delete to authenticated using (user_id = auth.uid());

create policy grants_select_self on public.capability_grants for select to authenticated using (user_id = auth.uid());
create policy grants_insert_self on public.capability_grants for insert to authenticated with check (user_id = auth.uid() and (device_id is null or public.owns_registered_device(device_id)));
create policy grants_update_self on public.capability_grants for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (device_id is null or public.owns_registered_device(device_id)));
create policy grants_delete_self on public.capability_grants for delete to authenticated using (user_id = auth.uid());

create policy consents_select_self on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_insert_self on public.consents for insert to authenticated with check (user_id = auth.uid());
create policy consents_update_self on public.consents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy configurations_select_self on public.system_configurations for select to authenticated using (user_id = auth.uid());
create policy configurations_insert_self on public.system_configurations for insert to authenticated with check (user_id = auth.uid() and public.owns_registered_device(device_id));
create policy configurations_update_self on public.system_configurations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.owns_registered_device(device_id));
create policy configurations_delete_self on public.system_configurations for delete to authenticated using (user_id = auth.uid());

create policy conversations_select_owner on public.conversations for select to authenticated using (owner_id = auth.uid());
create policy conversations_insert_owner on public.conversations for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy conversations_update_owner on public.conversations for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy conversations_delete_owner on public.conversations for delete to authenticated using (owner_id = auth.uid());

create policy messages_select_conversation_owner on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.owner_id = auth.uid())
);

create policy agent_runs_select_owner on public.agent_runs for select to authenticated using (owner_id = auth.uid());
create policy agent_actions_select_owner on public.agent_actions for select to authenticated using (owner_id = auth.uid());
create policy chat_exports_select_owner on public.chat_exports for select to authenticated using (owner_id = auth.uid());
create policy activity_logs_select_self on public.activity_logs for select to authenticated using (user_id = auth.uid());

create policy projects_select_member on public.projects for select to authenticated using (public.is_workspace_member(workspace_id));
create policy projects_insert_member on public.projects for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy projects_update_member on public.projects for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy projects_delete_owner on public.projects for delete to authenticated using (public.is_workspace_owner(workspace_id));

create policy project_notes_select_member on public.project_notes for select to authenticated using (public.is_workspace_member(workspace_id));
create policy project_notes_insert_member on public.project_notes for insert to authenticated with check (public.is_workspace_member(workspace_id) and author_id = auth.uid());
create policy project_notes_update_author on public.project_notes for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy project_notes_delete_author on public.project_notes for delete to authenticated using (author_id = auth.uid());

create policy tasks_select_member on public.tasks for select to authenticated using (public.is_workspace_member(workspace_id));
create policy tasks_insert_member on public.tasks for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy tasks_update_member on public.tasks for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy tasks_delete_creator_or_owner on public.tasks for delete to authenticated using (created_by = auth.uid() or public.is_workspace_owner(workspace_id));

create policy uploaded_files_select_member on public.uploaded_files for select to authenticated using (public.is_workspace_member(workspace_id));
create policy knowledge_documents_select_member on public.knowledge_documents for select to authenticated using (public.is_workspace_member(workspace_id) and deleted_at is null);
create policy knowledge_chunks_select_member on public.knowledge_chunks for select to authenticated using (public.is_workspace_member(workspace_id));
create policy embeddings_select_member on public.embeddings for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ingestion_jobs_select_member on public.ingestion_jobs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy memories_select_owner on public.memories for select to authenticated using (owner_id = auth.uid());
create policy memories_insert_owner on public.memories for insert to authenticated with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy memories_update_owner on public.memories for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy memories_delete_owner on public.memories for delete to authenticated using (owner_id = auth.uid());

create policy voice_profiles_select_self on public.voice_profiles for select to authenticated using (user_id = auth.uid());
create policy voice_profiles_insert_self on public.voice_profiles for insert to authenticated with check (user_id = auth.uid());
create policy voice_profiles_update_self on public.voice_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy voice_profiles_delete_self on public.voice_profiles for delete to authenticated using (user_id = auth.uid());

create policy notifications_select_self on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_self on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_events_select_actor on public.audit_events for select to authenticated using (actor_id = auth.uid());

commit;

