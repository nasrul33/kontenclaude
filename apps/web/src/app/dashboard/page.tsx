'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiGet, apiUpload, type ProjectSummary } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-yellow-400',
  UPLOADING: 'text-yellow-400',
  PROCESSING: 'text-blue-400',
  DONE: 'text-green-400',
  FAILED: 'text-red-400',
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    try {
      setProjects(await apiGet<ProjectSummary[]>('/api/v1/projects'));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.set('title', title || file.name);
      form.set('file', file);
      await apiUpload('/api/v1/projects', form);
      setTitle('');
      setFile(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const unauthorized = err === 'unauthorized';

  return (
    <main className="min-h-screen p-8 md:p-12 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/dashboard/connections" className="underline opacity-80 hover:opacity-100">
            Connections
          </Link>
        </nav>
      </header>

      {unauthorized ? (
        <p className="opacity-70">
          You are not signed in.{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>{' '}
          to continue.
        </p>
      ) : (
        <>
          <form
            onSubmit={onUpload}
            className="rounded-lg border border-white/10 p-5 mb-8 space-y-3"
          >
            <h2 className="font-medium">Upload a video</h2>
            <input
              placeholder="Title (optional)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2"
            />
            <input
              type="file"
              accept="video/*"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
            <button
              type="submit"
              disabled={uploading || !file}
              className="rounded-md bg-white text-black px-4 py-2 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload & process'}
            </button>
          </form>

          {err && !unauthorized && <p className="text-sm text-red-400 mb-4">{err}</p>}

          <h2 className="font-medium mb-3">Projects</h2>
          {loading ? (
            <p className="opacity-60">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="opacity-60">No projects yet — upload a video to get started.</p>
          ) : (
            <ul className="divide-y divide-white/10 border border-white/10 rounded-lg">
              {projects.map(p => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/projects/${p.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
                  >
                    <span>
                      <span className="font-medium">{p.title}</span>
                      <span className="opacity-50 text-sm ml-2">{p.clipCount} clips</span>
                    </span>
                    <span className={`text-sm ${STATUS_COLOR[p.status] ?? ''}`}>{p.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
