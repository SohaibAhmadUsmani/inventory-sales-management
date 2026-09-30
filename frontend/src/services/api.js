import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/login');
    const isAuthPage =
      ['/login', '/forgot-password'].some((p) => window.location.pathname.startsWith(p)) ||
      window.location.pathname.startsWith('/reset-password');

    if (error.response?.status === 401 && !isAuthEndpoint && !isAuthPage) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
