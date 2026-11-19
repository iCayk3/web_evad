export class ApiError extends Error {
  statusCode: number;
  error?: string;
  constructor(message: string, statusCode = 500, error?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return (await res.text()) as unknown as T;
  }
  return await res.json();
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let url = endpoint;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.startsWith('/api/')) {
      // already starts with /api/
    } else if (url.startsWith('api/')) {
      url = `/${url}`;
    } else if (url.startsWith('/')) {
      url = `/api${url}`;
    } else {
      url = `/api/${url}`;
    }
  }

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text().catch(() => '');
    }
    throw new ApiError(errorDetail || `Falha na requisição (${response.status})`, response.status);
  }

  return parseResponse<T>(response);
}
