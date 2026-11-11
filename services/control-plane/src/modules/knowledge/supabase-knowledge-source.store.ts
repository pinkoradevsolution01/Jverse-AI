import type { SupabaseClient } from "@supabase/supabase-js";

import type { KnowledgeSourceStore } from "./knowledge.repository";

export class SupabaseKnowledgeSourceStore implements KnowledgeSourceStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async download(storagePath: string) {
    const { data, error } = await this.supabase.storage.from("knowledge-base").download(storagePath);
    if (error) throw error;
    return new Uint8Array(await data.arrayBuffer());
  }
}
