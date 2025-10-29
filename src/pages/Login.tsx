import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/ui/BackButton';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string>('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { login, loginDemo } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError('登录失败，请检查邮箱和密码');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setSocialLoading('demo');
    setError('');
    try {
      await loginDemo();
      navigate('/dashboard');
    } catch (err) {
      setError('演示账户登录失败，请稍后重试');
    } finally {
      setSocialLoading('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-6">
            <span className="text-white font-bold text-xl">职</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">欢迎回来</h2>
          <p className="text-gray-400">登录您的账户继续使用职向未来Pro</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-700">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                邮箱地址
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-400"
                placeholder="请输入您的邮箱"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-400 pr-10"
                  placeholder="请输入您的密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded"
                />
                <span className="ml-2 text-sm text-gray-300">记住我</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300">
                忘记密码？
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* Demo Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">或者一键登录演示账户</span>
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={handleDemoLogin}
                disabled={socialLoading !== ''}
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-600 rounded-lg shadow-sm bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {socialLoading === 'demo' ? (
                  <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-gray-200 rounded-full"></div>
                ) : (
                  <span className="text-white">一键登录演示账户</span>
                )}
              </button>
            </div>
          </div>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              还没有账户？{' '}
              <Link to="/register" className="font-medium text-purple-400 hover:text-purple-300">
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Login;
