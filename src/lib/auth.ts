import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { execNeonQuery } from '@/db/adapters/neon/client';
import { getDatabase } from '@/db/factory';
import type { BusinessRole, GlobalRole, User } from '@/db/types';
import { ForbiddenError, UnauthorizedError } from './errors';
import { createId, nowIso } from './id';

export const SESSION_COOKIE_NAME = 'mbop_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

interface StoredCredential {
  userId: string;
  email: string;
  passwordHash: string;
  updatedAt: string;
}

interface AuthStoreFile {
  credentials: StoredCredential[];
}

export interface SessionUser {
  userId: string;
  email: string;
  fullName: string;
  globalRole: GlobalRole;
}

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    'dev-only-insecure-fallback-secret-change-in-env-local-32chars';
  return new TextEncoder().encode(secret);
}

function getAuthStorePath(): string {
  return path.join(process.cwd(), '.secrets', 'auth-store.json');
}

async function readLocalAuthStore(): Promise<AuthStoreFile> {
  try {
    const raw = await fs.readFile(getAuthStorePath(), 'utf-8');
    const parsed = JSON.parse(raw) as AuthStoreFile;
    return {
      credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
    };
  } catch {
    return { credentials: [] };
  }
}

async function writeLocalAuthStore(data: AuthStoreFile): Promise<void> {
  const storePath = getAuthStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function findCredentialByEmail(email: string): Promise<StoredCredential | null> {
  const db = getDatabase();
  const normalized = email.trim().toLowerCase();

  if (db.providerName === 'neon') {
    const rows = await execNeonQuery(
      `SELECT user_id, email, password_hash, updated_at FROM auth_credentials WHERE LOWER(email) = $1 LIMIT 1`,
      [normalized]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: String(row.user_id),
      email: String(row.email),
      passwordHash: String(row.password_hash),
      updatedAt: String(row.updated_at),
    };
  }

  const store = await readLocalAuthStore();
  return (
    store.credentials.find((c) => c.email.toLowerCase() === normalized) ?? null
  );
}

async function saveCredential(cred: StoredCredential): Promise<void> {
  const db = getDatabase();
  const normalized = cred.email.trim().toLowerCase();

  if (db.providerName === 'neon') {
    await execNeonQuery(
      `INSERT INTO auth_credentials (user_id, email, password_hash, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at`,
      [cred.userId, normalized, cred.passwordHash, cred.updatedAt]
    );
    return;
  }

  const store = await readLocalAuthStore();
  const idx = store.credentials.findIndex(
    (c) => c.email.toLowerCase() === normalized
  );
  if (idx >= 0) {
    store.credentials[idx] = { ...cred, email: normalized };
  } else {
    store.credentials.push({ ...cred, email: normalized });
  }
  await writeLocalAuthStore(store);
}

/**
 * Ensures the primary Owner account exists in both the `users` table and the
 * isolated credential store:
 * - On Neon PostgreSQL (Vercel Serverless): uses isolated `auth_credentials` table (0 filesystem writes!).
 * - On Local / Sheets mode: uses local gitignored `.secrets/auth-store.json` (0 secrets in Sheets).
 */
export async function ensureOwnerBootstrap(): Promise<User> {
  const ownerEmail = (
    process.env.OWNER_EMAIL || 'owner@omnichannel.local'
  )
    .trim()
    .toLowerCase();
  const ownerPassword = process.env.OWNER_PASSWORD || 'Admin123!ChangeMe';
  const ownerName = (process.env.OWNER_NAME || 'Pemilik Usaha').trim();

  const db = getDatabase();
  const existingUsers = await db.repo('users').findMany({
    where: { email: ownerEmail },
    limit: 1,
  });

  let ownerUser = existingUsers.items[0];
  if (!ownerUser) {
    const timestamp = nowIso();
    ownerUser = await db.repo('users').create({
      id: createId('usr'),
      auth_subject_id: `${db.providerName}:${ownerEmail}`,
      full_name: ownerName,
      email: ownerEmail,
      global_role: 'owner',
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  const existingCred = await findCredentialByEmail(ownerEmail);
  if (!existingCred) {
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    await saveCredential({
      userId: ownerUser.id,
      email: ownerEmail,
      passwordHash,
      updatedAt: nowIso(),
    });
  }

  return ownerUser;
}

export async function authenticateCredentials(
  emailInput: string,
  passwordInput: string
): Promise<SessionUser> {
  await ensureOwnerBootstrap();

  const email = emailInput.trim().toLowerCase();
  const cred = await findCredentialByEmail(email);

  if (!cred) {
    throw new UnauthorizedError('Email atau password salah.');
  }

  const valid = await bcrypt.compare(passwordInput, cred.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Email atau password salah.');
  }

  const db = getDatabase();
  const res = await db.repo('users').findMany({ where: { email }, limit: 1 });
  const user = res.items[0];
  if (!user || !user.is_active) {
    throw new UnauthorizedError('Akun tidak aktif atau tidak ditemukan.');
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    globalRole: user.global_role,
  };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.userId,
    email: user.email,
    fullName: user.fullName,
    globalRole: user.globalRole,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (!payload.sub || !payload.email || !payload.globalRole) {
      return null;
    }
    return {
      userId: String(payload.sub),
      email: String(payload.email),
      fullName: String(payload.fullName || ''),
      globalRole: payload.globalRole as GlobalRole,
    };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export function requireOwner(session: SessionUser): void {
  if (session.globalRole !== 'owner') {
    throw new ForbiddenError('Aksi ini hanya diperbolehkan untuk Pemilik Usaha (Owner).');
  }
}

/**
 * Returns the list of business IDs accessible by the authenticated user.
 * Owners have access to all businesses (returns null to signify unrestricted).
 */
export async function getAccessibleBusinessIds(
  session: SessionUser
): Promise<string[] | null> {
  if (session.globalRole === 'owner') {
    return null;
  }
  const db = getDatabase();
  const memberships = await db.repo('business_users').findMany({
    where: { user_id: session.userId, is_active: true },
    limit: 500,
  });
  return memberships.items.map((m) => m.business_id);
}

/**
 * Enforces multi-tenant isolation in the backend on every business-scoped request.
 */
export async function requireBusinessAccess(
  session: SessionUser,
  businessId: string,
  allowedRoles?: BusinessRole[]
): Promise<void> {
  if (!businessId) {
    throw new ForbiddenError('business_id wajib disertakan.');
  }
  if (session.globalRole === 'owner') {
    return;
  }

  const db = getDatabase();
  const memberships = await db.repo('business_users').findMany({
    where: {
      business_id: businessId,
      user_id: session.userId,
      is_active: true,
    },
    limit: 1,
  });

  const membership = memberships.items[0];
  if (!membership) {
    throw new ForbiddenError('Anda tidak memiliki akses ke usaha ini.');
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new ForbiddenError('Role Anda tidak memiliki izin untuk aksi ini.');
  }
}

export function setSessionCookie(
  token: string
): {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
