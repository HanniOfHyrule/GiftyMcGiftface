// Schlanker Client für die Todoist API v1 (https://developer.todoist.com/api/v1/)
const OAUTH_BASE = 'https://todoist.com/oauth';
const API_BASE = 'https://api.todoist.com/api/v1';
const TIMEOUT_MS = 15_000;

export class TodoistApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TodoistApiError';
  }
}

export interface TodoistTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface TodoistOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function call<T>(
  url: string,
  init: RequestInit & { accessToken?: string; requestId?: string } = {},
): Promise<T> {
  const { accessToken, requestId, ...rest } = init;
  const headers: Record<string, string> = {
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (rest.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (requestId) headers['X-Request-Id'] = requestId;

  const response = await fetch(url, {
    ...rest,
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new TodoistApiError(
      `Todoist antwortet mit HTTP ${response.status}: ${text.slice(0, 200)}`,
      response.status,
    );
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

const toTokens = (data: TokenResponse, previousRefresh: string | null) => ({
  accessToken: data.access_token,
  // Bei Wiederholungen innerhalb der Grace-Period fehlt der Refresh-Token
  refreshToken: data.refresh_token ?? previousRefresh,
  expiresAt: data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null,
});

export const todoistOAuth = {
  authorizationUrl(config: TodoistOAuthConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      scope: 'data:read_write',
      state,
      redirect_uri: config.redirectUri,
    });
    return `${OAUTH_BASE}/authorize?${params.toString()}`;
  },

  async exchangeCode(
    config: TodoistOAuthConfig,
    code: string,
  ): Promise<TodoistTokens> {
    const data = await call<TokenResponse>(`${OAUTH_BASE}/access_token`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });
    return toTokens(data, null);
  },

  async refresh(
    config: TodoistOAuthConfig,
    refreshToken: string,
  ): Promise<TodoistTokens> {
    const data = await call<TokenResponse>(`${OAUTH_BASE}/access_token`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    return toTokens(data, refreshToken);
  },

  async revoke(config: TodoistOAuthConfig, accessToken: string) {
    const basic = Buffer.from(
      `${config.clientId}:${config.clientSecret}`,
    ).toString('base64');
    await call(`${API_BASE}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
      body: JSON.stringify({
        token: accessToken,
        token_type_hint: 'access_token',
      }),
    });
  },
};

export interface TodoistProject {
  id: string;
  name: string;
}

export interface NewTodoistTask {
  content: string;
  description?: string;
  projectId: string;
  dueDate: string; // YYYY-MM-DD
}

export const todoistApi = {
  async getProject(accessToken: string, id: string): Promise<TodoistProject> {
    return call<TodoistProject>(
      `${API_BASE}/projects/${encodeURIComponent(id)}`,
      { accessToken },
    );
  },

  async createProject(
    accessToken: string,
    name: string,
  ): Promise<TodoistProject> {
    return call<TodoistProject>(`${API_BASE}/projects`, {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ name, color: 'teal' }),
    });
  },

  async createTask(
    accessToken: string,
    task: NewTodoistTask,
    requestId: string,
  ): Promise<{ id: string }> {
    return call<{ id: string }>(`${API_BASE}/tasks`, {
      method: 'POST',
      accessToken,
      requestId,
      body: JSON.stringify({
        content: task.content,
        description: task.description,
        project_id: task.projectId,
        due_date: task.dueDate,
      }),
    });
  },
};
