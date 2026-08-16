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

// Generating a flow means waiting for a model to write a whole document —
// and, when the first answer is not valid, for a second attempt.
const AI_TIMEOUT = 240000;

// API methods
export const flowsApi = {
  list: () => api.get('/api/flows'),
  tree: () => api.get('/api/flows/tree'),
  parse: (value, format) => api.post('/api/flows/parse', { value, format }),
  createAI: (prompt) =>
    api.post('/api/flows/create/ai', { prompt }, { timeout: AI_TIMEOUT }),
  editAI: (prompt, content) =>
    api.post('/api/flows/edit/ai', { prompt, content }, { timeout: AI_TIMEOUT }),
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
  listFiles: (slug) => api.get(`/api/applications/${encodeURIComponent(slug)}/files`),
  getFile: (slug, path) =>
    api.get(`/api/applications/${encodeURIComponent(slug)}/files/content?path=${encodeURIComponent(path)}`),
  saveFile: (slug, path, content) =>
    api.put(`/api/applications/${encodeURIComponent(slug)}/files/content`, { path, content }),
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

export const settingsApi = {
  getAI: () => api.get('/api/settings/ai'),
  saveAI: (settings) => api.put('/api/settings/ai', settings),
  testAI: (provider) =>
    api.post('/api/settings/ai/test', { provider }, { timeout: AI_TIMEOUT }),
  listAIModels: (provider) =>
    api.get(`/api/settings/ai/models/${encodeURIComponent(provider)}`),
  getJira: () => api.get('/api/settings/jira'),
  saveJira: (settings) => api.put('/api/settings/jira', settings),
  testJira: () => api.post('/api/settings/jira/test'),
};

export const jiraApi = {
  // Xray data for the tests a flow points at. The backend caches every key
  // for the life of the process, so this is cheap after the first call.
  getTests: (keys) =>
    api.get(`/api/jira/tests?keys=${encodeURIComponent(keys.join(','))}`),
};

export default api;
