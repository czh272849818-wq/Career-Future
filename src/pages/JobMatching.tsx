import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, CheckCircle, Search, Target } from 'lucide-react';
import { useWorkflow, type JobBrief, type JobRecommendation } from '../contexts/WorkflowContext';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';
import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE } from '../llm/config';
import { apiUrl } from '../api';

type EditableBrief = Omit<JobBrief, 'updatedAt'>;

type StrategyDirection = {
  title?: unknown;
  industry?: unknown;
  rationale?: unknown;
  evidence?: unknown;
  gaps?: unknown;
  requirements?: unknown;
};

const asText = (value: unknown, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asList = (value: unknown, max = 4) => Array.isArray(value)
  ? value.map(item => asText(item)).filter(Boolean).slice(0, max)
  : [];

const JobMatching = () => {
  const navigate = useNavigate();
  const { assessmentData, recommendedJobs, setRecommendedJobs, selectJob, setCurrentStep, updateAssessmentData } = useWorkflow();
  const careerProfile = assessmentData.careerProfile;
  const [brief, setBrief] = useState<EditableBrief>({
    industry: careerProfile?.primaryDirection.industry || assessmentData.industry || '',
    role: careerProfile?.primaryDirection.role || assessmentData.targetPosition || '',
    city: '',
    experienceLevel: '',
    salaryFloor: '',
    workMode: ''
  });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (assessmentData.jobBrief) {
      const { updatedAt: _updatedAt, ...savedBrief } = assessmentData.jobBrief;
      setBrief(savedBrief);
      return;
    }
    if (careerProfile || assessmentData.targetPosition || assessmentData.industry) {
      setBrief(current => ({
        ...current,
        industry: current.industry || careerProfile?.primaryDirection.industry || assessmentData.industry || '',
        role: current.role || careerProfile?.primaryDirection.role || assessmentData.targetPosition || ''
      }));
    }
  }, [assessmentData.industry, assessmentData.jobBrief, assessmentData.targetPosition, careerProfile]);

  const buildLocalDirections = (): JobRecommendation[] => {
    const primaryTitle = brief.role || careerProfile?.primaryDirection.role || '目标岗位方向';
    const evidence = careerProfile?.evidence.map(item => item.claim).slice(0, 3) || ['请先补充一段项目或工作经历'];
    const sharedGaps = careerProfile?.gaps.slice(0, 3) || ['收集 5 个真实 JD，确认高频要求'];
    const alternatives = careerProfile?.alternatives.slice(0, 2) || [];

    return [
      {
        id: 'direction-primary',
        title: primaryTitle,
        industry: brief.industry,
        description: careerProfile?.primaryDirection.rationale || '先用真实 JD 验证职责、门槛与自身证据。',
        evidence,
        gaps: sharedGaps,
        requirements: ['收集真实 JD', '提取高频职责', '准备可验证案例'],
        city: brief.city,
        experienceLevel: brief.experienceLevel,
        workMode: brief.workMode
      },
      ...alternatives.map((alternative, index) => ({
        id: `direction-alternative-${index + 1}`,
        title: alternative.role,
        industry: brief.industry,
        description: alternative.rationale,
        evidence,
        gaps: sharedGaps,
        requirements: ['对比职责边界', '验证进入门槛', '准备相邻案例'],
        city: brief.city,
        experienceLevel: brief.experienceLevel,
        workMode: brief.workMode
      }))
    ];
  };

  const generateStrategy = async () => {
    if (!brief.industry.trim() || !brief.role.trim() || !consent || loading) return;
    setLoading(true);
    setError('');
    const savedBrief: JobBrief = { ...brief, updatedAt: new Date().toISOString() };
    updateAssessmentData({ jobBrief: savedBrief });

    try {
      const profileContext = careerProfile ? {
        primaryDirection: careerProfile.primaryDirection,
        evidence: careerProfile.evidence,
        gaps: careerProfile.gaps
      } : null;
      const prompt = [
        `【用户目标】${JSON.stringify(savedBrief)}`,
        `【职业决策报告】${JSON.stringify(profileContext)}`,
        `【简历文本】${(assessmentData.resumeText || '').slice(0, 2400) || '未提供'}`,
        '仅输出 JSON 对象：{"directions":[{"title":"岗位方向","industry":"行业","rationale":"为什么先验证该方向","evidence":["已知事实"],"gaps":["需要验证或补齐的差距"],"requirements":["真实 JD 中应重点核验的要求"]}]}。',
        '只给最多 3 个岗位方向。它们不是真实招聘职位，不得编造公司、薪资、职位时效、地域机会或录用概率；不得输出评分、匹配百分比或人格标签。'
      ].join('\n\n');
      const response = await fetch(apiUrl('/api/deepseek/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '你是职业策略助手。只根据用户提供信息生成待验证的岗位方向，严格输出 JSON。' },
            { role: 'user', content: prompt }
          ],
          model: DEFAULT_LLM_MODEL,
          temperature: Math.min(0.3, DEFAULT_TEMPERATURE),
          stream: false
        })
      });
      if (!response.ok) throw new Error('岗位策略服务暂时不可用');

      const data = await response.json();
      const content = String(data?.choices?.[0]?.message?.content || '');
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      const parsed = JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as { directions?: StrategyDirection[] };
      const directions = Array.isArray(parsed.directions) ? parsed.directions : [];
      const nextJobs = directions.map((direction, index): JobRecommendation | null => {
        const title = asText(direction.title, 60);
        if (!title) return null;
        return {
          id: `strategy-${Date.now()}-${index}`,
          title,
          industry: asText(direction.industry, 40) || brief.industry,
          description: asText(direction.rationale, 180) || '需要通过真实 JD 与实际经历继续验证。',
          evidence: asList(direction.evidence, 3),
          gaps: asList(direction.gaps, 3),
          requirements: asList(direction.requirements, 5),
          city: brief.city,
          experienceLevel: brief.experienceLevel,
          workMode: brief.workMode
        };
      }).filter((item): item is JobRecommendation => Boolean(item));

      if (!nextJobs.length) throw new Error('岗位策略返回格式无效');
      setRecommendedJobs(nextJobs);
      setCurrentStep(2);
    } catch (requestError) {
      setRecommendedJobs(buildLocalDirections());
      setCurrentStep(2);
      setError(`${requestError instanceof Error ? requestError.message : '岗位策略生成失败'}，已保留本地待验证方向。`);
    } finally {
      setLoading(false);
    }
  };

  const chooseDirection = (direction: JobRecommendation) => {
    selectJob(direction);
    setCurrentStep(3);
    navigate('/resume');
  };

  const canGenerate = Boolean(brief.industry.trim() && brief.role.trim() && consent && !loading);

  return (
    <main className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4"><BackButton /></div>
        <WorkflowProgress />

        <section className="mt-6 border border-gray-700 bg-gray-800/50 p-6 shadow-xl sm:p-8">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-emerald-400 text-gray-950"><Target className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-emerald-300">岗位策略</p>
              <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">用真实岗位要求验证你的方向</h1>
              <p className="mt-3 max-w-3xl leading-7 text-gray-300">这里生成的是待验证的岗位方向，不是招聘信息、薪资承诺或录用预测。下一步请粘贴真实 JD，再完成简历和面试训练。</p>
            </div>
          </div>
          {careerProfile?.primaryDirection.rationale && (
            <p className="mt-6 border-l-2 border-emerald-300 pl-4 text-sm leading-6 text-gray-300">职业报告依据：{careerProfile.primaryDirection.rationale}</p>
          )}
        </section>

        <section className="mt-6 border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
          <div className="flex items-center gap-3"><Search className="h-5 w-5 text-emerald-300" /><h2 className="text-xl font-semibold text-white">目标条件</h2></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm text-gray-300">行业
              <input value={brief.industry} onChange={event => setBrief(current => ({ ...current, industry: event.target.value }))} placeholder="例如：互联网、金融、教育" className="mt-2 w-full border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-emerald-300" />
            </label>
            <label className="text-sm text-gray-300">目标岗位
              <input value={brief.role} onChange={event => setBrief(current => ({ ...current, role: event.target.value }))} placeholder="例如：AI 产品经理" className="mt-2 w-full border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-emerald-300" />
            </label>
            <label className="text-sm text-gray-300">城市
              <input value={brief.city} onChange={event => setBrief(current => ({ ...current, city: event.target.value }))} placeholder="可选，例如：上海" className="mt-2 w-full border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-emerald-300" />
            </label>
            <label className="text-sm text-gray-300">经验阶段
              <select value={brief.experienceLevel} onChange={event => setBrief(current => ({ ...current, experienceLevel: event.target.value }))} className="mt-2 w-full border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-emerald-300">
                <option value="">未限定</option><option value="应届/实习">应届/实习</option><option value="1-3 年">1-3 年</option><option value="3-5 年">3-5 年</option><option value="5 年以上">5 年以上</option>
              </select>
            </label>
            <label className="text-sm text-gray-300">最低薪资
              <input value={brief.salaryFloor} onChange={event => setBrief(current => ({ ...current, salaryFloor: event.target.value }))} placeholder="可选，例如：20K/月" className="mt-2 w-full border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-emerald-300" />
            </label>
            <label className="text-sm text-gray-300">工作方式
              <select value={brief.workMode} onChange={event => setBrief(current => ({ ...current, workMode: event.target.value }))} className="mt-2 w-full border border-gray-600 bg-gray-900 px-3 py-2 text-white outline-none focus:border-emerald-300">
                <option value="">未限定</option><option value="线下">线下</option><option value="混合">混合</option><option value="远程">远程</option>
              </select>
            </label>
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 border border-gray-700 bg-gray-900/50 p-4 text-sm leading-6 text-gray-300">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-400" />
            <span>我同意将以上目标条件、职业报告和已保存的简历文本发送至 DeepSeek，用于生成岗位策略。未勾选时不会发送。</span>
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="button" onClick={generateStrategy} disabled={!canGenerate} className="inline-flex items-center bg-emerald-400 px-5 py-3 font-semibold text-gray-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? '正在生成策略…' : '生成岗位策略'}<ArrowRight className="ml-2 h-4 w-4" />
            </button>
            {!canGenerate && <p className="text-sm text-gray-400">填写行业与目标岗位，并确认授权后即可生成。</p>}
            {error && <p className="text-sm text-amber-200">{error}</p>}
          </div>
        </section>

        {recommendedJobs.length > 0 ? (
          <section className="mt-6 space-y-4">
            <div className="flex items-center gap-3"><Briefcase className="h-5 w-5 text-emerald-300" /><h2 className="text-xl font-semibold text-white">待验证岗位方向</h2></div>
            {recommendedJobs.map(direction => (
              <article key={direction.id} className="border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold text-white">{direction.title}</h3><span className="border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-xs text-blue-100">待验证方向</span></div>
                    <p className="mt-3 max-w-3xl leading-7 text-gray-300">{direction.description}</p>
                  </div>
                  <button type="button" onClick={() => chooseDirection(direction)} className="inline-flex shrink-0 items-center border border-emerald-300/50 px-4 py-2 font-medium text-emerald-100 transition hover:bg-emerald-300/10">用此方向优化简历<ArrowRight className="ml-2 h-4 w-4" /></button>
                </div>
                <div className="mt-6 grid gap-5 border-t border-gray-700 pt-5 md:grid-cols-3">
                  <div><p className="text-sm font-medium text-emerald-200">已有证据</p><ul className="mt-3 space-y-2 text-sm leading-6 text-gray-300">{(direction.evidence || ['暂无，需用经历材料验证']).map(item => <li key={item} className="flex gap-2"><CheckCircle className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{item}</li>)}</ul></div>
                  <div><p className="text-sm font-medium text-amber-200">待补齐</p><ul className="mt-3 space-y-2 text-sm leading-6 text-gray-300">{(direction.gaps || ['收集真实 JD 后确认']).map(item => <li key={item}>{item}</li>)}</ul></div>
                  <div><p className="text-sm font-medium text-blue-200">核验重点</p><div className="mt-3 flex flex-wrap gap-2">{(direction.requirements || []).map(item => <span key={item} className="border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300">{item}</span>)}</div></div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-6 border border-dashed border-gray-700 bg-gray-800/30 p-8 text-center text-gray-400">提交目标条件后，才会生成岗位策略。</section>
        )}
      </div>
    </main>
  );
};

export default JobMatching;
