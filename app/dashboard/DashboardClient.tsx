"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { signOut } from "next-auth/react";
import { useState } from "react";

type Props = {
  user: { name: string; email: string; createdAt: string | null };
  redesigns: Array<{ id: string; createdAt: string; title: string }>;
};

export default function DashboardClient({ user, redesigns }: Props) {
  const reduce = useReducedMotion();
  const [signingOut, setSigningOut] = useState(false);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "R";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070a] text-white">
      {/* ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[30%] left-1/2 h-[900px] w-[1100px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]" style={{ background: "radial-gradient(ellipse at center, rgba(34,211,238,0.22), transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1280px] px-6 py-6 md:px-8">
        {/* top */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[11px] font-bold tracking-widest text-black">R</span>
            <span className="text-sm font-semibold tracking-tight">ReDesign<span className="font-light text-cyan-300">AI</span></span>
            <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] tracking-widest text-white/60 md:inline-flex">STUDIO</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/profile" className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur hover:bg-white hover:text-black md:inline-flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-bold text-black">{initials}</span>
              {user.name}
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur hover:bg-white hover:text-black disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>

        {/* hero */}
        <motion.div
          initial={reduce ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-1 backdrop-blur"
        >
          <div className="rounded-[22px] border border-white/[0.06] bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-6 py-8 md:px-8 md:py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300">DASHBOARD</p>
                <h1 className="mt-3 text-[28px] font-semibold leading-[0.95] tracking-[-0.03em] md:text-[36px]">
                  Welcome back, {user.name.split(" ")[0]}.
                </h1>
                <p className="mt-3 max-w-[560px] text-sm leading-6 text-white/55">
                  Your private workspace for audits and redesigns. Create a new concept in under a minute — history and specs stay with your account.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/45">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">{user.email}</span>
                  {user.createdAt && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Member since {new Date(user.createdAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <Link href="/redesign" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300">
                  Create New Redesign →
                </Link>
                <Link href="/profile" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-7 py-3.5 text-sm font-medium text-white/80 backdrop-blur hover:bg-white hover:text-black">
                  Account settings
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: "Workspace", value: "Private", hint: "Encrypted session · JWT" },
            { label: "Model", value: "Gemini 3.6 Flash", hint: "Latest structured output" },
            { label: "History", value: redesigns.length === 0 ? "—" : String(redesigns.length), hint: redesigns.length === 0 ? "No projects yet" : "Recent concepts" },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={reduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur"
            >
              <p className="text-xs font-semibold tracking-[0.14em] text-white/40">{c.label.toUpperCase()}</p>
              <p className="mt-2 text-lg font-semibold">{c.value}</p>
              <p className="mt-1 text-xs text-white/45">{c.hint}</p>
            </motion.div>
          ))}
        </div>

        {/* recent */}
        <motion.section
          initial={reduce ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Recent redesigns</h2>
              <p className="text-xs text-white/45">Your generated concepts — stored per-account when history is enabled.</p>
            </div>
            <Link href="/redesign" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-100">
              + New
            </Link>
          </div>

          {redesigns.length === 0 ? (
            <div className="px-6 py-12 text-center md:px-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <span className="text-white/60">◇</span>
              </div>
              <h3 className="mt-4 text-base font-semibold">No redesigns yet.</h3>
              <p className="mx-auto mt-2 max-w-[480px] text-sm leading-6 text-white/50">
                Upload your first website and let AI transform it. Your audit, theme, copy and recommendations will appear here.
              </p>
              <Link
                href="/redesign"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-black hover:bg-cyan-300"
              >
                Create Your First Redesign →
              </Link>
              <p className="mx-auto mt-4 max-w-[520px] text-[11px] leading-5 text-white/30">
                Architecture note: history is wired for persistence (userId, projectId, createdAt, analysis, spec) but stores only lightweight metadata — raw images are not saved to the database.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {redesigns.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-white/45">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <div className="mx-auto mt-6 flex max-w-[720px] justify-center gap-4 text-xs text-white/30">
          <Link href="/profile" className="hover:text-white">Profile</Link>
          <span>·</span>
          <Link href="/" className="hover:text-white">Home</Link>
          <span>·</span>
          <a href="#workflow" className="hover:text-white">Workflow</a>
        </div>
      </div>
    </main>
  );
}
