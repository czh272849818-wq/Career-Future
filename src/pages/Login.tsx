import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/ui/BackButton';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading('email');
    try {
      await login(identifier, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '登录失败，请检查账号和密码');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>

        <div className="space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <span className="text-white font-bold text-xl">职</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">邮箱登录</h2>
            <p className="text-gray-400">用邮箱注册后直接登录，流程最短</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700">
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-2">邮箱</label>
                <input
                  id="identifier"
                  type="email"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-400"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">密码</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-400 pr-10"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading === 'email'}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 py-3 text-sm font-semibold text-white hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50"
              >
                {loading === 'email' ? '登录中...' : '邮箱登录'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                没有账号？{' '}
                <Link to="/register" className="font-medium text-emerald-400 hover:text-emerald-300">
                  创建邮箱账号
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
