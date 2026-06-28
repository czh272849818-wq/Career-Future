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
  const [filterPosition, setFilterPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);

  const buildLocalRecommendations = () => {
    const major = assessmentData.major || '你的专业背景';
    const targetIndustry = filterIndustry || assessmentData.industry || '目标行业';
    const traitText = assessmentData.traits?.slice(0, 2).join('、') || '可迁移能力';
    const baseTitles = positions.length > 0
      ? positions.slice(0, 4)
      : ['业务分析专员', '产品运营专员', '项目执行专员', '客户成功顾问'];

    return baseTitles.map((title, index) => ({
      id: `local-${index + 1}`,
      title,
      company: '职业方向建议',
      matchScore: Math.max(72, 86 - index * 4),
      description: `基于${major}、${traitText}与当前测评信息生成的职业方向，不代表真实招聘职位。`,
      requirements: ['补充岗位作品集', '准备量化项目案例', '提升行业认知', '验证真实招聘需求'],
      salary: '需以招聘平台为准',
      location: '按目标城市筛选',
      industry: targetIndustry,
      isLocalFallback: true
    }));
  };

  // 拉取行业列表（DeepSeek Taxonomy）
  useEffect(() => {
    const loadIndustries = async () => {
      try {
        setTaxonomyLoading(true);
        const resp = await fetch(apiUrl('/api/deepseek/taxonomy') + '?kind=industries');
        const data = await resp.json().catch(() => ({}));
        const list = Array.isArray(data?.industries) ? data.industries : [];
        setIndustries(list);
      } catch (e) {
        console.warn('加载行业列表失败:', e);
      } finally {
        setTaxonomyLoading(false);
      }
    };
    loadIndustries();
  }, []);

  // 根据已选行业拉取岗位列表（DeepSeek Taxonomy）
  useEffect(() => {
    const loadPositions = async () => {
      if (!filterIndustry) {
        setPositions([]);
        return;
      }
      try {
        setTaxonomyLoading(true);
        const resp = await fetch(
          apiUrl('/api/deepseek/taxonomy') + `?kind=positions&industry=${encodeURIComponent(filterIndustry)}`
        );
        const data = await resp.json().catch(() => ({}));
        const list = Array.isArray(data?.positions) ? data.positions : [];
        setPositions(list);
      } catch (e) {
        console.warn('加载岗位列表失败:', e);
        setPositions([]);
      } finally {
        setTaxonomyLoading(false);
      }
    };
    loadPositions();
  }, [filterIndustry]);

  // 调用 DeepSeek 生成岗位推荐（可融合行业/岗位提示）
  const fetchRecommendations = async (opts?: { industry?: string; positionHints?: string[] }) => {
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
          const resp = await fetch(apiUrl('/api/extract-text'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: base64 })
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
        `【AI分析摘要】${trimmedAnalysis || '（无）'}\n` +
        `【指定行业】${opts?.industry || filterIndustry || '（未指定）'}\n` +
        `【岗位词典提示】${(opts?.positionHints?.slice(0, 15) || positions.slice(0, 15)).join('、') || '（未指定）'}\n\n` +
        `请生成10个岗位推荐（贴合中国职场），并返回JSON数组。每项需包含匹配度、城市、行业、技能要求与简要描述，匹配理由要体现简历与测评的关联。优先从“岗位词典提示”中选择或衍生相近岗位，若不适用再综合其他信息。`
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

      if (jobs.length === 0) throw new Error('AI未返回有效岗位推荐');
      setRecommendedJobs(jobs);
      setCurrentStep(3);
    } catch (e: any) {
      const fallbackJobs = buildLocalRecommendations();
      setRecommendedJobs(fallbackJobs);
      setCurrentStep(3);
      setError(`${e.message || '生成岗位推荐失败'}，已切换为本地职业方向建议。`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初次进入页面生成岗位推荐
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 根据当前行业/岗位提示重新生成推荐
  const regenerateWithIndustry = async () => {
    await fetchRecommendations({ industry: filterIndustry, positionHints: positions });
  };

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

  const getMatchBreakdown = (score: number) => ({
    skills: Math.max(45, Math.min(98, score - 4)),
    evidence: Math.max(40, Math.min(96, score - 8)),
    growth: Math.max(50, Math.min(99, score + 3))
  });

  const jobsSource = (recommendedJobs && recommendedJobs.length > 0) ? recommendedJobs : buildLocalRecommendations();
  const filteredJobs = jobsSource.filter(job => {
    const cityMatch = !filterCity || job.location.includes(filterCity);
    const industryMatch = !filterIndustry || job.industry.includes(filterIndustry);
    const positionMatch = !filterPosition || job.title.includes(filterPosition) || job.description.includes(filterPosition);
    return cityMatch && industryMatch && positionMatch;
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
                  onChange={(e) => {
                    setFilterIndustry(e.target.value);
                    setFilterPosition('');
                  }}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="">所有行业</option>
                  {taxonomyLoading && <option value="">加载行业中...</option>}
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center text-gray-300">
                <span className="text-sm">找到 {filteredJobs.length} 个匹配职位</span>
              </div>
            </div>
          </div>

          {/* Positions chips */}
          {positions.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400">快速筛选岗位（来自行业词典）</span>
                </div>
                <button
                  onClick={regenerateWithIndustry}
                  className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg border border-purple-500"
                >
                  按当前行业刷新推荐
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {positions.slice(0, 24).map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilterPosition(prev => prev === p ? '' : p)}
                    className={
                      `px-3 py-1 text-xs rounded-full border ` +
                      (filterPosition === p
                        ? 'bg-purple-700 border-purple-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600')
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                    {job.isLocalFallback && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                        方向建议
                      </span>
                    )}
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
                    <span className="text-green-400 ml-1">{getMatchBreakdown(job.matchScore).skills}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">证据强度：</span>
                    <span className="text-yellow-400 ml-1">{getMatchBreakdown(job.matchScore).evidence}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">发展前景：</span>
                    <span className="text-blue-400 ml-1">{getMatchBreakdown(job.matchScore).growth}%</span>
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
            <div className="grid gap-3 md:grid-cols-2">
              {jobsSource
                .filter(job => selectedJobs.includes(job.id))
                .slice(0, 4)
                .map(job => (
                  <div key={job.id} className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{job.title}</p>
                        <p className="text-sm text-gray-400">{job.company} · {job.location}</p>
                      </div>
                      <span className={`font-bold ${getMatchScoreColor(job.matchScore)}`}>{job.matchScore}%</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {job.requirements.slice(0, 3).map(req => (
                        <span key={req} className="rounded-full bg-gray-700 px-2 py-1 text-xs text-gray-300">{req}</span>
                      ))}
                    </div>
                  </div>
                ))}
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
