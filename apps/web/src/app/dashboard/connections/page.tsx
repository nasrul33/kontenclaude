'use client';
import Link from 'next/link';
import { API_BASE, PLATFORMS } from '@/lib/api';

// Full-page navigation (not fetch) so the session cookie rides along to the API.
export default function ConnectionsPage() {
  return (
    <main className="min-h-screen p-8 md:p-12 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm underline opacity-70">
        ← Dashboard
      </Link>
      <h1 className="text-3xl font-semibold mt-3 mb-2">Connections</h1>
      <p className="opacity-60 mb-8 text-sm">
        Connect a platform to enable publishing. Each opens that platform&apos;s OAuth consent
        screen. (Requires the platform app credentials configured in the API.)
      </p>

      <ul className="space-y-3">
        {PLATFORMS.map(p => (
          <li
            key={p}
            className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3"
          >
            <span className="font-medium">{p}</span>
            <a
              href={`${API_BASE}/api/v1/connect/${p}`}
              className="rounded-md bg-white text-black px-3 py-1.5 text-sm"
            >
              Connect
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
