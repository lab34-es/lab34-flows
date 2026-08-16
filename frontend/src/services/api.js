import axios from 'axios';

// In development the API runs on its own port (see .env.development).
// In production builds the UI is served by the API itself, so relative
// URLs (same origin) are the safe default.
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export { API_BASE_URL };

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API methods
export const flowsApi = {
  list: () => api.get('/api/flows'),
  create: (data) => api.post('/api/flows', data),
  // AI generation can take a while, give it a much longer timeout
  createWithAI: (data) => api.post('/api/flows/create/ai', data, { timeout: 120000 }),
  start: (data) => api.post('/api/flows/start', data),
  getFlow: (path) => api.get(`/api/flows/user?path=${encodeURIComponent(path)}`),
  getUserFlow: (path) => api.get(`/api/flows/user?path=${encodeURIComponent(path)}`),
  save: (path, content) => api.put('/api/flows/user', { path, content }),
};

export const applicationsApi = {
  list: () => api.get('/api/applications'),
  get: (slug) => api.get(`/api/applications/${slug}`),
  getEnvs: (slug) => api.get(`/api/applications/${slug}/envs`),
  getEnv: (slug, env) => api.get(`/api/applications/${slug}/envs/${env}`),
  updateEnvVariable: (slug, env, key, value) =>
    api.put(`/api/applications/${slug}/envs/${env}/${key}`, { value }),
  getRawEnv: (slug, env) => api.get(`/api/applications/${slug}/envs/${env}/raw`),
  updateRawEnv: (slug, env, content) =>
    api.put(`/api/applications/${slug}/envs/${env}/raw`, { content }),
};

export const environmentApi = {
  getAllPossible: () => api.get('/api/environment/all-possible'),
};

export const metaApi = {
  get: () => api.get('/api/meta'),
};

export default api;
