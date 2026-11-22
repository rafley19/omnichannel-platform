import { GoogleSheetsAdapter } from './adapters/google-sheets/adapter';
import { LocalJsonAdapter } from './adapters/local-json/adapter';
import { NeonPostgresAdapter } from './adapters/neon/adapter';
import { SupabasePostgresAdapter } from './adapters/supabase/adapter';
import type { IDatabaseAdapter } from './interfaces/repository';

let cachedAdapter: IDatabaseAdapter | null = null;
let cachedProvider: string | null = null;

function resolveProviderName(): 'neon' | 'sheets' | 'local' | 'supabase' {
  const explicit = (process.env.DB_PROVIDER || '').toLowerCase().trim();
  if (
    explicit === 'neon' ||
    explicit === 'sheets' ||
    explicit === 'local' ||
    explicit === 'supabase'
  ) {
    return explicit;
  }

  // Smart auto-detection: when deployed on Vercel with Neon connected,
  // DATABASE_URL or POSTGRES_URL is automatically injected.
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    return 'neon';
  }

  return 'local';
}

/**
 * Returns the active Database Adapter based on DB_PROVIDER (or auto-detected DATABASE_URL).
 * - neon     -> NeonPostgresAdapter (Utama: Vercel + Neon PostgreSQL)
 * - sheets   -> GoogleSheetsAdapter (Opsional)
 * - local    -> LocalJsonAdapter (Uji cepat lokal tanpa database cloud)
 * - supabase -> SupabasePostgresAdapter (Opsional Tahap 4)
 */
export function getDatabase(): IDatabaseAdapter {
  const provider = resolveProviderName();

  if (cachedAdapter && cachedProvider === provider) {
    return cachedAdapter;
  }

  switch (provider) {
    case 'neon':
      cachedAdapter = new NeonPostgresAdapter();
      break;
    case 'sheets':
      cachedAdapter = new GoogleSheetsAdapter();
      break;
    case 'supabase':
      cachedAdapter = new SupabasePostgresAdapter();
      break;
    case 'local':
    default:
      cachedAdapter = new LocalJsonAdapter();
      break;
  }

  cachedProvider = provider;
  return cachedAdapter;
}
