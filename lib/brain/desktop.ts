export type DesktopActionInput = {
  workspace_id: string;
  device_id: string;
  action_type: "open_file" | "open_folder" | "open_application" | "notify";
  path?: string;
  notification?: { title: string; body: string };
  reason: string;
};

export async function requestDesktopAction(input: DesktopActionInput) {
  const response = await fetch("/api/desktop/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Unable to request desktop action.");
  return body as { action_id: string; status: string; expires_at?: string };
}

export async function approveDesktopAction(actionId: string) {
  const response = await fetch(`/api/desktop/actions/${encodeURIComponent(actionId)}/approve`, { method: "POST" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Unable to approve desktop action.");
  return body as { action_id: string; status: "approved"; expires_at?: string };
}
