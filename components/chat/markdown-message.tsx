"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-message min-w-0 text-sm leading-7 text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-cyan-300 underline underline-offset-4">
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => (
            <code className={`${className ?? ""} rounded bg-slate-950/70 px-1.5 py-0.5 font-mono text-[.82em] text-cyan-100`} {...props}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-xl border border-cyan-300/15 bg-[#050816] p-4 text-xs leading-6 shadow-inner shadow-cyan-400/5">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      <style jsx global>{`
        .markdown-message .hljs-keyword, .markdown-message .hljs-selector-tag { color: #c4a5ff; }
        .markdown-message .hljs-string, .markdown-message .hljs-attr { color: #8affc1; }
        .markdown-message .hljs-number, .markdown-message .hljs-literal { color: #ffca70; }
        .markdown-message .hljs-title, .markdown-message .hljs-function { color: #6ce8ff; }
        .markdown-message .hljs-comment { color: #64748b; }
      `}</style>
    </div>
  );
}
