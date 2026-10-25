import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/index.js';
import { apiRequest } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await apiRequest<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await apiRequest<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name: string, email: string, password: string): Promise<User> => {
    const data = await apiRequest<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'studio';
  const isCustomer = user?.role === 'customer';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isCustomer,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
