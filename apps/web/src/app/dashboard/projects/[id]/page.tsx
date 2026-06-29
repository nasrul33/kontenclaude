'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, type ProjectDetail, type ClipView } from '@/lib/api';
import { ClipCard } from './ClipCard';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setProject(await apiGet<ProjectDetail>(`/api/v1/projects/${id}`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // Poll while processing so clips appear as they finish rendering.
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <main className="p-12">Loading…</main>;
  if (err)
    return (
      <main className="p-12">
        <p className="text-red-400">{err}</p>
        <Link href="/dashboard" className="underline">
          ← Back
        </Link>
      </main>
    );
  if (!project) return null;

  return (
    <main className="min-h-screen p-8 md:p-12 max-w-5xl mx-auto">
      <Link href="/dashboard" className="text-sm underline opacity-70">
        ← Dashboard
      </Link>
      <header className="mt-3 mb-8 flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold">{project.title}</h1>
        <span className="opacity-60 text-sm">
          {project.status}
          {project.durationSec ? ` · ${project.durationSec}s source` : ''}
        </span>
      </header>

      {project.clips.length === 0 ? (
        <p className="opacity-60">
          No clips yet. Processing runs upload → ingest → transcribe → segment → render.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {project.clips.map((clip: ClipView) => (
            <ClipCard key={clip.id} clip={clip} onChanged={load} />
          ))}
        </div>
      )}
    </main>
  );
}
