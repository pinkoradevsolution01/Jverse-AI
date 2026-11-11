import type { SupabaseClient } from "@supabase/supabase-js";

export type StoredChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

function textContent(content: unknown) {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && typeof (content as { text?: unknown }).text === "string") {
    return (content as { text: string }).text;
  }
  return "";
}

export class ChatRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async assertWorkspaceMember(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase.from("workspace_members")
      .select("workspace_id").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("workspace_access_denied");
  }

  async resolveConversation(input: { conversationId: string | null; workspaceId: string; userId: string; title: string; model: string }) {
    if (input.conversationId) {
      const { data, error } = await this.supabase.from("conversations")
        .select("id").eq("id", input.conversationId).eq("workspace_id", input.workspaceId).eq("owner_id", input.userId)
        .is("archived_at", null).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("conversation_not_found");
      return data.id as string;
    }

    const { data, error } = await this.supabase.from("conversations").insert({
      workspace_id: input.workspaceId,
      owner_id: input.userId,
      title: input.title.slice(0, 120),
      model_preference: input.model,
      last_message_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    return data.id as string;
  }

  async listMessages(conversationId: string, limit = 24): Promise<StoredChatMessage[]> {
    const { data, error } = await this.supabase.from("messages")
      .select("role, content").eq("conversation_id", conversationId).order("sequence_number", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).reverse().map((row) => ({ role: row.role as StoredChatMessage["role"], content: textContent(row.content) }))
      .filter((message) => message.content.length > 0);
  }

  async appendMessage(input: { conversationId: string; userId: string; role: "user" | "assistant"; content: string; model?: string }) {
    const { data: latest, error: latestError } = await this.supabase.from("messages")
      .select("sequence_number").eq("conversation_id", input.conversationId).order("sequence_number", { ascending: false }).limit(1).maybeSingle();
    if (latestError) throw latestError;
    const { data, error } = await this.supabase.from("messages").insert({
      conversation_id: input.conversationId,
      sequence_number: Number(latest?.sequence_number ?? 0) + 1,
      role: input.role,
      owner_id: input.userId,
      content: { text: input.content },
      model_name: input.model,
    }).select("id").single();
    if (error) throw error;
    await this.supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", input.conversationId);
    return data.id as string;
  }
}
