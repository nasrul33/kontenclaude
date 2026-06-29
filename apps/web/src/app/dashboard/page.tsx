export default function DashboardPage() {
  return (
    <main className="min-h-screen p-12">
      <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
      <p className="opacity-60 mb-8">Phase 0 placeholder. Upload UI, clips list & schedule view land in Phase 1.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-white/10 p-5">
          <div className="text-sm opacity-60">Projects</div>
          <div className="text-3xl mt-1">0</div>
        </div>
        <div className="rounded-lg border border-white/10 p-5">
          <div className="text-sm opacity-60">Clips ready</div>
          <div className="text-3xl mt-1">0</div>
        </div>
        <div className="rounded-lg border border-white/10 p-5">
          <div className="text-sm opacity-60">Published</div>
          <div className="text-3xl mt-1">0</div>
        </div>
      </div>
    </main>
  );
}
