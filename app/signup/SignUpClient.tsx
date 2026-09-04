"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { signIn } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import AuthShell from "@/app/components/AuthShell";

function safeCallback(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.includes("\\") || value.includes(":") || value.includes("..")) return "/dashboard";
  return value;
}

export default function SignUpClient() {
  const router = useRouter();
  const params = useSearchParams();
  const reduce = useReducedMotion();

  const callbackUrl = useMemo(() => safeCallback(params.get("callbackUrl")), [params]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    const n = name.trim();
    const em = email.trim().toLowerCase();

    if (!n || n.length < 2) return setError("Name must be at least 2 characters.");
    if (n.length > 60) return setError("Name must be 60 characters or fewer.");
    if (!em) return setError("Please enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setError("Please enter a valid email address.");
    if (!password) return setError("Password is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password.length > 128) return setError("Password must be 128 characters or fewer.");
    if (confirm !== password) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, email: em, password, confirmPassword: confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to create account.");
      }

      // Auto sign in after signup
      const signRes = await signIn("credentials", {
        email: em,
        password,
        redirect: false,
        callbackUrl,
      });
      if (!signRes) throw new Error("Account created, but sign-in failed. Please sign in.");
      if (signRes.error) {
        router.push(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      router.push(signRes.url ?? callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your studio."
      subtitle="One account for every redesign — audits, previews, and implementation specs, all in your private workspace."
    >
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-[1px] backdrop-blur-xl">
        <div className="rounded-[26px] border border-white/[0.06] bg-[#0a0f1a]/80 p-6 md:p-8">
          <div className="mb-6">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300">CREATE ACCOUNT</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Join ReDesignAI</h2>
            <p className="mt-1 text-sm text-white/50">
              Already have an account?{" "}
              <Link href={`/signin${params.get("callbackUrl") ? `?callbackUrl=${encodeURIComponent(safeCallback(params.get("callbackUrl")))}` : ""}`} className="font-medium text-cyan-300 hover:text-cyan-200">
                Sign in
              </Link>
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="text-xs font-medium tracking-wide text-white/70">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-cyan-400/50 focus:bg-white/[0.06]"
              />
            </div>

            <div>
              <label htmlFor="email" className="text-xs font-medium tracking-wide text-white/70">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-cyan-400/50 focus:bg-white/[0.06]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium tracking-wide text-white/70">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="text-xs font-medium text-white/40 hover:text-white/70"
                  aria-label={show ? "Hide passwords" : "Show passwords"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-cyan-400/50 focus:bg-white/[0.06]"
              />
              <p className="mt-1.5 text-xs text-white/35">Must be at least 8 characters. Longer is stronger.</p>
            </div>

            <div>
              <label htmlFor="confirm" className="text-xs font-medium tracking-wide text-white/70">
                Confirm password
              </label>
              <input
                id="confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-cyan-400/50 focus:bg-white/[0.06]"
              />
            </div>

            {error && (
              <motion.div
                initial={reduce ? {} : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                aria-live="polite"
                className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-100"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={reduce ? {} : { scale: loading ? 1 : 1.01 }}
              whileTap={reduce ? {} : { scale: 0.99 }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black shadow-lg transition hover:bg-zinc-100 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Creating account…
                </>
              ) : (
                "Create account →"
              )}
            </motion.button>

            <p className="text-center text-xs leading-5 text-white/30">
              By creating an account you agree to our Terms and Privacy Policy.
            </p>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}
