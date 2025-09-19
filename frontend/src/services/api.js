import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API methods
export const flowsApi = {
  list: () => api.get('/api/flows'),
  create: (data) => api.post('/api/flows/create/ai', data),
  start: (data) => api.post('/api/flows/start', data),
  getFlow: (path) => api.get(`/api/flows/user?path=${encodeURIComponent(path)}`),
  getUserFlow: (path) => api.get(`/api/flows/user?path=${encodeURIComponent(path)}`),
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

export default api;
