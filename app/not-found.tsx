import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#05070a] px-6 text-center text-white">
      <div className="max-w-md rounded-[24px] border border-white/10 bg-white/[0.04] p-8 backdrop-blur">
        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page not found.</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">
          The page you’re looking for doesn’t exist or was moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-100"
        >
          Back to home →
        </Link>
      </div>
    </div>
  );
}
