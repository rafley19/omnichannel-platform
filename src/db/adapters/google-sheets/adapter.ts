import { google, type sheets_v4 } from 'googleapis';
import {
  applyQueryFilter,
  type IDatabaseAdapter,
  type IRepository,
} from '../../interfaces/repository';
import { KeyedMutex } from '../../mutex';
import {
  ALL_TABLES,
  TABLE_SCHEMAS,
  deserializeRowToRecord,
  serializeRecordToRow,
} from '../../schema';
import type {
  BaseEntity,
  DatabaseHealth,
  PaginatedResult,
  QueryFilter,
  TableEntityMap,
  TableName,
} from '../../types';

interface CacheEntry<T> {
  rows: T[];
  rowIndexById: Map<string, number>; // 1-based sheet row index (row 1 = header, row 2+ = data)
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;

function columnIndexToLetter(colCount: number): string {
  let n = colCount;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result || 'A';
}

export class GoogleSheetsAdapter implements IDatabaseAdapter {
  readonly providerName = 'sheets' as const;
  readonly supportsTransactions = false;

  private readonly spreadsheetId: string;
  private readonly sheets: sheets_v4.Sheets;
  private readonly mutex = new KeyedMutex();
  private readonly cache = new Map<TableName, CacheEntry<BaseEntity>>();
  private sheetIdMap = new Map<string, number>();

  constructor() {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!spreadsheetId || !clientEmail || !rawPrivateKey) {
      throw new Error(
        'Konfigurasi Google Sheets belum lengkap. Isi GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, dan GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY di .env.local.'
      );
    }

    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.spreadsheetId = spreadsheetId;
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  private invalidate(table: TableName): void {
    this.cache.delete(table);
  }

  private getRange(table: TableName, startRow?: number, endRow?: number): string {
    const lastCol = columnIndexToLetter(TABLE_SCHEMAS[table].length);
    if (startRow && endRow) {
      return `'${table}'!A${startRow}:${lastCol}${endRow}`;
    }
    if (startRow) {
      return `'${table}'!A${startRow}:${lastCol}`;
    }
    return `'${table}'!A1:${lastCol}`;
  }

  private async loadTable<K extends TableName>(
    table: K
  ): Promise<CacheEntry<TableEntityMap[K]>> {
    const cached = this.cache.get(table);
    if (cached && cached.expiresAt > Date.now()) {
      return cached as unknown as CacheEntry<TableEntityMap[K]>;
    }

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.getRange(table, 2),
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const rawRows = (response.data.values ?? []) as unknown[][];
    const rows: TableEntityMap[K][] = [];
    const rowIndexById = new Map<string, number>();

    for (let i = 0; i < rawRows.length; i++) {
      const stringRow = rawRows[i].map((cell) =>
        cell === null || cell === undefined ? '' : String(cell)
      );
      const id = stringRow[0]?.trim();
      if (!id) continue;
      const entity = deserializeRowToRecord<TableEntityMap[K]>(table, stringRow);
      rows.push(entity);
      rowIndexById.set(id, i + 2); // Row 1 is header
    }

    const entry: CacheEntry<TableEntityMap[K]> = {
      rows,
      rowIndexById,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.cache.set(table, entry as unknown as CacheEntry<BaseEntity>);
    return entry;
  }

  private async getSheetNumericId(table: TableName): Promise<number> {
    const existing = this.sheetIdMap.get(table);
    if (existing !== undefined) return existing;

    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });

    for (const s of meta.data.sheets ?? []) {
      const title = s.properties?.title;
      const sid = s.properties?.sheetId;
      if (title && typeof sid === 'number') {
        this.sheetIdMap.set(title, sid);
      }
    }

    const resolved = this.sheetIdMap.get(table);
    if (resolved === undefined) {
      throw new Error(`Tab sheet '${table}' tidak ditemukan. Jalankan init-schema terlebih dahulu.`);
    }
    return resolved;
  }

  repo<K extends TableName>(table: K): IRepository<TableEntityMap[K]> {
    type Entity = TableEntityMap[K];

    return {
      create: async (record: Entity): Promise<Entity> => {
        return this.mutex.runExclusive(`table:${table}`, async () => {
          const rowValues = serializeRecordToRow(
            table,
            record as unknown as Record<string, unknown>
          );
          await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: this.getRange(table, 1),
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [rowValues],
            },
          });
          this.invalidate(table);
          return record;
        });
      },

      findById: async (id: string): Promise<Entity | null> => {
        const { rows } = await this.loadTable(table);
        return rows.find((r) => r.id === id) ?? null;
      },

      findMany: async (
        filter?: QueryFilter<Entity>
      ): Promise<PaginatedResult<Entity>> => {
        const { rows } = await this.loadTable(table);
        return applyQueryFilter(rows, filter);
      },

      update: async (id: string, patch: Partial<Entity>): Promise<Entity | null> => {
        return this.mutex.runExclusive(`table:${table}`, async () => {
          this.invalidate(table);
          const { rows, rowIndexById } = await this.loadTable(table);
          const existing = rows.find((r) => r.id === id);
          const sheetRow = rowIndexById.get(id);
          if (!existing || !sheetRow) return null;

          const updated: Entity = { ...existing, ...patch, id: existing.id };
          const rowValues = serializeRecordToRow(
            table,
            updated as unknown as Record<string, unknown>
          );

          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: this.getRange(table, sheetRow, sheetRow),
            valueInputOption: 'RAW',
            requestBody: {
              values: [rowValues],
            },
          });
          this.invalidate(table);
          return updated;
        });
      },

      delete: async (id: string): Promise<boolean> => {
        return this.mutex.runExclusive(`table:${table}`, async () => {
          this.invalidate(table);
          const { rowIndexById } = await this.loadTable(table);
          const sheetRow = rowIndexById.get(id);
          if (!sheetRow) return false;

          const sheetId = await this.getSheetNumericId(table);
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId,
                      dimension: 'ROWS',
                      startIndex: sheetRow - 1,
                      endIndex: sheetRow,
                    },
                  },
                },
              ],
            },
          });
          this.invalidate(table);
          return true;
        });
      },

      count: async (filter?: QueryFilter<Entity>): Promise<number> => {
        const { rows } = await this.loadTable(table);
        return applyQueryFilter(rows, { ...filter, page: 1, limit: 1 }).total;
      },
    };
  }

  async withLock<R>(key: string, fn: () => Promise<R>): Promise<R> {
    return this.mutex.runExclusive(key, fn);
  }

  async withTransaction<R>(lockKey: string, fn: () => Promise<R>): Promise<R> {
    // Google Sheets has no native ACID transactions; serialize via keyed mutex lock.
    return this.mutex.runExclusive(lockKey, fn);
  }

  async initializeSchema(): Promise<{ created: TableName[]; verified: TableName[] }> {
    const meta = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });

    const existingTitles = new Set<string>();
    this.sheetIdMap.clear();
    for (const s of meta.data.sheets ?? []) {
      const title = s.properties?.title;
      const sid = s.properties?.sheetId;
      if (title) {
        existingTitles.add(title);
        if (typeof sid === 'number') this.sheetIdMap.set(title, sid);
      }
    }

    const created: TableName[] = [];
    const verified: TableName[] = [];

    const missingTables = ALL_TABLES.filter((t) => !existingTitles.has(t));
    if (missingTables.length > 0) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: missingTables.map((title) => ({
            addSheet: { properties: { title } },
          })),
        },
      });
      created.push(...missingTables);
    }

    // Safe Migration: ensure header row exists and append missing columns on the right only.
    for (const table of ALL_TABLES) {
      const expectedHeaders = TABLE_SCHEMAS[table].map((c) => c.name);
      const headerRes = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${table}'!1:1`,
      });
      const currentHeaders = (headerRes.data.values?.[0] ?? []).map((h) =>
        String(h).trim()
      );

      if (currentHeaders.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: this.getRange(table, 1, 1),
          valueInputOption: 'RAW',
          requestBody: { values: [expectedHeaders] },
        });
      } else {
        const missingHeaders = expectedHeaders.filter(
          (h) => !currentHeaders.includes(h)
        );
        if (missingHeaders.length > 0) {
          const merged = [...currentHeaders, ...missingHeaders];
          const lastCol = columnIndexToLetter(merged.length);
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `'${table}'!A1:${lastCol}1`,
            valueInputOption: 'RAW',
            requestBody: { values: [merged] },
          });
        }
      }
      if (!missingTables.includes(table)) {
        verified.push(table);
      }
      this.invalidate(table);
    }

    return { created, verified };
  }

  async healthCheck(): Promise<DatabaseHealth> {
    const tables = {} as Record<TableName, number>;
    try {
      for (const table of ALL_TABLES) {
        try {
          const { rows } = await this.loadTable(table);
          tables[table] = rows.length;
        } catch {
          tables[table] = -1;
        }
      }
      const missingCount = Object.values(tables).filter((n) => n < 0).length;
      return {
        provider: 'sheets',
        ok: missingCount === 0,
        message:
          missingCount === 0
            ? 'Terhubung ke Google Sheets API (14 tabel siap).'
            : `${missingCount} tab sheet belum diinisialisasi. Klik "Inisialisasi 14 Tabel" di Settings.`,
        tables,
      };
    } catch (err) {
      for (const t of ALL_TABLES) tables[t] = -1;
      return {
        provider: 'sheets',
        ok: false,
        message:
          err instanceof Error
            ? `Gagal terhubung ke Google Sheets: ${err.message}`
            : 'Gagal terhubung ke Google Sheets.',
        tables,
      };
    }
  }
}
