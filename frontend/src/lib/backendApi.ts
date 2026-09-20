/**
 * frontend/src/lib/backendApi.ts
 *
 * Centralized API client for calling the backend express service.
 * Loop 7 migration: Uses memory-stored Cognito Access Token and automatic refresh.
 */

import { getAccessToken, refreshSession, setAccessToken } from './backendAuth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string>;
  _isRetry?: boolean;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { params, headers: customHeaders, _isRetry, ...restOptions } = options;

  let url = `${BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const authHeader = await getAuthHeader();

  let response = await fetch(url, {
    ...restOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...customHeaders,
    },
  });

  // Handle 401 Unauthorized by attempting a single token refresh
  if (response.status === 401 && !_isRetry) {
    try {
      const refreshRes = await refreshSession();
      if (refreshRes.access_token) {
        setAccessToken(refreshRes.access_token);
        const retryHeader = { Authorization: `Bearer ${refreshRes.access_token}` };

        response = await fetch(url, {
          ...restOptions,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...retryHeader,
            ...customHeaders,
          },
        });
      }
    } catch {
      // Refresh failed, proceed to error throw
    }
  }

  if (!response.ok) {
    let errorMessage = `API request failed with status ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.error) errorMessage = errData.error;
    } catch {
      // ignore json parse error on non-ok response
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Typed API Helpers
export const backendApi = {
  // Stats & Roles
  getUserStats: () => apiRequest<{ cvAnalyses: number; gapAnalyses: number; interviews: number }>('/api/me/stats'),
  getUserRoles: () => apiRequest<{ roles: string[] }>('/api/me/role'),

  // CV Analyses
  saveCvAnalysis: (data: { file_name: string; file_size?: number; candidate_profile: any }) =>
    apiRequest<{ data: any }>('/api/cv-analysis', { method: 'POST', body: JSON.stringify(data) }),
  getCvAnalyses: () => apiRequest<{ data: any[] }>('/api/cv-analysis'),

  // Gap Analyses
  saveGapAnalysis: (data: {
    cv_analysis_id?: string;
    job_profile: any;
    gap_analysis?: any;
    robust_gap_analysis?: any;
    job_description: string;
    job_posting_id?: string;
  }) => apiRequest<{ data: any }>('/api/gap-analysis', { method: 'POST', body: JSON.stringify(data) }),
  getGapAnalyses: () => apiRequest<{ data: any[] }>('/api/gap-analysis'),

  // Interviewer Dashboard
  getInterviewerDashboard: () => apiRequest<{
    sessions: any[];
    gap_analyses: any[];
    responses: any[];
  }>('/api/interviewer/dashboard'),

  // Admin Dashboard
  getAdminStatistics: () => apiRequest<{ data: any[] }>('/api/admin/statistics'),
  getAdminUserCount: () => apiRequest<{ count: number }>('/api/admin/users/count'),

  // Applications & Interview Sessions
  createApplication: (data: { opportunity_id: string; status?: string }) =>
    apiRequest<{ data: any }>('/api/applications', { method: 'POST', body: JSON.stringify(data) }),
  createInterviewSession: (data: { job_posting_id: string; recruiter_id?: string; status?: string }) =>
    apiRequest<{ data: any }>('/api/interview-sessions', { method: 'POST', body: JSON.stringify(data) }),
};
