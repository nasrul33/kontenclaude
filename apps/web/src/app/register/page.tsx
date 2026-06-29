'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.signUp.email({ email, password, name });
    setBusy(false);
    if (err) {
      setError(err.message ?? 'Sign-up failed');
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <label className="block">
          <span className="text-sm opacity-70">Name</span>
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm opacity-70">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm opacity-70">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-white text-black px-3 py-2 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-sm opacity-60">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
