'use client';

import { getAccessToken, useAuthStore } from './auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public status: number, message: string, public payload?: any) {
    super(message);
  }
}

interface RequestOptions extends RequestInit {
  /** Si true, ne pas attacher le token (utile pour /auth/login). */
  skipAuth?: boolean;
}

/**
 * Helper fetch qui ajoute automatiquement le token d'auth
 * et déconnecte l'utilisateur si le token a expiré.
 */
export async function apiFetch<T = any>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  // Token expiré → déconnecte automatiquement
  if (res.status === 401 && !skipAuth) {
    useAuthStore.getState().logout();
    throw new ApiError(401, 'Session expirée. Reconnecte-toi.');
  }

  let payload: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    payload = await res.json();
  } else if (res.status !== 204) {
    payload = await res.text();
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload.message || payload.error)) ||
      `Erreur ${res.status}`;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : String(message), payload);
  }

  return payload as T;
}

export const api = {
  get: <T = any>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),

  post: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body: JSON.stringify(body ?? {}) }),

  patch: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body ?? {}) }),

  delete: <T = any>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export { API_URL };