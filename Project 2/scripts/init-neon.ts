/**
 * Safe Migration CLI Script — Initialize 14 operational tables + auth_credentials in Neon PostgreSQL.
 * Usage: npm run db:init
 * Reads DATABASE_URL (or POSTGRES_URL) from environment or .env.local.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NeonPostgresAdapter } from '../src/db/adapters/neon/adapter';

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  console.log('[db:init] Menginisialisasi skema Neon PostgreSQL (idempoten)...');
  const adapter = new NeonPostgresAdapter();
  const result = await adapter.initializeSchema();
  console.log(
    '[db:init] Tabel baru dibuat:',
    result.created.length ? result.created.join(', ') : '(tidak ada)'
  );
  console.log(
    '[db:init] Tabel diverifikasi:',
    result.verified.length ? result.verified.join(', ') : '(tidak ada)'
  );
  console.log('[db:init] Selesai! Database Neon PostgreSQL siap digunakan.');
}

main().catch((err) => {
  console.error('[db:init] Gagal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
