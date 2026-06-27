import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Brain, 
  FileText, 
  MessageSquare, 
  Target, 
  ArrowRight, 
  Users, 
  Star,
  CheckCircle,
  TrendingUp,
  Award,
  Zap,
  Shield,
  BarChart3
} from 'lucide-react';
import BackButton from '../components/ui/BackButton';

const Homepage = () => {
  const features = [
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: '职业画像',
      description: '把测评、简历和价值观转成可执行职业画像',
      href: '/assessment',
      color: 'from-emerald-500 to-teal-500'
    },
    {
      icon: <Target className="h-8 w-8" />,
      title: '岗位策略',
      description: '从职业画像生成岗位池，筛出最高胜率方向',
      href: '/jobs',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: '简历转化',
      description: '对照 JD 找关键词缺口，提升投递转化率',
      href: '/resume',
      color: 'from-orange-500 to-amber-500'
    }
  ];

  const flywheel = ['测评建模', '岗位推荐', '简历定制', '面试训练'];

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20"></div>
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.1) 0%, transparent 50%), 
                             radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)`
          }}></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-left">
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-8">
                <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                  把职业规划变成增长系统
                </span>
              </h1>
              
              <p className="text-xl text-gray-300 mb-12 leading-relaxed">
                不是再给一份泛泛建议，而是用 AI 把测评、岗位、简历、面试和行动计划串成闭环，持续提高求职胜率。
              </p>

              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {flywheel.map((item, index) => (
                  <div key={item} className="rounded-xl border border-gray-700 bg-gray-800/70 p-3 text-center">
                    <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-300">
                      {index + 1}
                    </div>
                    <p className="text-sm text-gray-200">{item}</p>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/assessment"
                  className="group inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-gray-950 font-semibold rounded-xl hover:from-emerald-400 hover:to-cyan-400 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  建立职业画像
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-600 text-gray-300 font-semibold rounded-xl hover:border-gray-500 hover:bg-gray-800 hover:text-white transition-all duration-300"
                >
                  了解更多
                </Link>
              </div>
            </div>

            {/* Right Content - Feature Cards */}
            <div className="relative">
              <div className="grid gap-6">
                {features.map((feature, index) => (
                  <Link
                    key={index}
                    to={feature.href}
                    className="group relative overflow-hidden bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                        {feature.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                          {feature.title}
                        </h3>
                        <p className="text-gray-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    
                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}></div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-emerald-600 to-blue-600 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            下一步不是“了解自己”，而是拿到更好的机会
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            先完成一次职业画像，再生成目标岗位、定制简历和面试训练路径。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              免费注册
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/assessment"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white font-semibold rounded-xl hover:bg-white hover:text-purple-600 transition-all duration-300"
            >
              立即开始规划
            </Link>
          </div>
        </div>
      </section>
    </div>
    </div>
  );
};

export default Homepage;
