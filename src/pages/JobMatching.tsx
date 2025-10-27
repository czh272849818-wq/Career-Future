import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Target, 
  MapPin, 
  DollarSign, 
  Clock, 
  Star, 
  ArrowRight,
  Filter,
  Search,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';

import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE } from '../llm/config';
import { apiUrl } from '../api';

const JobMatching = () => {
  const navigate = useNavigate();
  const { assessmentData, recommendedJobs, setRecommendedJobs, selectJob, setCurrentStep, updateAssessmentData } = useWorkflow();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [filterCity, setFilterCity] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 模拟岗位数据（作为兜底）
  const mockJobs = [
    {
      id: '1',
      title: '高级产品经理',
      company: '腾讯科技',
      matchScore: 95,
      description: '负责产品规划、需求分析和用户体验优化',
      requirements: ['3-5年产品经验', '数据分析能力', '用户研究经验'],
      salary: '25-40K',
      location: '深圳',
      industry: '互联网',
      isNew: true,
      isUrgent: false
    },
    {
      id: '2',
      title: 'AI产品专家',
      company: '字节跳动',
      matchScore: 92,
      description: '负责AI产品的策略制定和落地执行',
      requirements: ['AI产品经验', '技术理解能力', '项目管理经验'],
      salary: '30-50K',
      location: '北京',
      industry: '人工智能',
      isNew: false,
      isUrgent: true
    },
    {
      id: '3',
      title: '数据产品经理',
      company: '阿里巴巴',
      matchScore: 88,
      description: '负责数据产品的设计和商业化',
      requirements: ['数据分析背景', '商业敏感度', 'SQL能力'],
      salary: '28-45K',
      location: '杭州',
      industry: '电商',
      isNew: true,
      isUrgent: false
    },
    {
      id: '4',
      title: '产品运营经理',
      company: '美团',
      matchScore: 85,
      description: '负责产品运营策略和用户增长',
      requirements: ['运营经验', '数据驱动思维', '用户洞察能力'],
      salary: '20-35K',
      location: '北京',
      industry: '生活服务',
      isNew: false,
      isUrgent: false
    }
  ];

  // 调用 DeepSeek 生成岗位推荐
  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      // 简历文本优先使用已解析内容，其次尝试从文件解析
      let resumeText = assessmentData.resumeText || '';
      if (!resumeText && assessmentData.resume) {
        const file = assessmentData.resume;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        try {
          const resp = await fetch('/api/extract-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, fileContentBase64: base64 })
          });
          const data = await resp.json();
          resumeText = data.text || '';
          if (resumeText) updateAssessmentData({ resumeText });
        } catch (e) {
          console.warn('Resume extraction failed:', e);
        }
      }

      const values = assessmentData.values || '';
      const personality = assessmentData.personality || '';
      const major = assessmentData.major || '';
      const aiAnalysis = assessmentData.aiAnalysis || '';
      const scores = assessmentData.scores || {};
      const traits = assessmentData.traits || [];

      const trimmedResume = resumeText ? resumeText.slice(0, 1200) : '';
      const trimmedAnalysis = aiAnalysis ? aiAnalysis.slice(0, 1200) : '';

      const sys = '你是中文职业岗位推荐引擎。请仅输出JSON数组，每个元素包含: id, title, company, matchScore(0-100), description, requirements(字符串数组，4-6项), salary, location, industry。不要输出Markdown代码块或额外文本。';
      const user = (
        `你是一名职业顾问，需要综合信息推荐岗位，严格不要仅以专业推荐。\n\n` +
        `【简历文本】${trimmedResume || '（无）'}\n` +
        `【价值观】${values || '（未填写）'}\n` +
        `【性格特点】${personality || '（未填写）'}\n` +
        `【所学专业】${major || '（未填写）'}\n` +
        `【测评分数】${JSON.stringify(scores)}\n` +
        `【优势特质】${traits.join('、') || '（未提取）'}\n` +
        `【AI分析摘要】${trimmedAnalysis || '（无）'}\n\n` +
        `请生成10个岗位推荐（贴合中国职场），并返回JSON数组。每项需包含匹配度、城市、行业、技能要求与简要描述，匹配理由要体现简历与测评的关联。`
      );

      const messages = [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ];

      const resp = await fetch(apiUrl('/api/deepseek/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model: DEFAULT_LLM_MODEL, temperature: DEFAULT_TEMPERATURE, stream: false })
      });

      if (!resp.ok) throw new Error('岗位推荐接口调用失败');
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content || '[]';

      let parsed: any[] = [];
      try { parsed = JSON.parse(content); } catch { parsed = []; }

      const jobs = parsed.slice(0, 10).map((item: any, idx: number) => ({
        id: String(idx + 1),
        title: item.title || item.岗位名称 || '未命名岗位',
        company: item.company || item.公司 || '优选公司（示例）',
        matchScore: Number(item.matchScore || item.匹配度 || 75),
        description: item.reason || item.匹配理由 || item.description || '',
        requirements: item.requirements || item.核心技能要求 || [],
        salary: item.salary || item.薪资范围 || '面议',
        location: item.location || item.城市 || '未指定',
        industry: item.industry || item.行业 || '未指定'
      }));

      setRecommendedJobs(jobs);
      setCurrentStep(3);
    } catch (e: any) {
      setError(e.message || '生成岗位推荐失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 根据测评结果生成岗位推荐
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectJob = (job: any) => {
    selectJob(job);
    setCurrentStep(3);
    navigate('/resume');
  };

  const toggleBookmark = (jobId: string) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const jobsSource = (recommendedJobs && recommendedJobs.length > 0) ? recommendedJobs : mockJobs;
  const filteredJobs = jobsSource.filter(job => {
    const cityMatch = !filterCity || job.location.includes(filterCity);
    const industryMatch = !filterIndustry || job.industry.includes(filterIndustry);
    return cityMatch && industryMatch;
  });

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
      <div className="max-w-6xl mx-auto">
        <WorkflowProgress />
        
        {/* Header */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-4">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">智能岗位推荐</h1>
              <p className="text-sm text-gray-400 mb-2">
                {loading ? '正在根据测评结果生成岗位...' : '基于您的测评结果，为您推荐最匹配的职位机会'}
              </p>
              {error && <p className="text-xs text-yellow-300">{error}</p>}
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">基于专业</p>
              <p className="text-white font-semibold">{assessmentData.major || '未填写'}</p>
            </div>
          </div>

          {/* 展示测评标签，帮助用户理解推荐依据 */}
          {assessmentData.traits && assessmentData.traits.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {assessmentData.traits.slice(0, 6).map((t, i) => (
                <span key={i} className="px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-full">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-8 border border-gray-700">
          <div className="flex items-center space-x-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  placeholder="搜索城市..."
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                />
              </div>
              <div>
                <select
                  value={filterIndustry}
                  onChange={(e) => setFilterIndustry(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="">所有行业</option>
                  <option value="互联网">互联网</option>
                  <option value="人工智能">人工智能</option>
                  <option value="电商">电商</option>
                  <option value="生活服务">生活服务</option>
                </select>
              </div>
              <div className="flex items-center text-gray-300">
                <span className="text-sm">找到 {filteredJobs.length} 个匹配职位</span>
              </div>
            </div>
          </div>
        </div>

        {/* Job List */}
        <div className="space-y-6">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700 hover:border-gray-600 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{job.title}</h3>
                    {job.isNew && (
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                        新发布
                      </span>
                    )}
                    {job.isUrgent && (
                      <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">
                        急招
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 font-medium mb-2">{job.company}</p>
                  <p className="text-gray-400 mb-4">{job.description}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {job.requirements.map((req, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-full"
                      >
                        {req}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-400">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      <span>{job.salary}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{job.industry}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-3">
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getMatchScoreColor(job.matchScore)}`}>
                      {job.matchScore}%
                    </div>
                    <p className="text-gray-400 text-sm">匹配度</p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleBookmark(job.id)}
                      className="p-2 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
                    >
                      {selectedJobs.includes(job.id) ? (
                        <BookmarkCheck className="h-5 w-5 text-yellow-400" />
                      ) : (
                        <Bookmark className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleSelectJob(job)}
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
                    >
                      选择此岗位
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Match Score Breakdown */}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-gray-400 text-sm mb-2">匹配度构成：</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">技能匹配：</span>
                    <span className="text-green-400 ml-1">85%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">经验要求：</span>
                    <span className="text-yellow-400 ml-1">90%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">发展前景：</span>
                    <span className="text-blue-400 ml-1">95%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bookmarked Jobs Summary */}
        {selectedJobs.length > 0 && (
          <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4">
              已收藏 {selectedJobs.length} 个职位
            </h3>
            <div className="flex justify-between items-center">
              <p className="text-gray-300">
                您可以收藏最多20个职位进行对比分析
              </p>
              <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200">
                对比分析
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default JobMatching;

// 修复：避免重复默认导出，改为具名导出（若保留备用函数）
export function JobMatching_Duplicate() {
  // duplicate block retained for now to avoid symbol redeclare; will not be used
}