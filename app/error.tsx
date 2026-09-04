"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05070a] px-6 text-center text-white">
      <div className="max-w-md rounded-[24px] border border-white/10 bg-white/[0.04] p-8 backdrop-blur">
        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300">SOMETHING WENT WRONG</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">We hit a snag.</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">
          An unexpected error occurred. Your work is safe — try again.
        </p>
        {error.digest && <p className="mt-2 text-xs text-white/30">Ref: {error.digest}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-100"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/80 hover:bg-white hover:text-black"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
