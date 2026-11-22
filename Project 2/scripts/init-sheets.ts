/**
 * Safe Migration CLI Script — Initialize all 14 Google Sheets tabs & headers.
 * Usage: npm run sheets:init
 * Requires .env.local with DB_PROVIDER=sheets and Google Service Account credentials.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GoogleSheetsAdapter } from '../src/db/adapters/google-sheets/adapter';

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
  console.log('[sheets:init] Memulai inisialisasi aman (Safe Migration) 14 tab Google Sheets...');
  const adapter = new GoogleSheetsAdapter();
  const result = await adapter.initializeSchema();
  console.log('[sheets:init] Tab baru dibuat:', result.created.length ? result.created.join(', ') : '(tidak ada)');
  console.log('[sheets:init] Tab diverifikasi:', result.verified.length ? result.verified.join(', ') : '(tidak ada)');
  console.log('[sheets:init] Selesai! Seluruh 14 tabel siap digunakan.');
}

main().catch((err) => {
  console.error('[sheets:init] Gagal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
