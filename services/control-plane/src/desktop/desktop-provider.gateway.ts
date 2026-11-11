export type ProviderEvent =
  | { type: "metadata"; conversationId: string; messageId: string }
  | { type: "delta"; text: string }
  | { type: "done"; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: "error"; code: string; message: string };

export interface DesktopProviderGateway {
  stream(input: {
    userId: string;
    workspaceId: string;
    conversationId: string | null;
    message: string;
    model: string;
    signal: AbortSignal;
  }): AsyncIterable<ProviderEvent>;
}

/** A fail-closed bridge until a signed-in Electron main process is paired. */
export class UnpairedDesktopProviderGateway implements DesktopProviderGateway {
  async *stream(): AsyncIterable<ProviderEvent> {
    yield {
      type: "error",
      code: "desktop_provider_unavailable",
      message: "No paired JVerse desktop provider is available.",
    };
  }
}
