import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API methods
export const flowsApi = {
  list: () => api.get('/api/flows'),
  tree: () => api.get('/api/flows/tree'),
  parse: (value, format) => api.post('/api/flows/parse', { value, format }),
  create: (data) => api.post('/api/flows/create/ai', data),
  start: (data) => api.post('/api/flows/start', data),
  getUserFlow: (path) => api.get(`/api/flows/user?path=${encodeURIComponent(path)}`),
  createFolder: (path) => api.post('/api/flows/folder', { path }),
  saveFile: (path, content, overwrite = false) =>
    api.post('/api/flows/file', { path, content, overwrite }),
  remove: (path) => api.delete('/api/flows/file', { data: { path } }),
};

export const applicationsApi = {
  list: () => api.get('/api/applications'),
  get: (slug) => api.get(`/api/applications/${encodeURIComponent(slug)}`),
  getEnvs: (slug) => api.get(`/api/applications/${encodeURIComponent(slug)}/envs`),
  updateEnvVariable: (slug, env, key, value) =>
    api.put(`/api/applications/${encodeURIComponent(slug)}/envs/${env}/${key}`, { value }),
  getRawEnv: (slug, env) => api.get(`/api/applications/${encodeURIComponent(slug)}/envs/${env}/raw`),
  updateRawEnv: (slug, env, content) =>
    api.put(`/api/applications/${encodeURIComponent(slug)}/envs/${env}/raw`, { content }),
};

export const environmentApi = {
  getAllPossible: () => api.get('/api/environment/all-possible'),
};

export default api;
