import { supabase } from '@/integrations/supabase/client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!BACKEND_URL) throw new Error('Backend URL is not configured');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const response = await fetch(`${BACKEND_URL}/job-postings${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Job posting request failed');
  return result as T;
}

export function listJobPostings<T>() {
  return request<{ data: T[] }>('/');
}

export function listActiveJobPostings<T>() {
  return request<{ data: T[] }>('/active');
}

export function getJobPosting<T>(id: string) {
  return request<{ data: T }>(`/${id}`);
}

export function createJobPosting<T>(posting: T) {
  return request<{ data: T }>('/', { method: 'POST', body: JSON.stringify(posting) });
}

export function updateJobPosting<T>(id: string, posting: Partial<T>) {
  return request<{ data: T }>(`/${id}`, { method: 'PATCH', body: JSON.stringify(posting) });
}

export function deleteJobPosting(id: string) {
  return request<{ data: { id: string } }>(`/${id}`, { method: 'DELETE' });
}