"use client";

import type { RedesignSpec } from "@/app/lib/redesign";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export type { RedesignSpec } from "@/app/lib/redesign";

type Props = {
  design: RedesignSpec;
  imageUrl?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
};

type Viewport = "desktop" | "tablet" | "mobile";

export default function RedesignPreview({ design, imageUrl, onRegenerate, regenerating }: Props) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(0);
  const reduce = useReducedMotion();

  const prevViewport = useRef(viewport);
  const prevTitle = useRef(design.title);
  useEffect(() => {
    if (prevViewport.current !== viewport || prevTitle.current !== design.title) {
      prevViewport.current = viewport;
      prevTitle.current = design.title;
      setMenuOpen(false);
    }
  }, [viewport, design.title]);

  const navItems = ["Overview", "Features", "Pricing", "Resources"];

  const frameMax =
    viewport === "mobile" ? "max-w-[390px]" : viewport === "tablet" ? "max-w-[820px]" : "max-w-none";

  return (
    <div className="mt-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1">
          {(["desktop", "tablet", "mobile"] as Viewport[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewport(v)}
              aria-pressed={viewport === v}
              aria-label={`Switch to ${v} viewport`}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition ${
                viewport === v
                  ? "bg-white text-black shadow"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium tracking-widest text-white/50 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE PREVIEW
          </span>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={!!regenerating}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-100 disabled:opacity-50"
            >
              <span className={`inline-block h-3 w-3 rounded-full border-2 border-black/20 border-t-black ${regenerating ? "animate-spin" : "hidden"}`} />
              {regenerating ? "Regenerating…" : "Generate another"}
            </button>
          )}
        </div>
      </div>

      {/* Frame */}
      <motion.div
        layout={!reduce}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`mx-auto mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-2xl ${frameMax} transition-all duration-300`}
        style={{ viewTransitionName: "redesign-frame" } as React.CSSProperties}
      >
        {/* Browser chrome */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] shadow" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/50 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            redesign.ai / preview
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold tracking-widest text-black">
            {viewport.toUpperCase()}
          </span>
        </div>

        {/* Preview content */}
        <div
          className="relative overflow-hidden"
          style={{ backgroundColor: design.theme.background, color: design.theme.text }}
        >
          {/* ---------- Header ---------- */}
          <header
            className="sticky top-0 z-30 border-b backdrop-blur-xl"
            style={{ borderColor: `${design.theme.text}14`, backgroundColor: `${design.theme.background}f2` }}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-7">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-bold"
                  style={{ backgroundColor: design.theme.accent, color: design.theme.background }}
                >
                  ◆
                </div>
                <span className="text-sm font-semibold tracking-tight">ReDesign</span>
                <span className="hidden rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-widest opacity-60 md:inline" style={{ borderColor: `${design.theme.text}18` }}>
                  PREVIEW
                </span>
              </div>

              <nav className="hidden items-center gap-1 md:flex">
                {navItems.map((item, i) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveNav(i)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                      activeNav === i ? "bg-white text-black" : "opacity-65 hover:opacity-100 hover:bg-white/10"
                    }`}
                    style={activeNav === i ? {} : { color: design.theme.text }}
                  >
                    {item}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="hidden rounded-full border px-3.5 py-1.5 text-xs font-medium transition hover:scale-[1.02] md:inline-flex"
                  style={{ borderColor: `${design.theme.text}22`, backgroundColor: `${design.theme.text}08`, color: design.theme.text }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  aria-expanded={menuOpen}
                  aria-label="Toggle menu"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold md:hidden"
                  style={{ borderColor: `${design.theme.text}22`, backgroundColor: `${design.theme.text}08` }}
                >
                  {menuOpen ? "Close" : "Menu"}
                  <span className="text-[10px]">{menuOpen ? "✕" : "☰"}</span>
                </button>
                <button
                  type="button"
                  className="hidden rounded-full px-4 py-1.5 text-xs font-semibold text-black md:inline-flex"
                  style={{ backgroundColor: design.theme.accent }}
                >
                  Get started
                </button>
              </div>
            </div>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden border-t md:hidden"
                  style={{ borderColor: `${design.theme.text}10`, backgroundColor: design.theme.surface }}
                >
                  <div className="grid gap-1 p-3">
                    {navItems.map((item, i) => (
                      <button
                        key={item}
                        onClick={() => {
                          setActiveNav(i);
                          setMenuOpen(false);
                        }}
                        className={`rounded-xl px-4 py-3 text-left text-sm font-medium ${i === activeNav ? "bg-white text-black" : ""}`}
                        style={i === activeNav ? {} : { color: design.theme.text }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          {/* ---------- Hero ---------- */}
          <section className="relative min-h-[520px] overflow-hidden md:min-h-[560px]">
            {imageUrl ? (
              <img src={imageUrl} alt="Original screenshot reference" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ backgroundColor: design.theme.surface }} />
            )}
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

            <motion.div
              initial={reduce ? {} : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex min-h-[520px] items-center px-6 py-16 md:min-h-[560px] md:px-10 lg:px-12"
            >
              <div className="max-w-[640px]">
                <motion.p
                  initial={reduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="text-[11px] font-semibold uppercase tracking-[0.32em]"
                  style={{ color: design.theme.accent }}
                >
                  AI Redesigned Experience
                </motion.p>

                <motion.h1
                  initial={reduce ? {} : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.6 }}
                  className="mt-4 text-[34px] font-semibold uppercase leading-[0.92] tracking-[-0.03em] text-white md:text-[52px] lg:text-[56px]"
                >
                  {design.title}
                </motion.h1>

                <motion.p
                  initial={reduce ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-5 max-w-xl text-[16px] font-medium leading-7 text-white/80 md:text-[18px]"
                >
                  {design.subtitle}
                </motion.p>

                <motion.p
                  initial={reduce ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.38 }}
                  className="mt-3 max-w-xl text-sm leading-7 text-white/60"
                >
                  {design.description}
                </motion.p>

                <motion.div
                  initial={reduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="mt-8 flex flex-col gap-3 sm:flex-row"
                >
                  <button
                    type="button"
                    className="rounded-full px-7 py-3.5 text-sm font-semibold text-black shadow-lg transition hover:-translate-y-0.5 hover:scale-[1.02]"
                    style={{ backgroundColor: design.theme.accent }}
                  >
                    {design.primaryButton}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-black"
                  >
                    {design.secondaryButton}
                  </button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="mt-10 flex items-center gap-3 text-[11px] tracking-wide text-white/40"
                >
                  <span className="h-px w-10 bg-white/20" />
                  Original screenshot used as reference
                </motion.div>
              </div>
            </motion.div>

            <div className="absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center md:flex">
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/45">Scroll to explore</p>
              <div className="mt-2 flex h-7 w-4 justify-center rounded-full border border-white/25 p-1">
                <motion.div
                  animate={reduce ? {} : { y: [0, 6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="h-1.5 w-1.5 rounded-full bg-white"
                />
              </div>
            </div>

            <div className="absolute bottom-5 right-5 z-20 hidden rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/60 backdrop-blur md:block">
              AI Preview • {design.theme.accent}
            </div>
          </section>

          {/* ---------- Design direction ---------- */}
          <section className="border-t px-6 py-10 md:px-10 md:py-12" style={{ borderColor: `${design.theme.text}12`, backgroundColor: design.theme.surface }}>
            <div className="grid gap-8 md:grid-cols-2">
              <motion.div
                initial={reduce ? {} : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: design.theme.accent }}>
                  Design Direction
                </p>
                <h2 className="mt-3 text-xl font-semibold">A refined visual system</h2>
                <p className="mt-3 text-sm leading-7 opacity-70">{design.designStyle}</p>
                <div className="mt-5 flex gap-2">
                  {[design.theme.background, design.theme.surface, design.theme.accent, design.theme.text].map((c) => (
                    <span key={c} className="h-8 w-8 rounded-full border border-white/10 shadow-inner" style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={reduce ? {} : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.08 }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: design.theme.accent }}>
                  Layout
                </p>
                <h2 className="mt-3 text-xl font-semibold">Built around hierarchy</h2>
                <p className="mt-3 text-sm leading-7 opacity-70">{design.layout}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 opacity-60">
                  <div className="h-16 rounded-xl border" style={{ borderColor: `${design.theme.text}15`, backgroundColor: `${design.theme.text}08` }} />
                  <div className="h-16 rounded-xl border" style={{ borderColor: `${design.theme.text}15`, backgroundColor: `${design.theme.text}08` }} />
                  <div className="h-16 rounded-xl border" style={{ borderColor: `${design.theme.text}15`, backgroundColor: `${design.theme.text}08` }} />
                </div>
              </motion.div>
            </div>
          </section>

          {/* ---------- Recommendations ---------- */}
          <section className="px-6 py-10 md:px-10 md:py-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: design.theme.accent }}>
                  AI Recommendations
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-[28px]">What changed</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 opacity-60">
                  Applied directly from the visual audit — practical, shippable fixes.
                </p>
              </div>
              <span className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: `${design.theme.text}15`, color: `${design.theme.text}99` }}>
                {design.improvements.length} improvements
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {design.improvements.map((item, i) => (
                <motion.article
                  key={`${i}-${item.slice(0, 20)}`}
                  initial={reduce ? {} : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.45 }}
                  whileHover={reduce ? {} : { y: -2 }}
                  className="group rounded-2xl border p-4 transition hover:shadow-lg md:p-5"
                  style={{ borderColor: `${design.theme.text}13`, backgroundColor: design.theme.surface }}
                >
                  <div className="flex gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: design.theme.accent, color: design.theme.background }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm leading-6 opacity-80">{item}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>

          {/* ---------- Footer CTA ---------- */}
          <section className="border-t px-6 py-10 text-center md:px-10 md:py-12" style={{ borderColor: `${design.theme.text}12`, backgroundColor: design.theme.surface }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: design.theme.accent }}>
              ReDesignAI
            </p>
            <h2 className="mx-auto mt-3 max-w-xl text-2xl font-semibold tracking-tight md:text-3xl">Your interface, reimagined.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 opacity-60">
              Take these recommendations into production — stronger hierarchy, clearer CTAs, and a system that scales across breakpoints.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={!!regenerating}
                className="rounded-full px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.02] disabled:opacity-50"
                style={{ backgroundColor: design.theme.accent }}
              >
                {regenerating ? "Regenerating…" : "Regenerate concept"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = JSON.stringify(design, null, 2);
                  navigator.clipboard.writeText(text).catch(() => {});
                }}
                className="rounded-full border px-6 py-3 text-sm font-medium transition hover:bg-white hover:text-black"
                style={{ borderColor: `${design.theme.text}18` }}
              >
                Copy spec
              </button>
            </div>
          </section>
        </div>
      </motion.div>

      <p className="mx-auto mt-3 max-w-[720px] text-center text-[11px] leading-5 text-white/30">
        This is an AI-generated concept preview — not a pixel-perfect rebuild. Use the spec, theme tokens, and recommendations as your build brief.
      </p>
    </div>
  );
}
