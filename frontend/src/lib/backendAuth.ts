const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface BackendUser {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
  user_metadata?: {
    name?: string;
    roles?: string[];
  };
}

export interface BackendSession {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

async function request<T>(path: string, body?: object, customHeaders?: Record<string, string>): Promise<T> {
  const url = `${BACKEND_URL}/auth/${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (inMemoryAccessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Authentication request failed');
  }
  return result as T;
}

export function signUp(email: string, password: string, name: string, roles: string[]) {
  return request<{ user: BackendUser }>('signup', { email, password, name, roles });
}

export async function signIn(email: string, password: string) {
  const result = await request<{ user: BackendUser; session: BackendSession }>('login', { email, password });
  if (result.session?.access_token) {
    setAccessToken(result.session.access_token);
  }
  return result;
}

export async function refreshSession() {
  const result = await request<BackendSession>('refresh');
  if (result.access_token) {
    setAccessToken(result.access_token);
  }
  return result;
}

export async function logout() {
  try {
    await request<{ message: string }>('logout');
  } catch (err) {
    console.warn('Logout API call failed:', err);
  } finally {
    setAccessToken(null);
  }
}

export function changePassword(newPassword: string) {
  return request<{ message: string }>('change-password', { newPassword });
}