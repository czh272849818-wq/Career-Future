import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';

interface PlanPhase {
  phase: string;
  goal: string;
  actions: string[];
  proof: string;
}

interface CareerPlan {
  currentLevel: string;
  targetLevel: string;
  timeframe: string;
  focus: string[];
  roadmap: PlanPhase[];
}

const CareerPlanning = () => {
  const navigate = useNavigate();
  const { selectedJob, assessmentData, optimizedResume, setCareerPlan } = useWorkflow();
  const [plan, setPlan] = useState<CareerPlan | null>(null);

  const targetTitle = selectedJob?.title || '目标岗位';
  const targetIndustry = selectedJob?.industry || '目标行业';
  const profileEvidence = assessmentData.careerProfile?.evidence.map(item => item.claim).slice(0, 4) || [];
  const missingKeywords = optimizedResume?.analysisResult?.missingKeywords?.slice(0, 6) || [];
  const matchedKeywords = optimizedResume?.analysisResult?.matchedKeywords?.slice(0, 6) || [];
  const coreSkills = selectedJob?.requirements?.slice(0, 5) || missingKeywords.slice(0, 5) || [];

  const generatePlan = () => {
    const generated: CareerPlan = {
      currentLevel: assessmentData.major ? `${assessmentData.major}背景候选人` : '待定位候选人',
      targetLevel: selectedJob ? `${targetIndustry} / ${targetTitle}` : '先锁定一个目标岗位',
      timeframe: '90天',
      focus: [
        selectedJob ? '围绕一个目标岗位建立投递资产' : '先完成岗位选择，避免泛泛规划',
        missingKeywords.length ? `补齐关键词：${missingKeywords.slice(0, 3).join('、')}` : '补齐岗位关键词和项目证据',
        matchedKeywords.length ? `放大已有优势：${matchedKeywords.slice(0, 3).join('、')}` : '沉淀可量化项目成果'
      ],
      roadmap: [
        {
          phase: '第1-30天：定位',
          goal: '明确一个目标岗位，完成简历证据重构',
          actions: [
            selectedJob ? `以「${targetTitle}」为唯一目标重写简历` : '从岗位策略中选择一个目标方向',
            '把每段经历改成 STAR：场景、任务、行动、结果',
            coreSkills.length ? `补齐 ${coreSkills.slice(0, 3).join('、')} 的项目证据` : '整理3个能证明能力的项目案例'
          ],
          proof: '输出一版针对目标岗位的简历和3个面试故事'
        },
        {
          phase: '第31-60天：补短板',
          goal: '针对岗位缺口完成最小可证明作品',
          actions: [
            missingKeywords.length ? `围绕 ${missingKeywords.slice(0, 2).join('、')} 做一个小项目` : '围绕目标岗位做一个小项目',
            '每周复盘一次投递反馈，删除无效方向',
            profileEvidence.length ? `把 ${profileEvidence.slice(0, 2).join('、')} 转化为面试表达素材` : '补充可核验经历，再转化为面试素材'
          ],
          proof: '输出1个作品链接或项目说明，补充到简历'
        },
        {
          phase: '第61-90天：转化',
          goal: '进入高强度投递和面试训练',
          actions: [
            '每周投递10个符合目标条件的真实岗位，而不是海投',
            '用AI面试训练高频问题、追问和反问',
            '根据面试反馈继续压缩简历和故事线'
          ],
          proof: '获得面试邀约或明确下一轮能力缺口'
        }
      ]
    };

    setPlan(generated);
    setCareerPlan(generated);
  };

  const activePlan = plan;

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
        <WorkflowProgress />

        <section className="rounded-3xl border border-gray-700 bg-gray-800/60 p-8 shadow-2xl">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">90-Day Career Sprint</p>
              <h1 className="text-4xl font-bold text-white">职业规划不是愿望清单，是执行系统</h1>
              <p className="mt-4 text-lg leading-8 text-gray-300">
                只围绕一个目标岗位做计划：补齐关键词、产出证据、训练面试，直到拿到反馈。
              </p>
            </div>
            <div className="rounded-2xl border border-gray-700 bg-gray-950/50 p-6">
              <h2 className="mb-4 text-xl font-bold text-white">规划基础</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">目标岗位</span>
                  <span className="text-right text-white">{selectedJob ? targetTitle : '未选择'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">简历分析</span>
                  <span className={optimizedResume ? 'text-emerald-300' : 'text-yellow-300'}>{optimizedResume ? '已完成' : '建议先完成'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-400">职业报告</span>
                  <span className={assessmentData.careerProfile ? 'text-emerald-300' : 'text-yellow-300'}>{assessmentData.careerProfile ? '已生成' : '待补充'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!activePlan ? (
          <div className="mt-8 rounded-2xl border border-gray-700 bg-gray-800/50 p-8 text-center">
            <Target className="mx-auto mb-4 h-12 w-12 text-emerald-300" />
            <h2 className="text-2xl font-bold text-white">生成一个可执行的 90 天计划</h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-300">
              系统会基于目标岗位、简历缺口和职业报告证据生成路线图。没有目标岗位也能生成，但建议先选择岗位。
            </p>
            <button
              onClick={generatePlan}
              className="mt-6 inline-flex items-center rounded-xl bg-emerald-500 px-8 py-4 font-semibold text-gray-950 transition hover:bg-emerald-400"
            >
              <Zap className="mr-2 h-5 w-5" />
              生成90天计划
            </button>
          </div>
        ) : (
          <>
            <section className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6">
                <Target className="mb-4 h-7 w-7 text-blue-300" />
                <h3 className="font-semibold text-white">当前定位</h3>
                <p className="mt-2 text-gray-300">{activePlan.currentLevel}</p>
              </div>
              <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6">
                <TrendingUp className="mb-4 h-7 w-7 text-emerald-300" />
                <h3 className="font-semibold text-white">目标</h3>
                <p className="mt-2 text-gray-300">{activePlan.targetLevel}</p>
              </div>
              <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6">
                <Calendar className="mb-4 h-7 w-7 text-purple-300" />
                <h3 className="font-semibold text-white">周期</h3>
                <p className="mt-2 text-gray-300">{activePlan.timeframe}</p>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-gray-700 bg-gray-800/50 p-8">
              <h2 className="text-2xl font-bold text-white">最高杠杆点</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {activePlan.focus.map(item => (
                  <div key={item} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-gray-300">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 space-y-6">
              {activePlan.roadmap.map((phase, index) => (
                <div key={phase.phase} className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white">{phase.phase}</h3>
                      <p className="mt-2 text-emerald-200">{phase.goal}</p>
                      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.45fr]">
                        <div className="space-y-3">
                          {phase.actions.map(action => (
                            <div key={action} className="flex items-start gap-3">
                              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                              <p className="text-gray-300">{action}</p>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl border border-blue-700 bg-blue-900/20 p-4">
                          <BookOpen className="mb-3 h-5 w-5 text-blue-300" />
                          <p className="text-sm font-semibold text-blue-100">验收标准</p>
                          <p className="mt-2 text-sm text-blue-100">{phase.proof}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <button
                onClick={() => navigate('/interview')}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-blue-700"
              >
                进入面试训练
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center justify-center rounded-xl border border-gray-600 px-6 py-3 font-semibold text-gray-200 transition hover:bg-gray-800"
              >
                返回控制台
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CareerPlanning;
