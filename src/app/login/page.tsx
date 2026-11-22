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
    <div className="min-h-screen flex items-center justify-center bg-[#0B3B3C] px-4 py-12 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#2ED47A]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#194F50]/60 blur-3xl" />

      <div className="relative w-full max-w-md rounded-[24px] border border-[#E5EFEF] bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B3B3C] text-[#38E587] shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0B2D2E] leading-tight">
              Omnichannel Platform
            </h1>
            <p className="text-xs text-[#567475]">
              Pusat Operasional Multi-Usaha
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-medium text-[#2A4D4E] mb-1.5"
            >
              Email Akun
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-[#7A9899] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@omnichannel.local"
                className="w-full rounded-xl border border-[#D5E3E3] pl-10 pr-3.5 py-2.5 text-sm text-[#0B2D2E] placeholder:text-[#8DA9AA] focus:border-[#0B3B3C] focus:outline-none focus:ring-2 focus:ring-[#0B3B3C]/10"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-[#2A4D4E] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-[#7A9899] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full rounded-xl border border-[#D5E3E3] pl-10 pr-3.5 py-2.5 text-sm text-[#0B2D2E] placeholder:text-[#8DA9AA] focus:border-[#0B3B3C] focus:outline-none focus:ring-2 focus:ring-[#0B3B3C]/10"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#0B3B3C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#134E4F] disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? 'Memverifikasi...' : 'Masuk ke Platform'}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-[#E5EFEF] bg-[#F4F7F6] px-3.5 py-3 text-[11px] text-[#4E6E6F] leading-relaxed">
          <p className="font-semibold text-[#0B2D2E]">Keamanan Kredensial:</p>
          <p className="mt-0.5">
            Akun utama dikonfigurasi melalui Environment Variables (<code className="font-mono text-[#0B3B3C]">OWNER_EMAIL</code> &amp; <code className="font-mono text-[#0B3B3C]">OWNER_PASSWORD</code>) dan password disimpan dalam bentuk hash Bcrypt terisolasi di Neon PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
}
