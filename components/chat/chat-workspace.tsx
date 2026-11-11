"use client";

import { createBrowserClient } from "@supabase/ssr";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, LoaderCircle, Plus, Sparkles, Square, UserRound } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_QWEN_MODEL, type ChatStreamEvent } from "../../lib/ai/contracts";
import { MarkdownMessage } from "./markdown-message";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  pending?: boolean;
};

function storedMessageText(content: unknown) {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && typeof (content as { text?: unknown }).text === "string") {
    return (content as { text: string }).text;
  }
  return "";
}

function eventBlocks(buffer: string) {
  const blocks = buffer.split("\n\n");
  return { complete: blocks.slice(0, -1), remainder: blocks[blocks.length - 1] ?? "" };
}

function parseSseEvent(block: string): ChatStreamEvent | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!data) return null;
  try {
    return JSON.parse(data) as ChatStreamEvent;
  } catch {
    return null;
  }
}

export function ChatWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "loading" | "streaming" | "error">("loading");
  const [notice, setNotice] = useState("Loading your personal workspace…");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? createBrowserClient(url, key) : null;
  }, []);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setStatus("error");
      setNotice("Supabase environment values are required before chat can load.");
      return () => {
        active = false;
      };
    }

    const client = supabase;

    async function loadWorkspace() {
      const { data, error } = await client
        .from("workspace_members")
        .select("workspace_id")
        .limit(1)
        .maybeSingle();

      if (!active) return;
        if (error || !data?.workspace_id) {
          setStatus("error");
          setNotice("A personal workspace could not be loaded for this account.");
          return;
        }
        const { data: latestConversation } = await client
          .from("conversations")
          .select("id")
          .eq("workspace_id", data.workspace_id)
          .is("archived_at", null)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (latestConversation?.id) {
          const { data: history } = await client
            .from("messages")
            .select("id, role, content")
            .eq("conversation_id", latestConversation.id)
            .order("sequence_number", { ascending: true })
            .limit(100);
          if (!active) return;
          setConversationId(latestConversation.id);
          setMessages((history ?? [])
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({ id: item.id, role: item.role as "user" | "assistant", content: storedMessageText(item.content) }))
            .filter((item) => item.content.length > 0));
        }
        setWorkspaceId(data.workspace_id);
        setStatus("ready");
        setNotice("");
    }

    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const stopStreaming = () => abortRef.current?.abort();

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || !workspaceId || status === "streaming") return;

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "", pending: true }]);
    setDraft("");
    setStatus("streaming");
    setNotice("");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ conversationId, workspaceId, message, model: DEFAULT_QWEN_MODEL }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "The AI response could not be started.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let remainder = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = eventBlocks(remainder + decoder.decode(value, { stream: true }));
        remainder = parsed.remainder;
        for (const block of parsed.complete) {
          const streamEvent = parseSseEvent(block);
          if (!streamEvent) continue;
          if (streamEvent.type === "metadata") setConversationId(streamEvent.conversationId);
          if (streamEvent.type === "delta") {
            setMessages((current) => current.map((item) => item.id === assistantId
              ? { ...item, content: item.content + streamEvent.text, pending: false }
              : item));
          }
          if (streamEvent.type === "error") throw new Error(streamEvent.message);
        }
      }
    } catch (error) {
      const messageText = error instanceof Error && error.name === "AbortError"
        ? "Generation stopped."
        : error instanceof Error ? error.message : "The AI response could not be completed.";
      setNotice(messageText);
      setMessages((current) => current.map((item) => item.id === assistantId
        ? { ...item, content: item.content || "No response was generated.", pending: false }
        : item));
    } finally {
      abortRef.current = null;
      setStatus("ready");
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  function startNewConversation() {
    stopStreaming();
    setConversationId(null);
    setMessages([]);
    setNotice("");
    setStatus(workspaceId ? "ready" : "loading");
  }

  return (
    <section className="flex min-h-[calc(100vh-7rem)] flex-col gap-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/15 bg-[#071326]/80 px-4 py-3 shadow-[0_0_30px_rgba(0,229,255,.04)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><Sparkles size={18} /></span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-slate-100">JVerse AI Chat</h1>
            <p className="text-xs text-slate-400">Qwen 2.5 · scoped memory · streaming</p>
          </div>
        </div>
        <button type="button" onClick={startNewConversation} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/10">
          <Plus size={15} /> New chat
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-cyan-300/15 bg-[#071326]/65">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && status !== "error" ? (
            <div className="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center text-center">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><Bot size={26} /></span>
              <h2 className="text-lg font-semibold text-slate-100">How can JVerse help?</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Start a conversation. Responses stream as they are generated and render safe Markdown with highlighted code.</p>
            </div>
          ) : null}
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.article key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" ? <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Bot size={15} /></span> : null}
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-violet-500/20 text-slate-100" : "border border-cyan-300/15 bg-[#050816]/70"}`}>
                  {message.role === "assistant" ? <MarkdownMessage content={message.content || "…"} /> : <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>}
                  {message.pending ? <LoaderCircle className="mt-2 animate-spin text-cyan-300" size={14} /> : null}
                </div>
                {message.role === "user" ? <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-violet-200"><UserRound size={15} /></span> : null}
              </motion.article>
            ))}
          </AnimatePresence>
          {notice ? <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{notice}</p> : null}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={submit} className="border-t border-cyan-300/15 p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-cyan-300/20 bg-[#050816] p-2 focus-within:border-cyan-300/45">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} disabled={status === "loading" || status === "error" || status === "streaming"} rows={1} placeholder={status === "loading" ? "Preparing workspace…" : "Message JVerse AI"} className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed" />
            {status === "streaming" ? (
              <button type="button" onClick={stopStreaming} className="grid h-10 w-10 place-items-center rounded-xl bg-rose-400/15 text-rose-200"><Square size={15} fill="currentColor" /></button>
            ) : (
              <button type="submit" disabled={!draft.trim() || status !== "ready"} className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 text-[#03101c] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={18} /></button>
            )}
          </div>
          <p className="mt-2 px-2 text-[11px] text-slate-500">Enter to send · Shift+Enter for a new line · Responses are streamed through the protected JVerse control plane.</p>
        </form>
      </div>
    </section>
  );
}
