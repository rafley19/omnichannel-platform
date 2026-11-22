export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message?: string }>;
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Array<{ field?: string; message?: string }>;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Array<{ field?: string; message?: string }>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T; meta?: ApiResponse<T>['meta'] }> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !payload?.success) {
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiClientError(
      payload?.error?.message || `Permintaan gagal (HTTP ${res.status}).`,
      payload?.error?.code || 'REQUEST_FAILED',
      res.status,
      payload?.error?.details
    );
  }

  return { data: payload.data as T, meta: payload.meta };
}
