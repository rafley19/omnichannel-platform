import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './errors';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export function okResponse<T>(data: T, meta?: ApiMeta, status = 200): NextResponse {
  return NextResponse.json(
    meta ? { success: true, data, meta } : { success: true, data },
    { status }
  );
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status }
  );
}

export function handleApiError(err: unknown): NextResponse {
  // Never swallow Next.js internal control-flow/static-detection signals
  if (err && typeof err === 'object' && 'digest' in err) {
    const digest = String((err as { digest?: unknown }).digest ?? '');
    if (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_')) {
      throw err;
    }
  }

  if (err instanceof AppError) {
    return errorResponse(err.code, err.message, err.statusCode, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return errorResponse(
      'VALIDATION_ERROR',
      'Periksa kembali data yang Anda masukkan.',
      400,
      details
    );
  }

  console.error('[API_ERROR]', err);
  const msg =
    err instanceof Error ? err.message : 'Terjadi kesalahan internal pada server.';
  return errorResponse('INTERNAL_ERROR', msg, 500);
}
