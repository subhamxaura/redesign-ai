export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070a] text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
        <p className="text-sm text-white/50">Loading ReDesignAI…</p>
      </div>
    </div>
  );
}
