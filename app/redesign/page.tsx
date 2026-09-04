"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Chat from "../components/Chat";
import RedesignPreview from "../components/RedesignPreview";
import { coerceRedesignSpec, type RedesignSpec } from "@/app/lib/redesign";

type ApiResponse = { analysis?: unknown; redesign?: unknown; error?: unknown };

const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
const maxFileSize = 10 * 1024 * 1024;

const processingSteps = [
  "Analyzing visual hierarchy…",
  "Detecting layout patterns…",
  "Evaluating typography…",
  "Identifying UX problems…",
  "Generating redesign…",
];

async function readJson(r: Response): Promise<ApiResponse> {
  try { return (await r.json()) as ApiResponse; } catch { return {}; }
}
function getApiError(d: ApiResponse, fallback: string) {
  return typeof d.error === "string" ? d.error : fallback;
}

export default function RedesignPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [redesign, setRedesign] = useState<RedesignSpec | null>(null);
  const [phase, setPhase] = useState<"" | "analyzing" | "generating">("");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string>("");
  const reduce = useReducedMotion();

  const loading = phase !== "";
  const busy = loading || regenerating;

  // cycle processing text without cascading setState in effect body
  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % processingSteps.length);
    }, 1200);
    return () => window.clearInterval(id);
  }, [loading]);

  // revoke object URLs
  useEffect(() => {
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  function setImage(nextFile: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    objectUrlRef.current = url;
    setFile(nextFile);
    setFileName(nextFile.name);
    setImageUrl(url);
    setAnalysis("");
    setRedesign(null);
    setError("");
  }

  function validateAndSet(f: File | null | undefined, resetInput?: HTMLInputElement | null) {
    if (!f) return;
    if (!allowedTypes.includes(f.type)) {
      setError("Please upload a PNG, JPG, or WEBP image.");
      if (resetInput) resetInput.value = "";
      return;
    }
    if (f.size > maxFileSize) {
      setError("Image must be smaller than 10MB.");
      if (resetInput) resetInput.value = "";
      return;
    }
    setImage(f);
    if (resetInput) resetInput.value = "";
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    validateAndSet(f, e.target);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    validateAndSet(f);
  }

  function handleRemove() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
    setFile(null);
    setFileName("");
    setImageUrl("");
    setAnalysis("");
    setRedesign(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runFlow(opts?: { regenerate?: boolean }) {
    if (!file) { setError("Please select a website screenshot first."); return; }
    const isRegen = !!opts?.regenerate;

    if (isRegen) setRegenerating(true);
    else {
      setError("");
      setAnalysis("");
      setRedesign(null);
      setStepIndex(0);
      setPhase("analyzing");
    }

    try {
      // if regenerating and we already have analysis, skip analyze
      let nextAnalysis = analysis;

      if (!isRegen || !nextAnalysis) {
        if (!isRegen) setPhase("analyzing");
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/analyze", { method: "POST", body: fd });
        const data = await readJson(res);
        if (!res.ok) throw new Error(getApiError(data, "Failed to analyze the screenshot."));
        nextAnalysis = typeof data.analysis === "string" ? data.analysis.trim() : "";
        if (!nextAnalysis) throw new Error("Gemini returned no analysis text.");
        setAnalysis(nextAnalysis);
        if (!isRegen) setPhase("generating");
      } else {
        // regenerating with existing analysis
        setRegenerating(true);
      }

      const rfd = new FormData();
      rfd.append("image", file);
      rfd.append("analysis", nextAnalysis);

      // use /api/generate (uses image + analysis) - keep existing contract
      const redesignRes = await fetch("/api/generate", { method: "POST", body: rfd });
      const redesignData = await readJson(redesignRes);
      if (!redesignRes.ok) throw new Error(getApiError(redesignData, "Failed to generate the redesign."));
      if (!redesignData.redesign) throw new Error("Gemini returned no redesign data.");
      setRedesign(coerceRedesignSpec(redesignData.redesign));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Something went wrong while processing the screenshot.");
    } finally {
      setPhase("");
      setRegenerating(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070a] text-white">
      {/* ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[40%] left-1/2 h-[900px] w-[1200px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]" style={{ background: "radial-gradient(ellipse at center, rgba(34,211,238,0.5), transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1280px] px-6 py-6 md:px-8 md:py-8">
        {/* top bar */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs">←</span>
            Back to home
          </Link>
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/50 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Studio mode
          </span>
        </div>

        <header className="mt-8 max-w-3xl">
          <motion.p initial={reduce ? {} : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-semibold tracking-[0.2em] text-cyan-300">
            REDESIGNAI STUDIO
          </motion.p>
          <motion.h1 initial={reduce ? {} : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mt-3 text-[32px] font-bold leading-[0.95] tracking-[-0.03em] md:text-[48px]">
            Upload a website screenshot.
          </motion.h1>
          <motion.p initial={reduce ? {} : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="mt-4 max-w-2xl text-[15px] leading-7 text-white/55">
            Get a focused UI/UX audit — then a structured, themed, responsive redesign you can hand to engineering.
          </motion.p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[400px_1fr] xl:grid-cols-[420px_1fr]">
          {/* Left panel */}
          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            {/* Upload card */}
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative overflow-hidden rounded-[18px] border bg-black/20 p-5 transition ${dragOver ? "border-cyan-400/50 bg-cyan-400/[0.06] shadow-[0_0_30px_rgba(34,211,238,0.15)]" : "border-white/10 hover:border-white/15"}`}
              >
                {/* scanning glow when file present */}
                {file && !reduce && (
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "200%" }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
                    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent"
                  />
                )}

                <input
                  ref={fileInputRef}
                  id="website-screenshot"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                  aria-label="Upload website screenshot"
                />

                {!file ? (
                  <label htmlFor="website-screenshot" className="flex cursor-pointer flex-col items-center py-6 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white text-black shadow">
                      <span className="text-[11px] font-bold tracking-widest">IMG</span>
                    </span>
                    <span className="mt-4 text-[15px] font-semibold">Drop a screenshot here</span>
                    <span className="mt-1 text-xs text-white/45">or click to browse · PNG, JPG, WEBP · Max 10MB</span>
                    <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-100">
                      Browse files
                    </span>
                    <span className={`mt-4 text-xs font-medium ${dragOver ? "text-cyan-300" : "text-white/30"}`}>
                      {dragOver ? "Release to upload" : "Drag & drop supported"}
                    </span>
                  </label>
                ) : (
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                      <img src={imageUrl} alt="Selected screenshot preview" className="h-[220px] w-full object-cover object-top" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                        <span className="truncate rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                          {fileName}
                        </span>
                        <span className="shrink-0 rounded-full bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-black">✓ Ready</span>
                      </div>
                      {/* scanning line */}
                      {!reduce && busy && (
                        <motion.div
                          initial={{ top: 0 }}
                          animate={{ top: ["0%", "100%"] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-x-0 h-px bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.9)]"
                        />
                      )}
                    </div>

                    <div className="flex gap-2">
                      <label htmlFor="website-screenshot" className="flex flex-1 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white hover:text-black">
                        Replace
                      </label>
                      <button type="button" onClick={handleRemove} className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white hover:text-black">
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => runFlow()}
                disabled={!file || busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy && !regenerating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    {processingSteps[stepIndex]}
                  </>
                ) : regenerating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    Regenerating…
                  </>
                ) : (
                  <>Analyze and redesign →</>
                )}
              </button>

              {/* status */}
              <AnimatePresence>
                {busy && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-40" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                        </span>
                        {phase === "analyzing" ? "Analyzing screenshot…" : phase === "generating" ? "Generating redesign…" : "Working…"}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
                        <motion.div
                          initial={{ width: "18%" }}
                          animate={{ width: ["18%", "86%", "38%", "92%"] }}
                          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                          className="h-full rounded-full bg-cyan-400"
                        />
                      </div>
                      <p className="mt-2 text-xs text-white/50">{processingSteps[stepIndex]}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm leading-6 text-red-100">
                  {error}
                </motion.div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5 text-white/50">PNG · JPG · WEBP</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5 text-white/50">Max 10MB</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1.5 text-white/50">Any website</span>
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <p className="text-xs font-semibold tracking-widest text-white/40">OUTPUT INCLUDES</p>
              <ul className="mt-3 grid gap-2 text-sm text-white/65">
                {["Design audit & UX problems", "Practical UI recommendations", "Live redesign preview", "Developer implementation plan"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Right content */}
          <section className="min-w-0 space-y-6">
            {!analysis && !loading && !regenerating && !redesign && (
              <motion.div initial={reduce ? {} : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur md:p-8">
                <p className="inline-flex rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-widest text-cyan-200">READY</p>
                <h2 className="mt-4 text-xl font-semibold leading-tight md:text-2xl">Your analysis and redesign will appear here.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                  Use a screenshot that clearly shows navigation, hierarchy, and key content. The AI will critique it and generate a theme-aware prototype.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    { k: "01", t: "Upload", d: "Pick a clear, high-resolution capture." },
                    { k: "02", t: "Analyze", d: "Gemini audits layout, type, color & a11y." },
                    { k: "03", t: "Preview", d: "A live, responsive concept renders instantly." },
                  ].map((c) => (
                    <div key={c.k} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-semibold tracking-widest text-cyan-300">{c.k}</p>
                      <p className="mt-1 text-sm font-semibold">{c.t}</p>
                      <p className="mt-1 text-xs leading-5 text-white/50">{c.d}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {(loading || regenerating) && !analysis && !redesign && (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
                <div className="mx-auto max-w-md text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-black/15 border-t-black" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-white">{processingSteps[stepIndex]}</p>
                  <p className="mt-1 text-xs text-white/45">This usually takes 8–20 seconds · Please keep this tab open</p>
                  <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      className="h-full w-1/3 rounded-full bg-cyan-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {analysis && (
              <motion.section
                initial={reduce ? {} : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur"
              >
                <div className="border-b border-white/10 bg-white/[0.02] px-6 py-4 md:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300">AI ANALYSIS</p>
                      <h2 className="mt-1 text-lg font-semibold">Design audit</h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/50">Markdown rendered</span>
                  </div>
                </div>

                <div className="px-6 py-6 md:px-8">
                  <div className="prose prose-invert max-w-none prose-headings:tracking-tight prose-p:leading-7 prose-li:leading-7 prose-strong:text-white">
                    <ReactMarkdown
                      components={{
                        h2: ({ children }) => <h2 className="mt-8 border-l-2 border-cyan-400 pl-3 text-[18px] font-semibold text-white first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="mt-6 text-[15px] font-semibold text-cyan-100">{children}</h3>,
                        p: ({ children }) => <p className="mt-3 text-sm leading-7 text-white/70">{children}</p>,
                        ul: ({ children }) => <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/70">{children}</ul>,
                        ol: ({ children }) => <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/70">{children}</ol>,
                        li: ({ children }) => <li className="pl-1 leading-7 marker:text-cyan-300">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                        em: ({ children }) => <em className="text-white/80">{children}</em>,
                        code: ({ children }) => <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-cyan-200">{children}</code>,
                        pre: ({ children }) => <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-6">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="mt-4 border-l-2 border-white/15 pl-4 text-white/60">{children}</blockquote>,
                        hr: () => <hr className="my-6 border-white/10" />,
                      }}
                    >
                      {analysis}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.section>
            )}

            {(loading || regenerating) && analysis && !redesign && (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
                  <div>
                    <p className="text-sm font-medium">{regenerating ? "Regenerating concept…" : "Generating redesign…"}</p>
                    <p className="text-xs text-white/50">{processingSteps[stepIndex]}</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div animate={{ x: ["-100%", "120%"] }} transition={{ duration: 1.2, repeat: Infinity }} className="h-full w-1/2 rounded-full bg-cyan-400" />
                </div>
              </div>
            )}

            {redesign && (
              <motion.section initial={reduce ? {} : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300">LIVE REDESIGN</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">Generated concept preview</h2>
                    <p className="mt-1 text-xs text-white/45">Theme-aware · Responsive · Shippable</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runFlow({ regenerate: true })}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    <span className={`h-3 w-3 rounded-full border-2 border-black/20 border-t-black ${regenerating ? "animate-spin" : "hidden"}`} />
                    Generate another
                  </button>
                </div>

                <RedesignPreview design={redesign} imageUrl={imageUrl} onRegenerate={() => runFlow({ regenerate: true })} regenerating={regenerating} />
              </motion.section>
            )}
          </section>
        </div>
      </div>

      <Chat />
    </main>
  );
}
