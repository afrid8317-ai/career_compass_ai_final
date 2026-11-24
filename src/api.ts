const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export type ApiUser = { id: number; name: string; email: string };
export type ApiToken = { access_token: string; token_type: 'bearer'; user: ApiUser };
export type OAuthProviders = { google: boolean };
export type Career = { id: string; title: string; category: string; summary: string; skills: string[] };
export type Assessment = { id: number; answers: number[]; result_title: string; version?: string; scores?: Record<string, number>; created_at: string };
export type RoadmapTask = { id: number; title: string; completed: boolean; estimated_minutes?: number; logged_minutes?: number; created_at: string };
export type CollegeMatch = { college_name: string; course: string; state: string; year: number | null; category: string; quota: string; round: string; historical_closing_rank: number | null; demo_rank_reference?: number; source_url: string; source_checked_on: string | null; advisory_band?: 'Safe'|'Moderate'|'Dream'|'Demo'; is_demo?: boolean };
export type CollegeGeocodeLocation = { name: string; latitude: number; longitude: number; type: string };
export type ApiProfile = { education_stage: string; preferred_language: string; location: string; interests: string[] };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'ApiError'; this.status = status; }
}

function token() { return localStorage.getItem('careercompass_access_token'); }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const accessToken = token();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(`Cannot reach the API at ${API_BASE}. Start the backend and check its local CORS configuration.`, 0);
    }
    throw error;
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const body = await response.json(); message = body.detail || message; } catch { /* use fallback */ }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  oauthProviders: () => request<OAuthProviders>('/api/v1/auth/oauth/providers'),
  oauthStartUrl: () => `${API_BASE}/api/v1/auth/oauth/google`,
  register: (payload: { name: string; email: string; password: string }) => request<ApiToken>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) => request<ApiToken>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request<ApiUser>('/api/v1/auth/me'),
  careers: (q = '', category = '') => request<Career[]>(`/api/v1/careers?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`),
  careerPathway: (careerId: string) => request<{ career_id: string; career_title: string; category: string; streams: string[]; study_path: string[]; starter_projects: string[]; evidence_to_collect: string[]; source_note: string }>(`/api/v1/career-pathways/${encodeURIComponent(careerId)}`),
  sportsPathways: () => request<{ items: Array<{ id: string; title: string; focus: string; subjects: string[]; learning_steps: string[]; source_note: string }>; source_note: string }>('/api/v1/sports-pathways'),
  businessIdeas: (filters: { interest?: string; budget?: string; time?: string } = {}) => request<{ items: Array<{ id: string; title: string; interest: string; budget: string; time: string; tags: string[]; description: string; test: string }>; source_note: string; profile_matched: boolean }>(`/api/v1/business-ideas?${new URLSearchParams({ interest: filters.interest || 'any', budget: filters.budget || 'all', time: filters.time || 'all' }).toString()}`),
  recommendCareers: (scores: Record<string, number>) => request<{version:string;results:{career_id:string;title:string;category:string;alignment_index:number;mapped_dimensions:string[];explanation:string}[];method:string}>('/api/v1/recommendations',{method:'POST',body:JSON.stringify({scores})}),
  saveAssessment: (answers: number[], version = 'reflection-v1') => request<Assessment>('/api/v1/assessments', { method: 'POST', body: JSON.stringify({ answers, version }) }),
  assessmentHistory: () => request<Assessment[]>('/api/v1/assessments'),
  tasks: () => request<RoadmapTask[]>('/api/v1/roadmap/tasks'),
  addTask: (title: string) => request<RoadmapTask>('/api/v1/roadmap/tasks', { method: 'POST', body: JSON.stringify({ title }) }),
  updateTask: (id: number, completed: boolean, estimated_minutes?: number) => request<RoadmapTask>(`/api/v1/roadmap/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ completed, estimated_minutes }) }),
  logTaskMinutes: (id: number, minutes: number, note = '') => request<RoadmapTask>(`/api/v1/roadmap/tasks/${id}/time`, { method: 'POST', body: JSON.stringify({ minutes, note }) }),
  deleteTask: (id: number) => request<void>(`/api/v1/roadmap/tasks/${id}`, { method: 'DELETE' }),
  collegeSearch: (filters: Record<string, unknown>) => request<{ status: string; message: string; received_filters: Record<string, unknown>; matches?: CollegeMatch[] }>('/api/v1/colleges/search', { method: 'POST', body: JSON.stringify(filters) }),
  bookmarks: () => request<{id:number;item_type:string;item_id:string}[]>('/api/v1/bookmarks'),
  addBookmark: (item_type: string, item_id: string) => request('/api/v1/bookmarks', { method: 'POST', body: JSON.stringify({item_type,item_id}) }),
  removeBookmark: (item_type: string, item_id: string) => request<void>(`/api/v1/bookmarks/${encodeURIComponent(item_type)}/${encodeURIComponent(item_id)}`, { method: 'DELETE' }),
  profile: () => request<ApiProfile>('/api/v1/profile'),
  updateProfile: (payload: ApiProfile) => request<ApiProfile>('/api/v1/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  geocodeCollege: (query: string) => request<{provider:string;results:CollegeGeocodeLocation[];disclaimer:string}>('/api/v1/colleges/geocode', { method: 'POST', body: JSON.stringify({query}) }),
  collegeDistance: (coordinates: {from_lat:number;from_lon:number;to_lat:number;to_lon:number}) => request<{distance_km:number;method:string;not_road_distance:boolean;disclaimer:string}>('/api/v1/colleges/distance', { method: 'POST', body: JSON.stringify(coordinates) }),
  requestPasswordReset: (email: string) => request<{status:string}>('/api/v1/auth/password/reset/request', { method: 'POST', body: JSON.stringify({email}) }),
  confirmPasswordReset: (token: string, new_password: string) => request<{status:string}>('/api/v1/auth/password/reset/confirm', { method: 'POST', body: JSON.stringify({token,new_password}) }),
  requestEmailVerification: (email: string) => request<{status:string}>('/api/v1/auth/verify/request', { method: 'POST', body: JSON.stringify({email}) }),
  confirmEmailVerification: (token: string) => request<{status:string}>('/api/v1/auth/verify/confirm', { method: 'POST', body: JSON.stringify({token}) }),
};

export function saveAccessToken(accessToken: string) { localStorage.setItem('careercompass_access_token', accessToken); }
export function clearAccessToken() { localStorage.removeItem('careercompass_access_token'); }
