import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    console.log('[API] Request interceptor triggered');
    console.log('[API] Request URL:', config.url);
    console.log('[API] Request method:', config.method);
    console.log('[API] Request headers:', config.headers);
    console.log('[API] Request data:', config.data);

    const token = localStorage.getItem('token');
    if (token) {
      console.log('[API] Adding token to request');
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log('[API] No token found in localStorage');
    }

    console.log('[API] Final config:', config);
    return config;
  },
  (error) => {
    console.error('[API] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response received:', response);
    return response;
  },
  (error: AxiosError) => {
    console.error('[API] Response error:', error);
    console.error('[API] Error response:', error.response);
    console.error('[API] Error message:', error.message);
    console.error('[API] Error code:', error.code);

    if (error.response?.status === 401) {
      console.log('[API] 401 Unauthorized - redirecting to login');
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;