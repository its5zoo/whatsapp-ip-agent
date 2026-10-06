const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const headers = new Headers(options.headers);
  if (options.body !== undefined && options.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_URL}${normalizedEndpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Required for cookies
  });

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }

  const text = await res.text();
  if (!res.ok) {
    let responseBody: unknown;
    try {
      responseBody = text ? JSON.parse(text) : undefined;
    } catch {
      responseBody = undefined;
    }
    const bodyMessage = responseBody && typeof responseBody === 'object'
      ? (responseBody as { message?: unknown; error?: unknown }).message
        ?? (responseBody as { error?: unknown }).error
      : undefined;
    throw new Error(typeof bodyMessage === 'string' ? bodyMessage : res.statusText);
  }

  return text ? JSON.parse(text) : {};
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    return `${fallback} (${error.message})`;
  }
  return fallback;
}
