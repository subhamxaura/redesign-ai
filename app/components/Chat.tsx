"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Message = { role: "user" | "assistant"; content: string };

export default function Chat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages, loading, open, reduce]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((p) => [...p, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Chat request failed.");
      setMessages((p) => [...p, { role: "assistant", content: typeof data.reply === "string" ? data.reply : "No response." }]);
    } catch (err) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: err instanceof Error ? err.message : "Could not connect to the assistant." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        whileHover={reduce ? {} : { scale: 1.04 }}
        whileTap={reduce ? {} : { scale: 0.97 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white text-sm font-bold tracking-widest text-black shadow-[0_16px_40px_rgba(0,0,0,0.4)] transition hover:bg-zinc-100"
      >
        {/* icon */}
        <span className="relative flex h-7 w-7 items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.18 }}>
                ✕
              </motion.span>
            ) : (
              <motion.span key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px]">
                AI
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        {!open && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* backdrop for mobile */}
            <motion.button
              aria-label="Close chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-6 right-6 z-50 flex max-h-[min(640px,calc(100dvh-96px))] w-[380px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0a0f1a]/95 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl md:bottom-24"
              role="dialog"
              aria-label="ReDesignAI assistant"
              aria-modal="false"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">ReDesignAI Assistant</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Practical UI & frontend help
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white hover:text-black"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/60">
                      Ask about layout, accessibility, copy, colors, or the generated redesign. I keep answers concise and shippable.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["Improve the hero hierarchy", "Make CTAs clearer", "Fix accessibility", "Suggest a color system"].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setInput(q);
                            setTimeout(() => inputRef.current?.focus(), 0);
                          }}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white hover:text-black"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <motion.div
                    key={`${m.role}-${i}`}
                    initial={reduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${
                      m.role === "user"
                        ? "ml-auto bg-cyan-400 text-black"
                        : "mr-auto border border-white/10 bg-white/[0.06] text-white/80"
                    }`}
                  >
                    {m.content}
                  </motion.div>
                ))}

                {loading && (
                  <div className="mr-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/50">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" />
                    </span>
                    Thinking…
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={sendMessage} className="border-t border-white/10 p-3">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1.5 focus-within:border-cyan-400/50 focus-within:bg-white/[0.06]">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about the redesign…"
                    aria-label="Message the assistant"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    aria-label="Send message"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-zinc-100 disabled:opacity-40"
                  >
                    ↑
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-white/25">AI can make mistakes. Verify important decisions.</p>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
