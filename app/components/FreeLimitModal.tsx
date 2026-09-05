"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Polished free-limit wall shown after the 3rd anonymous redesign.
 * - Escape closes, initial focus lands on the primary CTA
 * - Respects prefers-reduced-motion via useReducedMotion
 * - callbackUrl=/redesign so users return to the studio after auth
 */
export default function FreeLimitModal({ open, onClose }: Props) {
  const reduce = useReducedMotion();
  const primaryRef = useRef<HTMLAnchorElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Minimal focus trap: keep Tab cycling inside the dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      {/* backdrop */}
      <motion.button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        initial={reduce ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      {/* card */}
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-limit-title"
        aria-describedby="free-limit-desc"
        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0f1a]/95 p-[1px] shadow-[0_32px_100px_rgba(0,0,0,0.65)] backdrop-blur-xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[130%] -translate-x-1/2 rounded-full opacity-30 blur-[60px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(34,211,238,0.5), transparent 70%)",
          }}
        />
        <div className="relative rounded-[26px] border border-white/[0.06] bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-6 py-7 md:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-lg font-bold text-black shadow-[0_0_28px_rgba(34,211,238,0.45)]">
            ✦
          </div>
          <p className="mt-5 text-center text-[11px] font-semibold tracking-[0.2em] text-cyan-300">
            FREE LIMIT REACHED
          </p>
          <h2
            id="free-limit-title"
            className="mt-2 text-center text-[22px] font-semibold leading-tight tracking-tight"
          >
            Your 3 free redesigns are complete.
          </h2>
          <p id="free-limit-desc" className="mt-2 text-center text-sm leading-6 text-white/55">
            Create a free account to keep redesigning websites with ReDesignAI.
          </p>

          {/* progress dots */}
          <div className="mt-4 flex items-center justify-center gap-2" aria-label="3 of 3 free redesigns used">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-cyan-400" aria-hidden />
            ))}
            <span className="ml-2 text-xs font-medium text-white/45">3 / 3 used</span>
          </div>

          <div className="mt-6 grid gap-2.5">
            <Link
              ref={primaryRef}
              href="/signup?callbackUrl=%2Fredesign"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Create Free Account →
            </Link>
            <Link
              href="/signin?callbackUrl=%2Fredesign"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-6 py-3.5 text-sm font-medium text-white/85 backdrop-blur transition hover:bg-white hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Sign In
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="mx-auto mt-1 rounded-full px-4 py-2 text-xs font-medium text-white/40 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Maybe Later
            </button>
          </div>
          <p className="mt-4 text-center text-[11px] leading-5 text-white/30">
            Free forever plan · No credit card · Your last redesign is still on screen
          </p>
        </div>
      </motion.div>
    </div>
  );
}
