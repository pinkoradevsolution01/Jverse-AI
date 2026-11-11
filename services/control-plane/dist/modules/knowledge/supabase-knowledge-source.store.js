"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseKnowledgeSourceStore = void 0;
class SupabaseKnowledgeSourceStore {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async download(storagePath) {
        const { data, error } = await this.supabase.storage.from("knowledge-base").download(storagePath);
        if (error)
            throw error;
        return new Uint8Array(await data.arrayBuffer());
    }
}
exports.SupabaseKnowledgeSourceStore = SupabaseKnowledgeSourceStore;
