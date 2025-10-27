import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  ArrowRight,
  Star,
  Award,
  BookOpen,
  Users,
  Zap
} from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';

const CareerPlanning = () => {
  const navigate = useNavigate();
  const { selectedJob, assessmentData, optimizedResume, setCareerPlan } = useWorkflow();
  const [planGenerated, setPlanGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const mockCareerPlan = {
    currentLevel: '中级产品经理',
    targetLevel: '高级产品经理',
    timeframe: '12-18个月',
    roadmap: [
      {
        phase: '短期目标 (3-6个月)',
        goals: [
          '完成产品管理认证课程',
          '主导1-2个核心产品功能的设计和上线',
          '建立用户反馈收集和分析体系',
          '提升数据分析和SQL技能'
        ],
        skills: ['数据分析', 'SQL', '用户研究', '产品设计'],
        milestones: ['获得产品管理认证', '成功上线核心功能', '建立用户反馈体系']
      },
      {
        phase: '中期目标 (6-12个月)',
        goals: [
          '负责完整产品线的规划和管理',
          '建立跨部门协作机制',
          '培养初级产品经理',
          '参与公司产品战略制定'
        ],
        skills: ['团队管理', '战略规划', '跨部门协作', '商业分析'],
        milestones: ['管理完整产品线', '成功培养团队成员', '参与战略决策']
      },
      {
        phase: '长期目标 (12-18个月)',
        goals: [
          '晋升为高级产品经理',
          '负责多个产品线的整体规划',
          '建立产品团队文化和流程',
          '成为公司产品专家'
        ],
        skills: ['领导力', '产品战略', '团队建设', '行业洞察'],
        milestones: ['获得晋升', '建立产品团队', '成为行业专家']
      }
    ],
    recommendations: [
      {
        type: '学习建议',
        items: [
          '完成《产品经理实战课程》',
          '学习《数据驱动的产品决策》',
          '参加行业会议和产品沙龙',
          '阅读《用户体验要素》等经典书籍'
        ]
      },
      {
        type: '实践建议',
        items: [
          '主动承担更多产品责任',
          '建立个人品牌和影响力',
          '参与开源项目或个人项目',
          '建立行业人脉网络'
        ]
      },
      {
        type: '技能提升',
        items: [
          '提升数据分析能力',
          '学习基础的技术知识',
          '加强商业思维训练',
          '提升演讲和表达能力'
        ]
      }
    ]
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    
    // 模拟AI生成职业规划
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setCareerPlan(mockCareerPlan);
    setPlanGenerated(true);
    setIsGenerating(false);
  };

  const handleComplete = () => {
    navigate('/dashboard');
  };

  if (planGenerated) {
    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <WorkflowProgress />
          
          {/* Header */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-4">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">职业规划制定完成！</h1>
              <p className="text-gray-300">基于您的测评结果和目标岗位，为您制定了个性化的职业发展路径</p>
            </div>
          </div>

          {/* Career Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-white mb-2">当前水平</h3>
              <p className="text-gray-300">{mockCareerPlan.currentLevel}</p>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-white mb-2">目标水平</h3>
              <p className="text-gray-300">{mockCareerPlan.targetLevel}</p>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-white mb-2">预计时间</h3>
              <p className="text-gray-300">{mockCareerPlan.timeframe}</p>
            </div>
          </div>

          {/* Career Roadmap */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">职业发展路径</h2>
            
            <div className="space-y-8">
              {mockCareerPlan.roadmap.map((phase, index) => (
                <div key={index} className="relative">
                  {index < mockCareerPlan.roadmap.length - 1 && (
                    <div className="absolute left-6 top-16 w-0.5 h-full bg-gradient-to-b from-purple-600 to-blue-600"></div>
                  )}
                  
                  <div className="flex items-start space-x-6">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-4">{phase.phase}</h3>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div>
                          <h4 className="font-semibold text-gray-300 mb-3">目标任务</h4>
                          <ul className="space-y-2">
                            {phase.goals.map((goal, goalIndex) => (
                              <li key={goalIndex} className="flex items-start space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-400 text-sm">{goal}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-gray-300 mb-3">技能提升</h4>
                          <div className="flex flex-wrap gap-2">
                            {phase.skills.map((skill, skillIndex) => (
                              <span
                                key={skillIndex}
                                className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-gray-300 mb-3">关键里程碑</h4>
                          <ul className="space-y-2">
                            {phase.milestones.map((milestone, milestoneIndex) => (
                              <li key={milestoneIndex} className="flex items-start space-x-2">
                                <Star className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-400 text-sm">{milestone}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {mockCareerPlan.recommendations.map((rec, index) => (
              <div key={index} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
                <div className="flex items-center mb-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg mr-3">
                    {rec.type === '学习建议' && <BookOpen className="h-5 w-5 text-white" />}
                    {rec.type === '实践建议' && <Zap className="h-5 w-5 text-white" />}
                    {rec.type === '技能提升' && <Award className="h-5 w-5 text-white" />}
                  </div>
                  <h3 className="font-bold text-white">{rec.type}</h3>
                </div>
                
                <ul className="space-y-3">
                  {rec.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-400 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="text-center">
            <button
              onClick={handleComplete}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-lg rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg"
            >
              完成职业规划
              <ArrowRight className="h-5 w-5 ml-2" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
      <div className="max-w-4xl mx-auto">
        <WorkflowProgress />
        
        {/* Header */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-6">
              <Target className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">AI职业规划制定</h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              基于您的测评结果、目标岗位和简历优化建议，为您制定个性化的职业发展路径
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">规划基础信息</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">个人背景</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">专业背景：</span>
                  <span className="text-white">{assessmentData.major || '未填写'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">测评完成：</span>
                  <span className="text-green-400">✓ 已完成</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">简历优化：</span>
                  <span className="text-green-400">{optimizedResume ? '✓ 已完成' : '未完成'}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-300 mb-3">目标岗位</h3>
              {selectedJob ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">职位：</span>
                    <span className="text-white">{selectedJob.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">公司：</span>
                    <span className="text-white">{selectedJob.company}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">匹配度：</span>
                    <span className="text-green-400">{selectedJob.matchScore}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">未选择目标岗位</p>
              )}
            </div>
          </div>
        </div>

        {/* Generate Plan */}
        <div className="text-center">
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-lg rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-3"></div>
                AI正在制定您的职业规划...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                开始制定职业规划
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
  );
  };

export default CareerPlanning;