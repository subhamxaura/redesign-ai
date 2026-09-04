"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#05070a] text-white">
      {/* ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#05070a]" />
        <motion.div
          initial={reduce ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute -top-[30%] left-1/2 h-[860px] w-[1100px] -translate-x-1/2 rounded-full opacity-[0.32] blur-[120px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(34,211,238,0.22), rgba(56,189,248,0.08) 38%, transparent 70%)",
          }}
        />
        <motion.div
          initial={reduce ? {} : { x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.15 }}
          className="absolute left-[-12%] top-[18%] h-[560px] w-[560px] rounded-full opacity-20 blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.32), transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#05070a]" />
      </div>

      {/* top bar */}
      <div className="relative z-20 flex w-full flex-col">
        <nav className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-6 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[11px] font-bold tracking-widest text-black">
              R
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              ReDesign<span className="font-light text-cyan-300">AI</span>
            </span>
            <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-widest text-white/60 md:inline-flex">
              STUDIO
            </span>
          </Link>
          <Link href="/" className="text-sm text-white/60 transition hover:text-white">
            ← Back to home
          </Link>
        </nav>

        <div className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-1 gap-8 px-6 pb-10 pt-2 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-8 md:py-8">
          {/* left copy */}
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="hidden max-w-[520px] md:block"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/[0.08] px-3 py-1.5 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              <span className="text-[11px] font-medium tracking-[0.14em] text-cyan-200">SECURE WORKSPACE</span>
            </div>
            <h1 className="mt-6 text-[40px] font-semibold leading-[0.92] tracking-[-0.04em] md:text-[48px]">
              {title}
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-white/55">{subtitle}</p>

            <div className="mt-8 grid gap-3">
              {[
                { k: "Encrypted", v: "Passwords hashed with bcrypt · HttpOnly JWT cookies" },
                { k: "Private", v: "Your screenshots never leave your session. No public indexing." },
                { k: "Fast", v: "Gemini-powered audit in seconds — tuned for real product work." },
              ].map((i) => (
                <div key={i.k} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 backdrop-blur">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[11px] text-cyan-300">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-medium">{i.k}</p>
                    <p className="text-xs leading-5 text-white/50">{i.v}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* card */}
          <motion.div
            initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-[480px]"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
