"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { signOut } from "next-auth/react";
import { useState } from "react";

type Props = {
  user: { name: string; email: string; createdAt: string | null; id: string };
};

export default function ProfileClient({ user }: Props) {
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
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[25%] left-1/2 h-[700px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]" style={{ background: "radial-gradient(ellipse at center, rgba(34,211,238,0.22), transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[960px] px-6 py-6 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs">←</span>
            Back to dashboard
          </Link>
          <Link href="/" className="text-sm text-white/60 hover:text-white">Home</Link>
        </div>

        <motion.div
          initial={reduce ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mt-8 max-w-[720px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-1 backdrop-blur"
        >
          <div className="rounded-[24px] border border-white/[0.06] bg-[#0a0f1a]/80 p-6 md:p-8">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-lg font-bold tracking-widest text-black">
                {initials}
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300">ACCOUNT</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">{user.name}</h1>
                <p className="mt-1 text-sm text-white/50">{user.email}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <Link href="/redesign" className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-black hover:bg-cyan-300">
                  Open studio
                </Link>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold tracking-widest text-white/40">EMAIL</p>
                <p className="mt-2 text-sm font-medium">{user.email}</p>
                <p className="mt-1 text-xs text-white/40">Used for sign-in · cannot be changed in this version</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold tracking-widest text-white/40">MEMBERSHIP</p>
                <p className="mt-2 text-sm font-medium">ReDesignAI Studio</p>
                <p className="mt-1 text-xs text-white/40">
                  {user.createdAt ? `Joined ${new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}` : "Account active"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold tracking-widest text-white/40">USER ID</p>
                <p className="mt-2 break-all font-mono text-xs text-white/60">{user.id}</p>
                <p className="mt-1 text-xs text-white/40">Internal identifier · safe to share with support</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold tracking-widest text-white/40">SECURITY</p>
                <p className="mt-2 text-sm font-medium">Bcrypt · JWT · HttpOnly</p>
                <p className="mt-1 text-xs text-white/40">Sessions are signed, cookies are HttpOnly, CSRF protected</p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold">Account settings</h3>
              <p className="mt-1 text-xs leading-5 text-white/45">
                Password change and team management are coming soon. For now you can sign out or continue creating redesigns. Your screenshots are transient and not stored permanently.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/dashboard" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium hover:bg-white hover:text-black">
                  Dashboard
                </Link>
                <Link href="/redesign" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium hover:bg-white hover:text-black">
                  Create redesign
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-100 disabled:opacity-50"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <p className="mx-auto mt-6 max-w-[720px] text-center text-[11px] leading-5 text-white/30">
          Need help? Contact support — include your user ID for faster debugging. Never share your password.
        </p>
      </div>
    </main>
  );
}
