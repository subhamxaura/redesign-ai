export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="text-xl font-semibold">
          ReDesign<span className="text-purple-500">AI</span>
        </div>

        <div className="hidden gap-8 text-sm text-gray-400 md:flex">
          <a href="#features" className="hover:text-white">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-white">
            How it works
          </a>
        </div>

        <button className="rounded-full border border-white/10 px-5 py-2 text-sm hover:bg-white hover:text-black">
          Get Started
        </button>
      </nav>

      {/* Hero */}
      <section className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-sm text-purple-300">
          ✦ AI-powered website redesign
        </div>

        <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
          Your website.
          <br />
          <span className="text-purple-500">Reimagined by AI.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-400">
          Upload your website screenshot and let ReDesign AI analyze,
          redesign, and transform your interface into a modern experience.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <button className="rounded-full bg-white px-7 py-3 font-medium text-black transition hover:scale-105">
            Start Redesigning →
          </button>

          <button className="rounded-full border border-white/10 px-7 py-3 text-gray-300 transition hover:bg-white/5">
            See how it works
          </button>
        </div>

        {/* Preview */}
        <div className="mt-20 w-full max-w-5xl rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-2xl">
          <div className="rounded-xl border border-white/10 bg-[#0b0b0b] p-8">
            <div className="mb-8 flex items-center justify-between">
              <div className="h-3 w-24 rounded-full bg-white/20" />
              <div className="flex gap-2">
                <div className="h-2 w-12 rounded-full bg-white/10" />
                <div className="h-2 w-12 rounded-full bg-white/10" />
                <div className="h-2 w-12 rounded-full bg-white/10" />
              </div>
            </div>

            <div className="mx-auto max-w-2xl py-16">
              <div className="mx-auto h-5 w-48 rounded-full bg-purple-500/30" />

              <div className="mx-auto mt-6 h-12 max-w-lg rounded-lg bg-white/10" />

              <div className="mx-auto mt-4 h-4 max-w-md rounded-full bg-white/5" />

              <div className="mx-auto mt-8 h-10 w-36 rounded-full bg-purple-600" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}