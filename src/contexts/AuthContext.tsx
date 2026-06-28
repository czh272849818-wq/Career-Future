import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiUrl } from '../api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
  registeredAt: Date;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (userData: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for stored auth token
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    }
  }, []);

  const persistAuth = (token: string, rawUser: any) => {
    const safeUser: User = { ...rawUser, registeredAt: new Date(rawUser?.registeredAt || Date.now()) };
    setUser(safeUser);
    setIsAuthenticated(true);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(safeUser));
  };

  const login = async (identifier: string, password: string) => {
    const resp = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '登录失败');
    }
    const data = await resp.json();
    persistAuth(data.token, data.user);
  };

  const register = async (userData: { email: string; password: string }) => {
    const resp = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userData.email, password: userData.password })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '注册失败');
    }
    const data = await resp.json();
    persistAuth(data.token, data.user);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
