export default function AdminWorkspaceLoading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="min-h-screen bg-[#070B19] text-slate-100 p-4 sm:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 sm:p-8">
          <div className="h-3 w-40 rounded bg-indigo-500/30 mb-3" />
          <div className="h-8 w-72 rounded bg-white/15 mb-2" />
          <div className="h-4 w-96 max-w-full rounded bg-white/10" />
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((slot) => (
            <div
              key={slot}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3"
            >
              <div className="h-3 w-28 rounded bg-white/10" />
              <div className="h-7 w-24 rounded bg-white/15" />
              <div className="h-3 w-36 rounded bg-white/10" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 h-64" />
          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 h-64" />
        </div>
      </div>
    </main>
  );
}

