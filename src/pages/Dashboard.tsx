import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle,
  Clock,
  FileText,
  Radar,
  Target,
  TrendingUp,
  Video
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkflow } from '../contexts/WorkflowContext';
import BackButton from '../components/ui/BackButton';

const Dashboard = () => {
  const { user } = useAuth();
  const { assessmentData, recommendedJobs, selectedJob, optimizedResume, careerPlan } = useWorkflow();

  const careerProfile = assessmentData.careerProfile;
  const hasAssessment = Boolean(careerProfile);
  const hasJobs = recommendedJobs.length > 0;
  const hasResumeSignal = Boolean(optimizedResume || assessmentData.resumeText || assessmentData.resume);
  const hasCareerPlan = Boolean(careerPlan);
  const completionItems = [hasAssessment, hasJobs, Boolean(selectedJob), hasResumeSignal, hasCareerPlan];
  const completion = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);

  const nextAction = !hasAssessment
    ? { title: '先完成职业测评', desc: '建立职业画像，后续岗位、简历和面试才有个性化依据。', href: '/assessment', cta: '开始测评' }
    : !hasJobs
      ? { title: '生成岗位策略', desc: '明确城市、经验和目标岗位后，验证最值得投入的方向。', href: '/jobs', cta: '制定策略' }
      : !selectedJob
        ? { title: '选择一个目标岗位', desc: '先聚焦一个岗位，才能做针对性简历和面试训练。', href: '/jobs', cta: '选择岗位' }
        : !hasResumeSignal
          ? { title: '优化目标岗位简历', desc: '对照 JD 找关键词缺口，提升 ATS 通过率和面试邀约率。', href: '/resume', cta: '优化简历' }
          : { title: '进入面试训练', desc: '用目标岗位问题训练表达、案例和追问应对。', href: '/interview', cta: '开始面试' };

  const growthSystem = [
    {
      title: '职业画像',
      desc: hasAssessment ? `主方向：${careerProfile?.primaryDirection.role}` : '尚未开始',
      href: '/assessment',
      icon: <Radar className="h-5 w-5" />,
      done: hasAssessment
    },
    {
      title: '岗位策略',
      desc: hasJobs ? `${recommendedJobs.length} 个待验证方向` : '等待生成岗位策略',
      href: '/jobs',
      icon: <Briefcase className="h-5 w-5" />,
      done: hasJobs
    },
    {
      title: '简历转化',
      desc: hasResumeSignal ? '已有简历优化信号' : '等待目标岗位与简历',
      href: '/resume',
      icon: <FileText className="h-5 w-5" />,
      done: hasResumeSignal
    },
    {
      title: '面试训练',
      desc: selectedJob ? `围绕 ${selectedJob.title}` : '先选择目标岗位',
      href: '/interview',
      icon: <Video className="h-5 w-5" />,
      done: false
    }
  ];

  const evidence = [
    careerProfile ? `报告主方向：${careerProfile.primaryDirection.role}` : '暂无职业报告',
    selectedJob ? `目标岗位：${selectedJob.title}` : '尚未锁定目标岗位',
    assessmentData.major ? `专业背景：${assessmentData.major}` : '专业背景未填写',
    careerProfile?.evidence.length ? `当前信号：${careerProfile.evidence.map(item => item.claim).slice(0, 2).join('、')}` : '求职证据待补充'
  ];

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-gray-700 bg-gray-800/60 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">Career Growth OS</p>
              <h1 className="text-4xl font-bold text-white md:text-5xl">
                {user?.name ? `${user.name}，` : ''}把职业规划变成可执行系统
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-300">
                你的产品不应该只给建议，而要把测评、岗位、简历、面试和行动计划串成闭环。当前进度 {completion}%。
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={nextAction.href}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-gray-950 transition hover:bg-emerald-400"
                >
                  {nextAction.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  to="/ai-chat"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-600 px-6 py-3 font-semibold text-gray-200 transition hover:border-gray-400 hover:bg-gray-700"
                >
                  咨询 AI 职业规划师
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-950/50 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-400">当前最高优先级</span>
                <Target className="h-5 w-5 text-emerald-300" />
              </div>
              <h2 className="text-2xl font-bold text-white">{nextAction.title}</h2>
              <p className="mt-3 text-gray-300">{nextAction.desc}</p>
              <div className="mt-6 h-2 rounded-full bg-gray-700">
                <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-blue-400" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-4">
          {growthSystem.map((item) => (
            <Link
              key={item.title}
              to={item.href}
              className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5 transition hover:-translate-y-1 hover:border-emerald-400/60 hover:bg-gray-800"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-gray-700 p-3 text-emerald-300">{item.icon}</div>
                {item.done ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Clock className="h-5 w-5 text-gray-500" />}
              </div>
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.desc}</p>
            </Link>
          ))}
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">决策证据</h2>
              <BarChart3 className="h-6 w-6 text-blue-300" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {evidence.map((item) => (
                <div key={item} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-gray-300">
                  {item}
                </div>
              ))}
            </div>
            {careerProfile?.gaps.length ? (
              <div className="mt-6">
                <h3 className="mb-3 font-semibold text-white">优先补齐</h3>
                <div className="flex flex-wrap gap-2">
                  {careerProfile.gaps.slice(0, 3).map((gap) => (
                    <span key={gap} className="rounded-full bg-blue-500/15 px-3 py-1 text-sm text-blue-200">
                      {gap}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <div className="mb-4 flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-emerald-300" />
              <h2 className="text-2xl font-bold text-white">增长建议</h2>
            </div>
            <div className="space-y-4 text-gray-200">
              <p>先锁定一个目标岗位，再围绕该岗位做简历关键词、项目证据和面试故事线。不要同时追十个方向。</p>
              <p>每次测评和简历优化都应沉淀为下一步动作：投递岗位、补一个项目、练一组面试题。</p>
              <p>核心不是多一个 AI 功能，而是让用户持续减少求职不确定性，形成从认知到投递再到面试的复利闭环。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
