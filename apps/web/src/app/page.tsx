import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen p-12">
      <h1 className="text-4xl font-semibold mb-3">ClipFlow</h1>
      <p className="opacity-70 mb-8">
        Upload one video → AI picks the best clips → auto-publish to TikTok, IG, YouTube Shorts, X,
        Facebook.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md border border-white/15 px-4 py-2 hover:bg-white/5"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md bg-white text-black px-4 py-2 hover:bg-white/90"
        >
          Open dashboard
        </Link>
      </div>
      <p className="mt-12 text-xs opacity-50">Phase 0 build — backend health: /api/health</p>
    </main>
  );
}
