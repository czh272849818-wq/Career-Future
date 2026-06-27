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
  register: (userData: Partial<User> & { password: string }) => Promise<void>;
  requestPhoneCode: (phone: string) => Promise<{ devCode?: string; delivery?: string }>;
  loginWithPhone: (phone: string, code: string, name?: string) => Promise<void>;
  startWechatLogin: () => Promise<void>;
  completeExternalLogin: (token: string, user: User) => void;
  logout: () => void;
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

  const register = async (userData: Partial<User> & { password: string }) => {
    const resp = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userData.email, password: userData.password, name: userData.name, phone: userData.phone })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '注册失败');
    }
    const data = await resp.json();
    persistAuth(data.token, data.user);
  };

  const requestPhoneCode = async (phone: string) => {
    const resp = await fetch(apiUrl('/api/auth/phone-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '验证码发送失败');
    }
    return resp.json();
  };

  const loginWithPhone = async (phone: string, code: string, name = '') => {
    const resp = await fetch(apiUrl('/api/auth/phone-login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, name })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '手机号登录失败');
    }
    const data = await resp.json();
    persistAuth(data.token, data.user);
  };

  const startWechatLogin = async () => {
    const resp = await fetch(apiUrl('/api/auth/wechat/start'));
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.url) {
      throw new Error(data.error || '微信登录暂未完成配置');
    }
    window.location.href = data.url;
  };

  const loginDemo = async () => {
    const resp = await fetch(apiUrl('/api/auth/demo'), { method: 'POST' });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || '演示登录失败');
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
      requestPhoneCode,
      loginWithPhone,
      startWechatLogin,
      completeExternalLogin: persistAuth,
      logout,
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
