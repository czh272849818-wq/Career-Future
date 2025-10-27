import React, { createContext, useContext, useState, useEffect } from 'react';

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
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 模拟检查用户是否存在，如果不存在则抛出错误让上层处理自动注册
      const userExists = Math.random() > 0.3; // 70%概率用户存在，30%概率需要注册
      
      if (!userExists) {
        throw new Error('用户不存在');
      }
      
      const mockUser: User = {
        id: '1',
        name: '张三',
        email,
        avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=150',
        registeredAt: new Date()
      };
      
      setUser(mockUser);
      setIsAuthenticated(true);
      
      // Store auth data
      localStorage.setItem('auth_token', 'mock_token_' + Date.now());
      localStorage.setItem('user_data', JSON.stringify(mockUser));
    } catch (error) {
      throw error; // 传递原始错误，让上层处理
    }
  };

  const register = async (userData: Partial<User> & { password: string }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newUser: User = {
        id: Date.now().toString(),
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone,
        registeredAt: new Date()
      };
      
      setUser(newUser);
      setIsAuthenticated(true);
      
      localStorage.setItem('auth_token', 'mock_token_' + Date.now());
      localStorage.setItem('user_data', JSON.stringify(newUser));
    } catch (error) {
      throw new Error('注册失败');
    }
  };

  const socialLogin = async (provider: 'wechat' | 'qq' | 'phone') => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockUser: User = {
        id: Date.now().toString(),
        name: provider === 'wechat' ? '微信用户' : provider === 'qq' ? 'QQ用户' : '手机用户',
        email: `${provider}@example.com`,
        registeredAt: new Date()
      };
      
      setUser(mockUser);
      setIsAuthenticated(true);
      
      localStorage.setItem('auth_token', 'mock_token_' + Date.now());
      localStorage.setItem('user_data', JSON.stringify(mockUser));
    } catch (error) {
      throw new Error('社交登录失败');
    }
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
      socialLogin
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