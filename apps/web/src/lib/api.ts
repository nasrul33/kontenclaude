export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${API_BASE}${path}`, { credentials: 'include' }).then(handle<T>);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return fetch(`${API_BASE}${path}`, init).then(handle<T>);
}

export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  }).then(handle<T>);
}

// ── Shared response shapes (mirror apps/api routes) ──────────────────────────
export type ClipStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type ProjectStatus = 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type Platform = 'TIKTOK' | 'INSTAGRAM' | 'YOUTUBE' | 'TWITTER' | 'FACEBOOK';

export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  durationSec: number | null;
  createdAt: string;
  clipCount: number;
}

export interface ClipView {
  id: string;
  startSec: number;
  endSec: number;
  score: number;
  status: ClipStatus;
  aspect: string;
  videoUrl: string | null;
  thumbUrl: string | null;
}

export interface ProjectDetail {
  id: string;
  title: string;
  status: ProjectStatus;
  durationSec: number | null;
  createdAt: string;
  clips: ClipView[];
}

export const PLATFORMS: Platform[] = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TWITTER', 'FACEBOOK'];
