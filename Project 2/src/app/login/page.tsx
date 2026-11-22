'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Lock, Mail, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      router.replace('/dashboard');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal login. Periksa kembali kredensial Anda.'
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">
              Omnichannel Platform
            </h1>
            <p className="text-xs text-slate-500">
              Pusat Operasional Multi-Usaha
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Email Akun
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@omnichannel.local"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Memverifikasi...' : 'Masuk ke Platform'}
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-700">Keamanan Kredensial:</p>
          <p className="mt-0.5">
            Akun utama dikonfigurasi melalui Environment Variables (<code className="font-mono text-slate-800">OWNER_EMAIL</code> &amp; <code className="font-mono text-slate-800">OWNER_PASSWORD</code>) dan password disimpan dalam bentuk hash Bcrypt terisolasi di Neon PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
}
