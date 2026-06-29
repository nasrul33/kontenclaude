'use client';
import { useState } from 'react';
import { apiPost, PLATFORMS, type ClipView, type Platform } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-yellow-400',
  PROCESSING: 'text-blue-400',
  READY: 'text-green-400',
  FAILED: 'text-red-400',
};

export function ClipCard({ clip, onChanged }: { clip: ClipView; onChanged: () => void }) {
  const [selected, setSelected] = useState<Platform[]>([]);
  const [scheduledFor, setScheduledFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(p: Platform) {
    setSelected(s => (s.includes(p) ? s.filter(x => x !== p) : [...s, p]));
  }

  async function publish() {
    if (!selected.length) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiPost(`/api/v1/clips/${clip.id}/publish`, {
        platforms: selected,
        ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
      });
      setMsg(scheduledFor ? 'Scheduled ✓' : 'Publishing ✓');
      setSelected([]);
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const dur = (clip.endSec - clip.startSec).toFixed(1);

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden">
      <div className="aspect-video bg-black/40 flex items-center justify-center">
        {clip.status === 'READY' && clip.videoUrl ? (
          <video src={clip.videoUrl} controls poster={clip.thumbUrl ?? undefined} className="h-full" />
        ) : clip.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.thumbUrl} alt="clip thumbnail" className="h-full object-cover" />
        ) : (
          <span className="opacity-40 text-sm">rendering…</span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="opacity-70">
            {dur}s · score {clip.score.toFixed(1)}
          </span>
          <span className={STATUS_COLOR[clip.status] ?? ''}>{clip.status}</span>
        </div>

        {clip.status === 'READY' && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => toggle(p)}
                  className={`text-xs rounded-full px-2.5 py-1 border ${
                    selected.includes(p)
                      ? 'bg-white text-black border-white'
                      : 'border-white/20 opacity-80 hover:opacity-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={e => setScheduledFor(e.target.value)}
              className="w-full text-xs rounded-md bg-white/5 border border-white/10 px-2 py-1"
            />
            <button
              onClick={publish}
              disabled={busy || !selected.length}
              className="w-full rounded-md bg-white text-black px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {busy ? '…' : scheduledFor ? 'Schedule' : 'Publish now'}
            </button>
            {msg && <p className="text-xs opacity-70">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
