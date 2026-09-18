const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface BackendUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    roles?: string[];
  };
}

export interface BackendSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: BackendUser;
}

async function request<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`${BACKEND_URL}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Authentication request failed');
  return result;
}

export function signUp(email: string, password: string, name: string, roles: string[]) {
  return request<{ user: BackendUser }>('signup', { email, password, name, roles });
}

export function signIn(email: string, password: string) {
  return request<{ user: BackendUser; session: BackendSession }>('login', { email, password });
}