export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  workspace: (workspaceId: string) => ["workspace", workspaceId] as const,
  conversations: (workspaceId: string, filters: Record<string, string | number | boolean | undefined> = {}) => ["conversations", workspaceId, filters] as const,
  conversation: (conversationId: string) => ["conversation", conversationId] as const,
  messages: (conversationId: string) => ["messages", conversationId] as const,
  knowledge: (workspaceId: string, filters: Record<string, string | number | boolean | undefined> = {}) => ["knowledge", workspaceId, filters] as const,
  desktopCapabilities: () => ["desktop", "capabilities"] as const,
};
