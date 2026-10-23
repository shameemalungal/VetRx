// ==============================================================================
// VetRx — Core API Client (web/src/services/api/apiClient.ts)
// PostgreSQL Server-Authoritative HTTP Transport with Multi-Tenant Session
// ==============================================================================
import { API_BASE } from '../../config/api';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  let url = `${API_BASE}${endpoint}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = `Request failed (${res.status} ${res.statusText || ''})`.trim();
    let errCode: string | undefined;
    let errDetails: any;

    try {
      const body = await res.json();
      if (body?.error) {
        if (typeof body.error === 'string') {
          errMessage = body.error;
        } else if (body.error.message) {
          errMessage = body.error.message;
          errCode = body.error.code;
          errDetails = body.error.details;
        } else if (body.error.code) {
          errCode = body.error.code;
          errMessage = body.error.code.replace(/_/g, ' ');
        }
      } else if (body?.message) {
        errMessage = body.message;
      }
    } catch {
      // Non-JSON response
    }

    throw new ApiError(errMessage, res.status, errCode, errDetails);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

function normalizeEndpoint(endpoint: string): string {
  if (endpoint.startsWith('/api/')) return endpoint;
  if (endpoint.startsWith('/')) return `/api${endpoint}`;
  return `/api/${endpoint}`;
}

import { inMemoryCache } from './cache';

export const apiClient = {
  get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined | null>,
    options?: { noCache?: boolean; ttlMs?: number }
  ): Promise<T> {
    const normalized = normalizeEndpoint(endpoint);
    if (options?.noCache) {
      return apiRequest<T>(normalized, { method: 'GET', params });
    }
    return inMemoryCache.dedupeAndCache<T>(
      normalized,
      params,
      () => apiRequest<T>(normalized, { method: 'GET', params }),
      options?.ttlMs ?? 30000
    );
  },

  async post<T>(endpoint: string, body?: any, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    const normalized = normalizeEndpoint(endpoint);
    const result = await apiRequest<T>(normalized, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      params,
    });
    // Invalidate related cache
    inMemoryCache.invalidate(normalized.replace(/^\/api\//, '').split('/')[0]);
    inMemoryCache.invalidate('dashboard-summary');
    return result;
  },

  async patch<T>(endpoint: string, body?: any, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    const normalized = normalizeEndpoint(endpoint);
    const result = await apiRequest<T>(normalized, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      params,
    });
    inMemoryCache.invalidate(normalized.replace(/^\/api\//, '').split('/')[0]);
    inMemoryCache.invalidate('dashboard-summary');
    return result;
  },

  async put<T>(endpoint: string, body?: any, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    const normalized = normalizeEndpoint(endpoint);
    const result = await apiRequest<T>(normalized, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      params,
    });
    inMemoryCache.invalidate(normalized.replace(/^\/api\//, '').split('/')[0]);
    inMemoryCache.invalidate('dashboard-summary');
    return result;
  },

  async delete<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    const normalized = normalizeEndpoint(endpoint);
    const result = await apiRequest<T>(normalized, { method: 'DELETE', params });
    inMemoryCache.invalidate(normalized.replace(/^\/api\//, '').split('/')[0]);
    inMemoryCache.invalidate('dashboard-summary');
    return result;
  },
};
