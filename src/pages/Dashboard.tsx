import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  FileText, 
  Target, 
  Clock, 
  Award,
  ArrowRight,
  Calendar,
  Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAssessment } from '../contexts/AssessmentContext';
import BackButton from '../components/ui/BackButton';

const Dashboard = () => {
  const { user } = useAuth();
  const { getAssessmentHistory } = useAssessment();
  
  const assessmentHistory = getAssessmentHistory();
  const latestAssessment = assessmentHistory[0];

  const quickActions = [
    {
      title: '职业测评',
      description: '深度了解职业潜能',
      icon: <BarChart3 className="h-6 w-6" />,
      href: '/assessment',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: '简历优化',
      description: '提升简历竞争力',
      icon: <FileText className="h-6 w-6" />,
      href: '/resume',
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: '面试模拟',
      description: '提升面试表现',
      icon: <Target className="h-6 w-6" />,
      href: '/interview',
      color: 'from-green-500 to-green-600'
    }
  ];

  const recentActivities = [
    {
      type: 'assessment',
      title: '完成了通用职业测评',
      time: '2小时前',
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      type: 'resume',
      title: '上传了新的简历文件',
      time: '1天前',
      icon: <FileText className="h-4 w-4" />
    },
    {
      type: 'interview',
      title: '完成产品经理模拟面试',
      time: '2天前',
      icon: <Target className="h-4 w-4" />
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  欢迎回来，{user?.name}！
                </h1>
                <p className="text-blue-100 mb-4">
                  继续你的职业发展之旅，让AI助力你的每一步成长
                </p>
                <div className="flex items-center text-blue-100">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="text-sm">
                    注册时间：{user?.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : '未知'}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold">{user?.name?.charAt(0)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">完成测评</p>
                <p className="text-2xl font-bold text-gray-900">{assessmentHistory.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-green-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>持续提升中</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">简历优化</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-blue-600">
              <Award className="h-4 w-4 mr-1" />
              <span>竞争力提升</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">面试模拟</p>
                <p className="text-2xl font-bold text-gray-900">7</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-orange-600">
              <Activity className="h-4 w-4 mr-1" />
              <span>表现优异</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">岗位匹配</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm text-purple-600">
              <Clock className="h-4 w-4 mr-1" />
              <span>持续更新</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">快速操作</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {quickActions.map((action, index) => (
                  <Link
                    key={index}
                    to={action.href}
                    className="group p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-md"
                  >
                    <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r ${action.color} rounded-lg text-white mb-3 group-hover:scale-110 transition-transform`}>
                      {action.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                    <div className="flex items-center text-blue-600 text-sm font-medium group-hover:text-blue-700">
                      立即开始
                      <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Latest Assessment Results */}
            {latestAssessment && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900 mb-6">最新测评结果</h2>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">职业能力测评</h3>
                      <p className="text-sm text-gray-600">
                        完成时间：{latestAssessment.completedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <Link
                      to="/assessment"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      查看详情
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    {Object.entries(latestAssessment.scores).slice(0, 6).map(([skill, score], index) => (
                      <div key={index} className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{score}</div>
                        <div className="text-xs text-gray-600">{skill}</div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {latestAssessment.traits.map((trait, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activities */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 mb-6">最近活动</h2>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      {activity.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
                  查看全部活动
                </button>
              </div>
            </div>

            {/* Progress Tips */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
              <h2 className="text-lg font-bold text-gray-900 mb-3">成长建议</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2"></div>
                  <p>定期进行职业测评，了解能力变化</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2"></div>
                  <p>持续优化简历，提升求职竞争力</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></div>
                  <p>多练习面试模拟，增强表达能力</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Dashboard;