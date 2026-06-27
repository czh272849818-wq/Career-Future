import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Phone, ScanLine } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/ui/BackButton';

type LoginMode = 'phone' | 'email';

const Login = () => {
  const [mode, setMode] = useState<LoginMode>('phone');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginDemo, requestPhoneCode, loginWithPhone, startWechatLogin, completeExternalLogin } = useAuth();

  useEffect(() => {
    const token = searchParams.get('auth_token');
    const user = searchParams.get('user');
    const authError = searchParams.get('auth_error');
    if (authError) setError(authError);
    if (token && user) {
      try {
        completeExternalLogin(token, JSON.parse(decodeURIComponent(user)));
        navigate('/dashboard', { replace: true });
      } catch {
        setError('第三方登录结果解析失败，请重新登录');
      }
    }
  }, [completeExternalLogin, navigate, searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const requestCode = async () => {
    setError('');
    setDevCode('');
    setLoading('code');
    try {
      const data = await requestPhoneCode(phone);
      setDevCode(data.devCode || '');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || '验证码发送失败');
    } finally {
      setLoading('');
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading('phone');
    try {
      await loginWithPhone(phone, code);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '手机号登录失败');
    } finally {
      setLoading('');
    }
  };

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

  const handleWechat = async () => {
    setError('');
    setLoading('wechat');
    try {
      await startWechatLogin();
    } catch (err: any) {
      setError(err.message || '微信登录暂未完成配置');
      setLoading('');
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading('demo');
    try {
      await loginDemo();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '演示账户登录失败');
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
            <h2 className="text-3xl font-bold text-white mb-2">快速进入职向未来</h2>
            <p className="text-gray-400">手机号首次验证自动创建账号，老用户直接登录</p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-gray-700">
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-6 rounded-xl bg-gray-900/60 p-1">
              <button
                type="button"
                onClick={() => setMode('phone')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'phone' ? 'bg-white text-gray-950' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Phone className="h-4 w-4" />
                手机验证码
              </button>
              <button
                type="button"
                onClick={() => setMode('email')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === 'email' ? 'bg-white text-gray-950' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Mail className="h-4 w-4" />
                邮箱密码
              </button>
            </div>

            {mode === 'phone' ? (
              <form onSubmit={handlePhoneSubmit} className="space-y-5">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">手机号</label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-400"
                    placeholder="请输入中国大陆手机号"
                  />
                </div>

                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">验证码</label>
                  <div className="flex gap-3">
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="min-w-0 flex-1 px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-400"
                      placeholder="6位验证码"
                    />
                    <button
                      type="button"
                      onClick={requestCode}
                      disabled={loading === 'code' || countdown > 0}
                      className="shrink-0 rounded-lg border border-gray-600 px-4 text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
                    >
                      {countdown > 0 ? `${countdown}s` : loading === 'code' ? '发送中' : '获取验证码'}
                    </button>
                  </div>
                  {devCode && (
                    <p className="mt-2 text-xs text-emerald-300">
                      当前未接短信服务商，测试验证码：{devCode}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading === 'phone'}
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 py-3 text-sm font-semibold text-white hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50"
                >
                  {loading === 'phone' ? '登录中...' : '登录 / 自动注册'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div>
                  <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-2">邮箱或手机号</label>
                  <input
                    id="identifier"
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-400"
                    placeholder="请输入邮箱或已绑定手机号"
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
                  {loading === 'email' ? '登录中...' : '邮箱密码登录'}
                </button>
              </form>
            )}

            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={handleWechat}
                disabled={loading === 'wechat'}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 bg-gray-900/40 py-3 text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
              >
                <ScanLine className="h-4 w-4 text-green-400" />
                {loading === 'wechat' ? '正在打开微信...' : '微信扫码登录'}
              </button>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading === 'demo'}
                className="rounded-lg border border-gray-700 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-50"
              >
                {loading === 'demo' ? '进入中...' : '体验演示账户'}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                需要设置密码？{' '}
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
