import {
  Birthday,
  Share,
  SharesOverview,
  Statistics,
  UpcomingBirthday,
} from './entities/entities';

// Standard: /api - im Dev-Server (vite.config.ts) und in Docker (nginx) an das Backend weitergeleitet
export const API_URL = import.meta.env.VITE_API_URL || '/api';

const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Access-Token mitsenden und bei 401 automatisch erneuern (Standard: true) */
  auth?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

const clearAuthAndRedirect = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('username');

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

// NestJS liefert Fehlermeldungen als String oder (bei Validierung) als Array
const errorMessageFrom = (body: unknown, status: number): string => {
  if (status === 429) return 'Zu viele Versuche. Bitte warte eine Minute.';
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  return `Anfrage fehlgeschlagen (HTTP ${status})`;
};

const parseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return undefined;
  const isJson = response.headers
    .get('Content-Type')
    ?.includes('application/json');
  return isJson ? JSON.parse(text) : text;
};

const send = async (
  path: string,
  { method = 'GET', body }: RequestOptions,
  token: string | null,
): Promise<Response> => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('Der Server antwortet nicht.', 0);
    }
    throw new ApiError('Server nicht erreichbar.', 0);
  }
};

const getNewAccessToken = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const response = await send(
    '/auth/refresh',
    { method: 'POST', body: { refreshToken } },
    null,
  );
  if (!response.ok) return null;

  const data = (await parseBody(response)) as {
    token?: unknown;
    refreshToken?: unknown;
  };
  if (
    typeof data?.token !== 'string' ||
    typeof data?.refreshToken !== 'string'
  ) {
    return null;
  }

  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data.token;
};

// Mehrere gleichzeitige 401-Antworten lösen nur einen Refresh aus
const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = getNewAccessToken()
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const useAuth = options.auth ?? true;
  let response = await send(
    path,
    options,
    useAuth ? localStorage.getItem('token') : null,
  );

  if (useAuth && response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      clearAuthAndRedirect();
      throw new ApiError('Sitzung abgelaufen. Bitte neu einloggen.', 401);
    }
    response = await send(path, options, newToken);
  }

  const body = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(
      errorMessageFrom(body, response.status),
      response.status,
      body,
    );
  }
  return body as T;
}

const toAbsoluteApiUrl = (path: string) =>
  new URL(`${API_URL}${path}`, window.location.origin).toString();

export type LoginResult = {
  token: string;
  refreshToken: string;
  name?: string;
};

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  register: (data: {
    email: string;
    password: string;
    name: string;
    lastName: string;
  }) =>
    apiRequest<{ message: string }>('/auth/register', {
      method: 'POST',
      body: data,
      auth: false,
    }),
};

export type TodoistLeadDays = {
  presentLeadDays: number;
  cardLeadDays: number;
  whatsappLeadDays: number;
};

export type TodoistStatus = TodoistLeadDays & {
  configured: boolean;
  connected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

export const todoistApi = {
  getStatus: () => apiRequest<TodoistStatus>('/todoist/status'),

  getAuthorizeUrl: async () =>
    (await apiRequest<{ url: string }>('/todoist/authorize-url')).url,

  updateSettings: (settings: Partial<TodoistLeadDays>) =>
    apiRequest<TodoistStatus>('/todoist/settings', {
      method: 'PUT',
      body: settings,
    }),

  sync: () =>
    apiRequest<{ created: number; skipped: number; failed: number }>(
      '/todoist/sync',
      { method: 'POST' },
    ),

  disconnect: () =>
    apiRequest<void>('/todoist/connection', { method: 'DELETE' }),
};

export const calendarApi = {
  async getSubscriptionUrl(): Promise<string> {
    const { path } = await apiRequest<{ path: string }>(
      '/birthdays/calendar/url',
    );
    return toAbsoluteApiUrl(path);
  },

  async regenerateSubscriptionUrl(): Promise<string> {
    const { path } = await apiRequest<{ path: string }>(
      '/birthdays/calendar/url/regenerate',
      { method: 'POST' },
    );
    return toAbsoluteApiUrl(path);
  },
};

export const sharingApi = {
  list: () => apiRequest<SharesOverview>('/shares'),

  invite: (email: string) =>
    apiRequest<Share>('/shares', { method: 'POST', body: { email } }),

  accept: (id: number) =>
    apiRequest<Share>(`/shares/${id}/accept`, { method: 'POST' }),

  remove: (id: number) =>
    apiRequest<void>(`/shares/${id}`, { method: 'DELETE' }),
};

type BirthdayInput = {
  name: string;
  lastName: string;
  dateOfBirth: string;
  Todo: 'WHATSAPP' | 'NEEDCARD' | 'NEEDPRESENT';
};

export const birthdayApi = {
  async createBirthday(data: BirthdayInput) {
    try {
      return await apiRequest<Birthday>('/birthdays', {
        method: 'POST',
        body: data,
      });
    } catch (error) {
      console.error('❌ Error creating birthday:', error);

      if (error instanceof ApiError && error.status === 400) {
        throw new Error(error.message || 'Validation error', { cause: error });
      }
      if (error instanceof ApiError && error.status === 404) {
        throw new Error('API endpoint not found', { cause: error });
      }

      throw new Error('Failed to create birthday. Please try again.', {
        cause: error,
      });
    }
  },

  getUpcomingBirthdays: (days?: number): Promise<UpcomingBirthday[]> =>
    apiRequest<UpcomingBirthday[]>(
      `/birthdays/upcoming${days ? `?days=${days}` : ''}`,
    ),

  getStatistics: () => apiRequest<Statistics>('/birthdays/statistics'),

  getAllBirthdays: () => apiRequest<Birthday[]>('/birthdays'),

  updateBirthday: (id: number, data: BirthdayInput) =>
    apiRequest<Birthday>(`/birthdays/${id}`, { method: 'PUT', body: data }),

  deleteBirthday: (id: number) =>
    apiRequest(`/birthdays/${id}`, { method: 'DELETE' }),

  generateSampleData: () =>
    apiRequest('/birthdays/generate-sample', { method: 'POST' }),
};
