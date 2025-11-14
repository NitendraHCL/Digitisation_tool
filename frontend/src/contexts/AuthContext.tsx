import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, AuthResponse } from '../types';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isNurse: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    console.log('[AUTH] Login attempt started');
    console.log('[AUTH] API Base URL:', api.defaults.baseURL);
    console.log('[AUTH] Credentials:', { email: credentials.email, password: '***' });

    try {
      console.log('[AUTH] Sending POST request to /auth/login');
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      console.log('[AUTH] Response received:', response);

      if (response.data.success) {
        const { token, user } = response.data.data;
        console.log('[AUTH] Login successful for user:', user.email);

        // Store in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Update state
        setToken(token);
        setUser(user);
        console.log('[AUTH] State updated, user logged in');
      } else {
        console.error('[AUTH] Login response success=false:', response.data);
      }
    } catch (error: any) {
      console.error('[AUTH] Login error:', error);
      console.error('[AUTH] Error response:', error.response);
      console.error('[AUTH] Error message:', error.message);
      console.error('[AUTH] Error config:', error.config);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    isNurse: user?.role === 'nurse',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};