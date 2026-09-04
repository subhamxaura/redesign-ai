"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const steps = [
  {
    n: "01",
    label: "Capture",
    title: "Upload a screenshot",
    desc: "PNG, JPG or WEBP — any website, dashboard, landing page or app screen.",
  },
  {
    n: "02",
    label: "Critique",
    title: "AI design audit",
    desc: "Hierarchy, spacing, typography, accessibility, and conversion clarity — distilled.",
  },
  {
    n: "03",
    label: "Reimagine",
    title: "Live prototype",
    desc: "A structured, themed, responsive concept you can ship or hand to engineering.",
  },
];

const signals = ["Visual hierarchy", "Responsive layout", "Accessibility", "Conversion clarity"];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function Home() {
  const reduce = useReducedMotion();
  const { data: session, status } = useSession();
  const isAuthed = !!session?.user;
  const isLoading = status === "loading";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const name = session?.user?.name ?? "Designer";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "R";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
  }

  const getStartedHref = isAuthed ? "/redesign" : "/signup";
  const heroCtaHref = isAuthed ? "/redesign" : "/signup";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070a] text-white selection:bg-cyan-400/30">
      {/* ---------- Ambient background ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#05070a]" />
        <motion.div
          initial={reduce ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute -top-[30%] left-1/2 h-[900px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(34,211,238,0.18), rgba(56,189,248,0.08) 40%, transparent 70%)",
          }}
        />
        <motion.div
          initial={reduce ? {} : { x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.2 }}
          className="absolute left-[-10%] top-[18%] h-[600px] w-[600px] rounded-full opacity-20 blur-[100px]"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%)",
          }}
        />
        <motion.div
          initial={reduce ? {} : { x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.3 }}
          className="absolute bottom-[-10%] right-[-8%] h-[700px] w-[700px] rounded-full opacity-15 blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(6,182,212,0.4), transparent 70%)",
          }}
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

      {/* ---------- Nav ---------- */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 mx-auto flex max-w-[1280px] items-center justify-between px-6 py-6 md:px-8"
      >
        <Link href="/" className="group flex items-center gap-3">
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

        {/* Desktop nav links */}
        <div className="hidden items-center gap-7 text-[13px] font-medium text-white/55 md:flex">
          {!isAuthed ? (
            <>
              <a href="#workflow" className="transition hover:text-white">
                Workflow
              </a>
              <a href="#preview" className="transition hover:text-white">
                Preview
              </a>
              <a href="#signals" className="transition hover:text-white">
                Signals
              </a>
            </>
          ) : (
            <>
              <Link href="/dashboard" className="transition hover:text-white">
                Dashboard
              </Link>
              <Link href="/redesign" className="transition hover:text-white">
                Create Redesign
              </Link>
              <Link href="/profile" className="transition hover:text-white">
                Profile
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {isLoading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" aria-label="Loading" />
          ) : !isAuthed ? (
            <>
              <Link
                href="/signin"
                className="hidden rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-white/80 backdrop-blur transition hover:bg-white hover:text-black md:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href={getStartedHref}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-zinc-100"
              >
                <span>Get Started</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] text-white transition group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur hover:bg-white hover:text-black md:inline-flex"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-bold text-black">
                  {initials}
                </span>
                {name.split(" ")[0]}
              </Link>
              <Link
                href="/redesign"
                className="hidden rounded-full bg-cyan-400 px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-cyan-300 md:inline-flex"
              >
                Open studio
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/60 backdrop-blur hover:bg-white hover:text-black disabled:opacity-50 md:inline-flex"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm backdrop-blur md:hidden"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="relative z-20 mx-6 rounded-2xl border border-white/10 bg-[#0a0f1a]/90 p-4 backdrop-blur md:hidden">
          <div className="grid gap-2 text-sm">
            {!isAuthed ? (
              <>
                <a href="#workflow" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/5">
                  Workflow
                </a>
                <a href="#preview" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/5">
                  Preview
                </a>
                <a href="#signals" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/5">
                  Signals
                </a>
                <Link href="/signin" onClick={() => setMobileOpen(false)} className="rounded-xl bg-white px-3 py-2.5 text-center font-semibold text-black">
                  Sign In
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="rounded-xl bg-cyan-400 px-3 py-2.5 text-center font-semibold text-black">
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/5">
                  Dashboard
                </Link>
                <Link href="/redesign" onClick={() => setMobileOpen(false)} className="rounded-xl bg-cyan-400 px-3 py-2.5 text-center font-semibold text-black">
                  Create Redesign
                </Link>
                <Link href="/profile" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2 hover:bg-white/5">
                  Profile
                </Link>
                <button onClick={handleSignOut} className="rounded-xl border border-white/10 px-3 py-2 text-left hover:bg-white/5">
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- Hero ---------- */}
      <section className="relative z-10 mx-auto grid max-w-[1280px] items-center gap-10 px-6 pb-10 pt-6 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:pb-16 md:pt-8 lg:gap-14">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative"
        >
          <motion.div variants={item} className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/[0.08] px-3 py-1.5 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            <span className="text-[11px] font-medium tracking-[0.14em] text-cyan-200">AI WEBSITE REDESIGN STUDIO</span>
            <span className="hidden text-[11px] text-white/40 md:inline">· Gemini powered</span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-7 text-[42px] font-[650] leading-[0.9] tracking-[-0.04em] md:text-[64px] lg:text-[72px]"
          >
            Turn a
            <br />
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">screenshot</span>
            <br />
            <span className="font-light tracking-[-0.03em] text-white/90">into direction.</span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-[520px] text-[15px] leading-7 text-white/55 md:text-[16px]">
            Upload any website. Get a ruthless, practical UI/UX critique — then watch a
            premium, responsive redesign prototype generate live.
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={heroCtaHref}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 text-[14px] font-semibold text-black shadow-[0_0_30px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300 hover:shadow-[0_0_40px_rgba(34,211,238,0.45)]"
            >
              {isAuthed ? "Open studio" : "Get Started"}
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="#workflow"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-7 py-3.5 text-[14px] font-medium text-white/80 backdrop-blur transition hover:bg-white hover:text-black"
            >
              How it works
            </a>
          </motion.div>

          {!isAuthed && (
            <motion.p variants={item} className="mt-3 text-xs text-white/30">
              No credit card required · Secure signup in 20 seconds
            </motion.p>
          )}

          <motion.div variants={item} className="mt-10 flex items-center gap-6 border-t border-white/[0.06] pt-6">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] font-semibold backdrop-blur"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-xs leading-5 text-white/45">
              Trusted for product critiques
              <br />
              <span className="font-medium text-white/75">For designers, founders, and frontend teams.</span>
            </p>
            <div className="ml-auto hidden items-center gap-2 text-[11px] font-medium tracking-widest text-white/30 md:flex">
              <span className="h-px w-8 bg-white/15" />
              SCROLL
            </div>
          </motion.div>
        </motion.div>

        {/* right: preview card */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20, rotate: 0.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-b from-cyan-400/10 via-transparent to-transparent blur-2xl" />

          <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.05] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl ring-1 ring-cyan-400/10">
            {/* subtle outer cyan glow */}
            <div aria-hidden className="pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-b from-cyan-400/10 via-transparent to-transparent blur-xl opacity-60" />
            <div className="relative overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0d1d35] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0f2544]/60 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] shadow-[0_0_0_1px_rgba(0,0,0,0.2)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] shadow-[0_0_0_1px_rgba(0,0,0,0.2)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] shadow-[0_0_0_1px_rgba(0,0,0,0.2)]" />
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
                  <span className="relative flex h-2 w-2">
                    {!reduce && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />}
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-[11px] font-semibold tracking-wide text-emerald-200">AI Preview — Live</span>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="hidden h-6 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-black shadow-sm sm:inline-flex">Export</span>
                </div>
              </div>

              <div className="relative bg-gradient-to-b from-[#0d1d35] via-[#0d1d35] to-[#0a162c] p-4 md:p-5">
                {!reduce && (
                  <motion.div
                    initial={{ top: "0%" }}
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                    className="pointer-events-none absolute inset-x-4 h-px bg-gradient-to-r from-transparent via-cyan-400/45 to-transparent"
                  />
                )}

                {/* Main AI headline */}
                <div className="rounded-2xl border border-white/[0.09] bg-white/[0.07] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-[15px] font-semibold tracking-tight text-white">Analyzing your screenshot…</h3>
                      <p className="mt-1 text-[13px] leading-5 text-white/65">Our AI is breaking down your design</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-cyan-200">
                      Step 2 of 4
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium tracking-wide text-white/45">Progress</span>
                      <span className="font-semibold text-white">50%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "50%" }}
                        transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Analysis steps */}
                <div className="mt-4 space-y-2.5">
                  {[
                    {
                      icon: "✓",
                      iconBg: "bg-emerald-400 text-black",
                      title: "Understanding the layout",
                      desc: "Detecting sections, components, and structure",
                      status: "Completed",
                      statusColor: "text-emerald-300",
                    },
                    {
                      icon: "◉",
                      iconBg: "bg-cyan-400 text-black animate-pulse",
                      title: "Analyzing visual hierarchy",
                      desc: "Identifying key content and focus areas",
                      status: "In progress",
                      statusColor: "text-cyan-300",
                    },
                    {
                      icon: "○",
                      iconBg: "bg-white/10 text-white/40 border border-white/10",
                      title: "Evaluating UI/UX patterns",
                      desc: "Finding usability issues and opportunities",
                      status: "Queued",
                      statusColor: "text-white/35",
                    },
                    {
                      icon: "○",
                      iconBg: "bg-white/10 text-white/40 border border-white/10",
                      title: "Generating redesign concept",
                      desc: "Creating a modern responsive prototype",
                      status: "Queued",
                      statusColor: "text-white/35",
                    },
                  ].map((step, i) => (
                    <motion.div
                      key={step.title}
                      initial={reduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.08, duration: 0.4 }}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${i === 1 ? "border-cyan-400/20 bg-cyan-400/[0.06] shadow-[0_0_20px_rgba(34,211,238,0.08)]" : "border-white/[0.07] bg-white/[0.04]"}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${step.iconBg}`}>
                        {step.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13px] font-semibold leading-none ${i <= 1 ? "text-white" : "text-white/70"}`}>{step.title}</p>
                        <p className="mt-1 truncate text-[12px] leading-none text-white/45">{step.desc}</p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-medium ${step.statusColor}`}>{step.status}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Metrics grid — realistic analysis visuals */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Visual hierarchy", value: 85 },
                    { label: "Responsive layout", value: 78 },
                    { label: "Accessibility", value: 92 },
                    { label: "Conversion clarity", value: 76 },
                  ].map((m, i) => (
                    <motion.div
                      key={m.label}
                      initial={reduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.65 + i * 0.07 }}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-medium leading-tight text-white/80">{m.label}</p>
                        <span className="text-[12px] font-bold text-white">{m.value}%</span>
                      </div>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${m.value}%` }}
                          transition={{ duration: 1, delay: 0.95 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                          className={`h-full rounded-full ${m.value >= 90 ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" : m.value >= 80 ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" : "bg-sky-400"}`}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* AI Insight card */}
                <motion.div
                  initial={reduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.95, duration: 0.45 }}
                  className="mt-4 flex gap-3 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] via-white/[0.04] to-white/[0.02] p-4 shadow-[0_4px_20px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-[14px] text-black shadow-sm">
                    💡
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold tracking-wide text-cyan-200">AI Insight</p>
                    <p className="mt-1 text-[13px] font-medium leading-5 text-white/85">
                      “We’re identifying what works, what doesn’t, and how to make it better.”
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={reduce ? {} : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="absolute -bottom-3 -left-3 hidden items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0f1a]/90 px-4 py-3 shadow-xl backdrop-blur md:flex"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-sm">✓</span>
              <div>
                <p className="text-xs font-semibold">Analysis complete</p>
                <p className="text-[11px] text-white/50">6 improvements detected</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ---------- Workflow ---------- */}
      <section id="workflow" className="relative z-10 mx-auto max-w-[1280px] px-6 py-16 md:px-8 md:py-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-cyan-300">WORKFLOW</p>
            <h2 className="mt-3 max-w-[560px] text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[42px]">
              A short path from critique to usable direction.
            </h2>
          </div>
          <p className="max-w-[360px] text-sm leading-6 text-white/50">
            No prompts to engineer. No Figma to wrestle. Upload — audit — prototype. In under a minute.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.article
              key={s.n}
              initial={reduce ? {} : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              whileHover={reduce ? {} : { y: -4 }}
              className="group relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur transition hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent opacity-0 transition group-hover:opacity-100" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300">{s.n} — {s.label}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs transition group-hover:bg-white group-hover:text-black">
                    →
                  </span>
                </div>
                <h3 className="mt-6 text-[18px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{s.desc}</p>
                <div className="mt-6 h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
                <div className="mt-4 flex items-center gap-2 text-[11px] font-medium tracking-wide text-white/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  Step {s.n}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ---------- Live preview teaser ---------- */}
      <section id="preview" className="relative z-10 mx-auto max-w-[1280px] px-6 pb-16 md:px-8">
        <div className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-1 backdrop-blur">
          <div className="rounded-[22px] border border-white/[0.06] bg-[#05070a] px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-cyan-300">WHAT YOU GET</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Not a mockup. A direction you can build.</h3>
                <p className="mt-3 max-w-[560px] text-sm leading-6 text-white/55">
                  Every redesign ships as a structured spec — theme, copy, layout rules, and prioritized recommendations — and renders as a live, responsive prototype.
                </p>
                <ul className="mt-6 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                  {["Theme & color system", "Copy & CTA hierarchy", "Layout & spacing rules", "Accessibility fixes"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/15 text-[10px] text-cyan-300">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 flex-col gap-3">
                <Link
                  href={getStartedHref}
                  className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-100"
                >
                  {isAuthed ? "Go to studio →" : "Open studio →"}
                </Link>
                <p className="text-center text-[11px] tracking-wide text-white/35">PNG · JPG · WEBP · Max 10MB</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Signals ---------- */}
      <section id="signals" className="relative z-10 border-t border-white/[0.06] bg-white/[0.02] backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-6 py-8 md:px-8">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-white/30">SIGNALS ANALYZED</span>
          <span className="hidden h-4 w-px bg-white/10 md:block" />
          <div className="flex flex-wrap gap-2">
            {[...signals, "Typography rhythm", "Color system", "CTA clarity", "Motion"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur"
              >
                {s}
              </span>
            ))}
          </div>
          <span className="ml-auto hidden items-center gap-2 text-xs text-white/30 md:flex">
            © {new Date().getFullYear()} ReDesignAI
          </span>
        </div>
      </section>
    </main>
  );
}
