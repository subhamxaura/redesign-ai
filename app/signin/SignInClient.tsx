"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { signIn } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import AuthShell from "@/app/components/AuthShell";
import { safeCallbackPath } from "@/app/lib/redirects";

function safeCallback(value: string | null): string {
  return safeCallbackPath(value);
}

export default function SignInClient() {
  const router = useRouter();
  const params = useSearchParams();
  const reduce = useReducedMotion();

  const callbackUrl = useMemo(() => safeCallback(params.get("callbackUrl")), [params]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");

    const em = email.trim().toLowerCase();
    if (!em) return setError("Please enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setError("Please enter a valid email address.");
    if (!password) return setError("Please enter your password.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (new TextEncoder().encode(password).length > 72) {
      return setError("Password must be 72 bytes or fewer.");
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: em,
        password,
        redirect: false,
        callbackUrl,
      });
      if (!res) throw new Error("Something went wrong. Please try again.");
      if (res.error) {
        // Generic message to avoid enumeration
        setError("Email or password is incorrect.");
        return;
      }
      // success
      router.push(res.url ?? callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back."
      subtitle="Sign in to continue your redesign workspace. Your sessions are encrypted and your screenshots stay private."
    >
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-[1px] backdrop-blur-xl">
        <div className="rounded-[26px] border border-white/[0.06] bg-[#0a0f1a]/80 p-6 md:p-8">
          <div className="mb-6">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300">SIGN IN</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight">Access your studio</h2>
            <p className="mt-1 text-sm text-white/50">
              New to ReDesignAI?{" "}
              <Link href={`/signup${params.get("callbackUrl") ? `?callbackUrl=${encodeURIComponent(safeCallback(params.get("callbackUrl")))}` : ""}`} className="font-medium text-cyan-300 hover:text-cyan-200">
                Create account
              </Link>
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Signing in…
                </>
              ) : (
                "Sign in →"
              )}
            </motion.button>

            <p className="text-center text-xs leading-5 text-white/30">
              Secure session · HttpOnly cookie · CSRF protected
            </p>
          </form>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-[480px] text-center text-[11px] leading-5 text-white/30">
        Protected by NextAuth. Passwords are hashed with bcrypt and never stored in plain text.
      </p>
    </AuthShell>
  );
}
