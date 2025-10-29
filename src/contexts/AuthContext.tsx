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
  login: (email: string, password: string) => Promise<void>;
  register: (userData: Partial<User> & { password: string }) => Promise<void>;
  logout: () => void;
  socialLogin: (provider: 'wechat' | 'qq' | 'phone') => Promise<void>;
  loginDemo: () => Promise<void>;
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

  const login = async (email: string, password: string) => {
    const resp = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '登录失败');
    }
    const data = await resp.json();
    const safeUser: User = { ...data.user, registeredAt: new Date(data.user?.registeredAt || Date.now()) };
    setUser(safeUser);
    setIsAuthenticated(true);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user_data', JSON.stringify(safeUser));
  };

  const register = async (userData: Partial<User> & { password: string }) => {
    const resp = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userData.email, password: userData.password, name: userData.name })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '注册失败');
    }
    const data = await resp.json();
    const safeUser: User = { ...data.user, registeredAt: new Date(data.user?.registeredAt || Date.now()) };
    setUser(safeUser);
    setIsAuthenticated(true);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user_data', JSON.stringify(safeUser));
  };

  const socialLogin = async (provider: 'wechat' | 'qq' | 'phone') => {
    // 这里保持占位；当前需求仅邮箱+密码登录，社交登录不启用
    throw new Error('当前版本未启用社交登录');
  };

  const loginDemo = async () => {
    const resp = await fetch(apiUrl('/api/auth/demo'), { method: 'POST' });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '演示登录失败');
    }
    const data = await resp.json();
    const safeUser: User = { ...data.user, registeredAt: new Date(data.user?.registeredAt || Date.now()) };
    setUser(safeUser);
    setIsAuthenticated(true);
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user_data', JSON.stringify(safeUser));
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
      socialLogin,
      loginDemo
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
