export type ControlPlaneConfig = {
  port: number;
  controlPlaneToken: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  ollamaBaseUrl: string;
};

export function loadConfig(): ControlPlaneConfig {
  const controlPlaneToken = process.env.AI_CONTROL_PLANE_TOKEN;
  if (!controlPlaneToken || controlPlaneToken.length < 32) {
    throw new Error("AI_CONTROL_PLANE_TOKEN must be a server-only secret of at least 32 characters.");
  }
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port.");
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required by the trusted control plane.");
  }

  const ollamaBaseUrl = process.env.JVERSE_OLLAMA_URL ?? "http://127.0.0.1:11434";
  const ollamaUrl = new URL(ollamaBaseUrl);
  if ((ollamaUrl.protocol !== "http:" && ollamaUrl.protocol !== "https:")
    || (ollamaUrl.hostname !== "127.0.0.1" && ollamaUrl.hostname !== "localhost")) {
    throw new Error("JVERSE_OLLAMA_URL must be a localhost-only Ollama endpoint.");
  }

  return { port, controlPlaneToken, supabaseUrl, supabaseServiceRoleKey, ollamaBaseUrl };
}
