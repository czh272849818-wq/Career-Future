import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/ui/BackButton';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTo: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string>('');
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  const navigate = useNavigate();
  const { register } = useAuth();

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (!formData.agreeTo) {
      setError('请同意用户协议和隐私政策');
      return;
    }

    if (passwordStrength < 3) {
      setError('密码强度不够，请使用更安全的密码');
      return;
    }

    setIsLoading(true);

    try {
      await register(formData);
      navigate('/assessment');
    } catch (err) {
      setError('注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 当前版本不支持社交注册

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength <= 1) return 'bg-red-500';
    if (strength <= 2) return 'bg-orange-500';
    if (strength <= 3) return 'bg-yellow-500';
    if (strength <= 4) return 'bg-green-500';
    return 'bg-green-600';
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength <= 1) return '弱';
    if (strength <= 2) return '一般';
    if (strength <= 3) return '中等';
    if (strength <= 4) return '强';
    return '很强';
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mb-6">
            <span className="text-white font-bold text-xl">职</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">创建账户</h2>
          <p className="text-gray-400">加入职向未来Pro，开启你的职业发展之旅</p>
        </div>

        {/* Register Form */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-700">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                姓名 <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-400"
                placeholder="请输入您的姓名"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                邮箱地址 <span className="text-red-400">*</span>
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
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                手机号码
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-400"
                placeholder="请输入您的手机号"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                密码 <span className="text-red-400">*</span>
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
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">密码强度</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength <= 2 ? 'text-red-400' : 
                      passwordStrength <= 3 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {getPasswordStrengthText(passwordStrength)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`}
                      style={{ width: `${(passwordStrength / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                确认密码 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors text-white placeholder-gray-400 pr-10"
                  placeholder="请再次输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <div className="mt-1 flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-400 mr-1" />
                  <span className="text-xs text-green-400">密码匹配</span>
                </div>
              )}
            </div>

            <div className="flex items-start">
              <input
                type="checkbox"
                id="agreeTo"
                name="agreeTo"
                checked={formData.agreeTo}
                onChange={handleInputChange}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded mt-1"
              />
              <label htmlFor="agreeTo" className="ml-2 text-sm text-gray-300">
                我同意{' '}
                <Link to="/terms" className="text-purple-400 hover:text-purple-300">
                  用户协议
                </Link>{' '}
                和{' '}
                <Link to="/privacy" className="text-purple-400 hover:text-purple-300">
                  隐私政策
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !formData.agreeTo}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? '注册中...' : '创建账户'}
            </button>
          </form>

          {/* 社交注册已移除：当前版本仅支持邮箱+密码注册 */}

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              已有账户？{' '}
              <Link to="/login" className="font-medium text-purple-400 hover:text-purple-300">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
