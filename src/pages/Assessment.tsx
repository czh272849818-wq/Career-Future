import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Users,
  Target,
  Upload,
  FileText,
  Bot,
  Sparkles
} from 'lucide-react';
import { useAssessment } from '../contexts/AssessmentContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkflow, type CareerProfile, type CareerReadiness } from '../contexts/WorkflowContext';
import ProgressBar from '../components/ui/ProgressBar';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';
import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE } from '../llm/config';
import { apiUrl } from '../api';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

type StructuredAnalysis = {
  headline?: string;
  summary?: string;
  primaryDirection?: CareerProfile['primaryDirection'];
  alternatives?: CareerProfile['alternatives'];
  evidence?: CareerProfile['evidence'];
  gaps?: string[];
  actionPlan?: CareerProfile['actionPlan'];
};

type AnalysisOutcome = {
  analysisText: string;
  resumeText: string;
  profile: CareerProfile;
};

const Assessment = () => {
  const [selectedType, setSelectedType] = useState<'general' | 'industry' | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [showHint, setShowHint] = useState<string>('');
  const [industryValidationError, setIndustryValidationError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(45);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [showOptimizedNotice, setShowOptimizedNotice] = useState(false);
  const [additionalData, setAdditionalData] = useState({
    resume: null as File | null,
    values: '',
    personality: '',
    major: ''
  });
  // AI analysis states
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isEditingDirection, setIsEditingDirection] = useState(false);
  const [targetRoleDraft, setTargetRoleDraft] = useState('');
  // 新增：题库优化提示
  // 已在顶部声明 showOptimizedNotice，避免重复
  
  // 新增：简历文本提取状态
  const [resumeText, setResumeText] = useState('');
  const [resumeExtracting, setResumeExtracting] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [resumeMethod, setResumeMethod] = useState<string>('');
  const [ocrPdfLoading, setOcrPdfLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // 在 Netlify 域上若相对路径返回 HTML/404，则自动改用函数路径
  const postExtractText = async (payload: { fileName: string; mimeType: string; dataBase64: string }) => {
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };
    let resp = await fetch(apiUrl('/api/extract-text'), init);
    const ct = resp.headers?.get('content-type') || '';
    const looksHtml = ct.includes('text/html');
    const onNetlify = typeof window !== 'undefined' && /netlify\.app$/i.test(window.location.hostname);
    if ((!resp.ok || looksHtml) && onNetlify) {
      try {
        resp = await fetch('/.netlify/functions/extract-text', init);
      } catch {}
    }
    return resp;
  };
  const { setCurrentStep, updateAssessmentData, selectJob } = useWorkflow();
  const {
    currentAssessment,
    currentQuestionIndex,
    answers,
    startAssessment,
    answerQuestion,
    nextQuestion,
    previousQuestion,
    completeAssessment,
    getAssessmentHistory,
    getIndustryPositions,
    // 新增：生成状态与题库来源
    isGenerating,
    lastQuestionSource,
    generationError
  } = useAssessment();
  const [selectedIndustryLocal, setSelectedIndustryLocal] = useState<string>('');
  const [selectedPositionLocal, setSelectedPositionLocal] = useState<string>('');
  const industryPositions = getIndustryPositions();
  const industries = Object.keys(industryPositions);

  // DeepSeek taxonomy 远程数据（行业与岗位），含加载与错误状态
  const [industriesRemote, setIndustriesRemote] = useState<string[] | null>(null);
  const [positionsRemote, setPositionsRemote] = useState<string[] | null>(null);
  const [taxLoadingIndustries, setTaxLoadingIndustries] = useState<boolean>(false);
  const [taxLoadingPositions, setTaxLoadingPositions] = useState<boolean>(false);
  const [taxError, setTaxError] = useState<string>('');

  // 加载行业列表（优先调用 Edge taxonomy，失败时回退 DeepSeek chat，再失败回退本地）
  useEffect(() => {
    let cancelled = false;
    const loadIndustries = async () => {
      setTaxLoadingIndustries(true);
      setTaxError('');
      try {
        const base = apiUrl('/api/deepseek/taxonomy');
        const resp = await fetch(`${base}?kind=industries`);
        const ct = resp.headers?.get('content-type') || '';
        if (resp.ok && ct.includes('application/json')) {
          const data = await resp.json();
          const names: string[] = Array.isArray(data?.industries) ? data.industries : [];
          if (!cancelled && names.length > 0) {
            setIndustriesRemote(names);
            return;
          }
        }
        throw new Error('taxonomy endpoint failed');
      } catch (_) {
        // 回退到 /deepseek/chat 生成行业列表
        try {
          const sys = '你是行业分类专家。只返回JSON对象 {"industries": [string...] }，且中文，不要其他文本。';
          const user = '请生成中国语境下的行业列表，最多60项，去重规范，仅返回JSON。';
          const resp = await fetch(apiUrl('/api/deepseek/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: sys },
                { role: 'user', content: user }
              ],
              model: DEFAULT_LLM_MODEL,
              temperature: Math.min(0.3, DEFAULT_TEMPERATURE),
              stream: false
            })
          });
          if (!resp.ok) throw new Error(await resp.text());
          const data = await resp.json();
          let content = String(data?.choices?.[0]?.message?.content || '');
          content = content.trim().replace(/^```json|^```|```$/g, '');
          const json = JSON.parse(content);
          const names: string[] = Array.isArray(json?.industries) ? json.industries : [];
          if (!cancelled && names.length > 0) {
            setIndustriesRemote(names);
            return;
          }
        } catch (e) {
          if (!cancelled) setTaxError('行业列表加载失败，已使用本地数据');
        }
      } finally {
        if (!cancelled) setTaxLoadingIndustries(false);
      }
    };
    loadIndustries();
    return () => { cancelled = true; };
  }, []);

  // 加载岗位列表（基于选择的行业）
  useEffect(() => {
    if (!selectedIndustryLocal) { setPositionsRemote(null); return; }
    let cancelled = false;
    const loadPositions = async () => {
      setTaxLoadingPositions(true);
      setTaxError('');
      try {
        const base = apiUrl('/api/deepseek/taxonomy');
        const resp = await fetch(`${base}?kind=positions&industry=${encodeURIComponent(selectedIndustryLocal)}`);
        const ct = resp.headers?.get('content-type') || '';
        if (resp.ok && ct.includes('application/json')) {
          const data = await resp.json();
          const names: string[] = Array.isArray(data?.positions) ? data.positions : [];
          if (!cancelled && names.length > 0) {
            setPositionsRemote(names);
            return;
          }
        }
        throw new Error('taxonomy endpoint failed');
      } catch (_) {
        // 回退到 /deepseek/chat 生成岗位列表
        try {
          const sys = '你是岗位分类专家。只返回JSON对象 {"positions": [string...] }，中文，不要其他文本。';
          const user = `请生成行业「${selectedIndustryLocal}」的常见岗位列表，最多60项，仅返回JSON。`;
          const resp = await fetch(apiUrl('/api/deepseek/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: sys },
                { role: 'user', content: user }
              ],
              model: DEFAULT_LLM_MODEL,
              temperature: Math.min(0.3, DEFAULT_TEMPERATURE),
              stream: false
            })
          });
          if (!resp.ok) throw new Error(await resp.text());
          const data = await resp.json();
          let content = String(data?.choices?.[0]?.message?.content || '');
          content = content.trim().replace(/^```json|^```|```$/g, '');
          const json = JSON.parse(content);
          const names: string[] = Array.isArray(json?.positions) ? json.positions : [];
          if (!cancelled && names.length > 0) {
            setPositionsRemote(names);
            return;
          }
        } catch (e) {
          if (!cancelled) setTaxError('岗位列表加载失败，已使用本地数据');
        }
      } finally {
        if (!cancelled) setTaxLoadingPositions(false);
      }
    };
    loadPositions();
    return () => { cancelled = true; };
  }, [selectedIndustryLocal]);

  // DeepSeek题库优化成功时，弹出短暂提示
  useEffect(() => {
    if (lastQuestionSource === 'deepseek') {
      setShowOptimizedNotice(true);
      const t = setTimeout(() => setShowOptimizedNotice(false), 2500);
      return () => clearTimeout(t);
    }
  }, [lastQuestionSource]);

  const currentQuestion = currentAssessment[currentQuestionIndex];
  const progress = currentAssessment.length > 0 ? ((currentQuestionIndex + 1) / currentAssessment.length) * 100 : 0;
  const isLastQuestion = currentQuestionIndex === currentAssessment.length - 1;
  const assessmentHistory = getAssessmentHistory();

  const buildFallbackCareerProfile = (): CareerProfile => {
    const role = selectedPositionLocal || (selectedIndustryLocal
      ? `${selectedIndustryLocal}相关岗位`
      : `${additionalData.major || '当前专业'}相关初阶岗位`);
    const hasResume = Boolean(resumeText.trim() || additionalData.resume);
    const evidence = [
      { claim: '已完成职业偏好与能力倾向测评', source: '测评选择' },
      additionalData.major ? { claim: `具备${additionalData.major}专业背景`, source: '补充信息' } : null,
      hasResume ? { claim: '已提供过往经历材料，可用于验证项目证据', source: '简历经历' } : null
    ].filter((item): item is { claim: string; source: string } => Boolean(item));

    return {
      generatedAt: new Date().toISOString(),
      headline: `先围绕「${role}」验证真实机会`,
      summary: '这是一份基于当前测评与补充信息生成的起点方案。先确认岗位要求，再用简历和面试反馈持续修正。',
      primaryDirection: {
        role,
        industry: selectedIndustryLocal || undefined,
        readiness: hasResume ? 'build_evidence' : 'explore',
        rationale: hasResume ? '已有经历材料，下一步应验证岗位要求并补齐关键证据。' : '当前信息不足以判断可直接投递性，应先验证一个具体岗位方向。'
      },
      alternatives: [
        { role: '相邻业务岗位', rationale: '用于对比职责、门槛和成长路径。' },
        { role: '项目协同岗位', rationale: '用于验证你的可迁移能力是否更适合跨团队推进。' }
      ],
      evidence,
      gaps: hasResume ? ['把项目经历改写成可验证的结果', '补齐目标岗位高频技能证据'] : ['补充一份简历或项目经历', '选择一个可验证的目标岗位'],
      actionPlan: [
        { title: '确认目标岗位', detail: '查看岗位要求，排除不符合的方向。', destination: 'jobs' },
        { title: '建立投递证据', detail: '围绕目标岗位重写一版简历。', destination: 'resume' },
        { title: '验证表达能力', detail: '用目标岗位高频题完成一次面试训练。', destination: 'interview' }
      ]
    };
  };

  const parseCareerProfile = (raw: unknown, fallback: CareerProfile): CareerProfile => {
    if (!raw || typeof raw !== 'object') return fallback;
    const value = raw as Record<string, unknown>;
    const text = (input: unknown, max = 100) => typeof input === 'string' ? input.trim().slice(0, max) : '';
    const list = (input: unknown, max = 3) => Array.isArray(input)
      ? input.map(item => text(item)).filter(Boolean).slice(0, max)
      : [];
    const rawPrimary = value.primaryDirection && typeof value.primaryDirection === 'object'
      ? value.primaryDirection as Record<string, unknown>
      : {};
    const readiness = text(rawPrimary.readiness) as CareerReadiness;
    const primaryDirection = {
      role: text(rawPrimary.role, 60) || fallback.primaryDirection.role,
      industry: text(rawPrimary.industry, 40) || fallback.primaryDirection.industry,
      readiness: ['ready_now', 'build_evidence', 'explore'].includes(readiness) ? readiness : fallback.primaryDirection.readiness,
      rationale: text(rawPrimary.rationale, 120) || fallback.primaryDirection.rationale
    };
    const alternatives = Array.isArray(value.alternatives)
      ? value.alternatives.map(item => {
        const alternative = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return { role: text(alternative.role, 60), rationale: text(alternative.rationale, 100) };
      }).filter(item => item.role && item.rationale).slice(0, 2)
      : [];
    const evidence = Array.isArray(value.evidence)
      ? value.evidence.map(item => {
        const entry = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return { claim: text(entry.claim, 100), source: text(entry.source, 24) };
      }).filter(item => item.claim && item.source).slice(0, 3)
      : [];
    const actionPlan = Array.isArray(value.actionPlan)
      ? value.actionPlan.map(item => {
        const action = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        const destination = text(action.destination) as CareerProfile['actionPlan'][number]['destination'];
        return {
          title: text(action.title, 50),
          detail: text(action.detail, 100),
          destination: ['jobs', 'resume', 'interview'].includes(destination) ? destination : 'jobs'
        };
      }).filter(item => item.title && item.detail).slice(0, 3)
      : [];

    return {
      generatedAt: new Date().toISOString(),
      headline: text(value.headline, 80) || fallback.headline,
      summary: text(value.summary, 180) || fallback.summary,
      primaryDirection,
      alternatives: alternatives.length ? alternatives : fallback.alternatives,
      evidence: evidence.length ? evidence : fallback.evidence,
      gaps: list(value.gaps).length ? list(value.gaps) : fallback.gaps,
      actionPlan: actionPlan.length ? actionPlan : fallback.actionPlan
    };
  };

  // Timer effect
  useEffect(() => {
    if (isTimerActive && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeRemaining === 0) {
      setIsTimerActive(false);
    }
  }, [isTimerActive, timeRemaining]);

  // Start timer when question loads
  useEffect(() => {
    if (currentQuestion && !showResult) {
      setTimeRemaining(45);
      setIsTimerActive(true);
      setSelectedAnswer(answers[currentQuestion.id] || '');
    }
  }, [currentQuestion, showResult, answers]);

  const handleStartAssessment = (type: 'general' | 'industry') => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    setSelectedType(type);
    startAssessment(type);
    setShowResult(false);
    setCurrentResult(null);
  };

  // 行业专项测评入口：校验并启动
  const handleStartIndustryAssessment = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!selectedIndustryLocal || !selectedPositionLocal) {
      setIndustryValidationError('请先选择行业和二级岗位，再开始专项测评。');
      return;
    }
    setIndustryValidationError('');
    setSelectedType('industry');
    startAssessment('industry', selectedIndustryLocal, selectedPositionLocal);
    setShowResult(false);
    setCurrentResult(null);
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files![0];
      setAdditionalData(prev => ({ ...prev, resume: file }));
      // 提取文本
      setResumeExtracting(true);
      setResumeError('');
      setResumeText('');
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const idx = res.indexOf(',');
            resolve(idx >= 0 ? res.slice(idx + 1) : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const resp = await postExtractText({ fileName: file.name, mimeType: file.type, dataBase64: base64 });
        if (!resp.ok) {
          // 后端解析失败，前端自动回退：先客户端文本提取，再OCR
          const clientText = await tryPdfTextClient();
          if (clientText && clientText.trim().length >= 50) {
            setResumeText(clientText.slice(0, 12000));
            setResumeMethod('pdf-client');
          } else {
            const ocrText = await tryOcrPdfClient();
            if (ocrText && ocrText.trim().length > 0) {
              setResumeText(ocrText.slice(0, 12000));
              setResumeMethod('ocr-pdf-client');
            } else {
              const t = await resp.text();
              throw new Error(t || 'extract failed');
            }
          }
        } else {
          const data = await resp.json();
          setResumeText(String(data?.text || '').slice(0, 12000));
          setResumeMethod(String(data?.method || ''));
          // 若为PDF且解析文本过短，优先客户端文本提取，再OCR
          if (String(data?.method || '') === 'pdf' && String(data?.text || '').trim().length < 100) {
            try {
              const clientText2 = await tryPdfTextClient();
              if (clientText2 && clientText2.trim().length >= 100) {
                setResumeText(clientText2.slice(0, 12000));
                setResumeMethod('pdf-client');
              } else {
                const ocrText2 = await tryOcrPdfClient();
                if (ocrText2 && ocrText2.trim().length > 0) {
                  setResumeText(ocrText2.slice(0, 12000));
                  setResumeMethod('ocr-pdf-client');
                }
              }
            } catch {}
          }
        }
      } catch (err: any) {
        setResumeError('简历文本提取失败，请尝试上传TXT/DOCX或检查文件是否加密');
        console.warn('[ResumeExtract] error:', err);
      } finally {
        setResumeExtracting(false);
      }
    }
  };

  async function tryPdfTextClient(): Promise<string | null> {
    try {
      if (!additionalData.resume) return null;
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const file = additionalData.resume;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent: any = await page.getTextContent();
        const pageText = (textContent.items || []).map((it: any) => String(it?.str || '')).join(' ');
        fullText += `\n${pageText}`;
      }

      return fullText.trim().length > 0 ? fullText : null;
    } catch (err) {
      console.warn('[PDF-Client] error:', err);
      return null;
    }
  }

  // 客户端PDF→图片→OCR识别（用于扫描件PDF）
  async function tryOcrPdfClient(): Promise<string | null> {
    try {
      if (!additionalData.resume) return null;
      setOcrPdfLoading(true);
      // 使用 CDN worker，避免本地worker配置复杂
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const file = additionalData.resume;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      const scale = 1.5;
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];

        const resp = await postExtractText({
          fileName: `${file.name}#page-${pageNum}.png`,
          mimeType: 'image/png',
          dataBase64: base64Data,
        });
        const json = await resp.json();
        if (json?.text) fullText += `\n${json.text}`;
      }

      if (fullText.trim().length > 0) {
        setResumeText(fullText);
        setResumeMethod('ocr-pdf-client');
        return fullText;
      }
      return null;
    } catch (err) {
      console.error('[OCR-PDF] error:', err);
      setResumeError('PDF OCR识别失败，请尝试上传DOCX/TXT或清晰图片');
      return null;
    } finally {
      setOcrPdfLoading(false);
    }
  }

  // 新增：在题库生成完成前的门禁界面
  if (selectedType && isGenerating) {
    return (
      <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <WorkflowProgress />
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">正在生成AI题库</h2>
            <p className="text-gray-300 mb-6">{selectedType === 'industry' ? `行业：${selectedIndustryLocal || '未选择'}，岗位：${selectedPositionLocal || '未选择'}` : '通用职业测评'}</p>
            <p className="text-sm text-gray-400">生成通常耗时3-8秒，请耐心等待完成后开始作答</p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedType && !isGenerating && !currentAssessment[0]) {
    return (
      <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <WorkflowProgress />
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-600 to-orange-600 rounded-full mb-6">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">AI题库生成失败</h2>
            <p className="text-gray-300 mb-6">{generationError || '请稍后重试或返回选择页'}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  if (selectedType === 'industry') {
                    startAssessment('industry', selectedIndustryLocal, selectedPositionLocal);
                  } else {
                    startAssessment('general');
                  }
                }}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
              >
                重新生成AI题库
              </button>
              <button
                onClick={() => setSelectedType(null)}
                className="inline-flex items-center px-6 py-3 border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:border-gray-500 hover:bg-gray-700 transition-all duration-200"
              >
                返回选择页
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAnswerSelect = (answerId: string, hint?: string) => {
    setSelectedAnswer(answerId);
    if (currentQuestion) {
      answerQuestion(currentQuestion.id, answerId);
    }
    setShowHint(hint || '');
    setIsTimerActive(false);
  };

  const handleNext = () => {
    if (!selectedAnswer) return;

    if (isLastQuestion) {
      // 完成最后一题后进入完善个人信息页
      setShowAdditionalInfo(true);
    } else {
      nextQuestion();
      setSelectedAnswer('');
      setShowHint('');
    }
  };

  // The report is a decision aid, not a psychometric scorecard. One model call builds the full profile.
  const analyzeAdditionalInfo = async (): Promise<AnalysisOutcome> => {
    let finalResumeText = resumeText || '';

    try {
      setAiAnalyzing(true);
      setAiError('');

      if (!finalResumeText && additionalData.resume) {
        const file = additionalData.resume;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const response = await postExtractText({ fileName: file.name, mimeType: file.type, dataBase64: base64 });
        const data = await response.json();
        finalResumeText = String(data?.text || '').slice(0, 12000);
        setResumeText(finalResumeText);
        setResumeMethod(String(data?.method || ''));
      }

      const fallback = buildFallbackCareerProfile();
      const answerSummary = currentAssessment.map(question => {
        const option = question.options.find(item => item.id === answers[question.id]);
        return option ? `${question.question}：${option.text}` : '';
      }).filter(Boolean).join('\n');
      const userContent = [
        `【测评选择】\n${answerSummary || '未完成'}`,
        `【简历文本】\n${finalResumeText || '未上传'}`,
        `【价值观】\n${additionalData.values || '未填写'}`,
        `【性格补充】\n${additionalData.personality || '未填写'}`,
        `【专业】\n${additionalData.major || '未填写'}`,
        `【已选行业/岗位】\n${selectedIndustryLocal || '未选'} / ${selectedPositionLocal || '未选'}`,
        '只输出一个合法 JSON 对象：' + JSON.stringify({
          headline: '一句话职业判断',
          summary: '不超过 120 字的判断边界',
          primaryDirection: { role: '具体岗位方向', industry: '行业或空字符串', readiness: 'ready_now | build_evidence | explore', rationale: '判断依据' },
          alternatives: [{ role: '备选方向', rationale: '与主方向的区别' }],
          evidence: [{ claim: '可验证的事实', source: '测评选择 | 简历经历 | 补充信息' }],
          gaps: ['需要补齐的证据或技能'],
          actionPlan: [{ title: '7 天内可完成的任务', detail: '明确产出物', destination: 'jobs | resume | interview' }]
        }),
        '约束：主方向只能是岗位假设，不得声称保证录用；证据必须来自上述资料；备选方向最多 2 个，证据、差距、任务各最多 3 条；不要输出分数、人格类型、标签或 Markdown。'
      ].join('\n\n');

      const response = await fetch(apiUrl('/api/deepseek/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: '你是职业决策助手。只依据用户资料输出短小、可执行的职业假设，严格输出 JSON。' },
            { role: 'user', content: userContent }
          ],
          model: DEFAULT_LLM_MODEL,
          temperature: Math.min(0.3, DEFAULT_TEMPERATURE),
          stream: false
        })
      });
      if (!response.ok) throw new Error('career profile request failed');

      const data = await response.json();
      const content = String(data?.choices?.[0]?.message?.content || '');
      const first = content.indexOf('{');
      const last = content.lastIndexOf('}');
      const parsed: StructuredAnalysis = JSON.parse(first >= 0 && last > first ? content.slice(first, last + 1) : content);
      const profile = parseCareerProfile(parsed, fallback);
      const analysisText = [
        profile.headline,
        `主方向：${profile.primaryDirection.role}`,
        `依据：${profile.primaryDirection.rationale}`,
        `差距：${profile.gaps.join('；')}`
      ].join('\n');

      return { analysisText, resumeText: finalResumeText, profile };
    } catch (error) {
      console.warn('[Career profile] using local fallback:', error);
      const profile = {
        ...buildFallbackCareerProfile(),
        summary: 'AI 分析暂时不可用。这是一份基于当前测评与补充信息生成的基础行动方案，需在真实岗位要求中继续验证。'
      };
      setAiError('AI 分析暂时不可用，已生成基础行动方案。');
      return { analysisText: `${profile.headline}\n${profile.summary}`, resumeText: finalResumeText, profile };
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleCompleteAssessment = async () => {
    const { analysisText, resumeText: analyzedResumeText, profile } = await analyzeAdditionalInfo();
    const result = completeAssessment(analysisText || undefined);
    const resultWithProfile = { ...result, careerProfile: profile };
    setCurrentResult(resultWithProfile);
    setTargetRoleDraft(profile.primaryDirection.role);
    setIsEditingDirection(false);
    
    // 更新工作流程数据（包含简历文本与测评详情）
    updateAssessmentData({
      answers,
      resume: additionalData.resume || undefined,
      resumeText: analyzedResumeText || undefined,
      values: additionalData.values,
      personality: additionalData.personality,
      major: additionalData.major,
      completedAt: new Date(),
      aiAnalysis: result.aiAnalysis,
      scores: result.scores,
      traits: result.traits,
      recommendations: result.recommendations,
      industry: profile.primaryDirection.industry,
      targetPosition: profile.primaryDirection.role,
      careerProfile: profile
    });
     
     setShowResult(true);
   };

  const handleGoToJobRecommendations = () => {
    const profile = currentResult?.careerProfile as CareerProfile | undefined;
    if (profile) {
      selectJob({
        id: 'career-profile-primary',
        title: profile.primaryDirection.role,
        company: '目标岗位方向（非真实职位）',
        matchScore: 0,
        description: profile.primaryDirection.rationale,
        requirements: profile.gaps,
        salary: '以真实职位要求为准',
        location: '待选择',
        industry: profile.primaryDirection.industry
      });
    }
    setCurrentStep(2);
    navigate('/jobs');
  };

  const handleSaveDirection = () => {
    const profile = currentResult?.careerProfile as CareerProfile | undefined;
    const role = targetRoleDraft.trim();
    if (!profile || !role) return;
    const nextProfile = {
      ...profile,
      primaryDirection: { ...profile.primaryDirection, role }
    };
    setCurrentResult({ ...currentResult, careerProfile: nextProfile });
    updateAssessmentData({ careerProfile: nextProfile, targetPosition: role });
    setIsEditingDirection(false);
  };

  const handlePrevious = () => {
    previousQuestion();
    setSelectedAnswer('');
    setShowHint('');
    setIsTimerActive(false);
  };

  const handleRestartAssessment = () => {
    setSelectedType(null);
    setShowResult(false);
    setCurrentResult(null);
    setSelectedAnswer('');
    setShowHint('');
    setIsTimerActive(false);
  };

  if (currentQuestion && !showResult && !showAdditionalInfo) {
    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <BackButton />
          </div>
          <WorkflowProgress />

          {/* 题库优化状态提示 */}
          {(isGenerating || showOptimizedNotice) && (
            <div className="mb-4">
              {isGenerating && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/15 border border-blue-600/40 text-blue-200">
                  <Bot className="h-4 w-4" />
                  <span>正在生成AI题库，请稍候...</span>
                </div>
              )}
              {showOptimizedNotice && (
                <div className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/15 border border-green-600/40 text-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <span>题库已优化为 AI 生成版本</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Brain className="h-6 w-6 text-blue-600" />
                <span className="font-semibold text-white">
                  {selectedType === 'general' ? '通用职业测评' : '行业专项测评'}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span
                  className={`px-2 py-1 rounded text-xs border ${
                    lastQuestionSource === 'deepseek'
                      ? 'bg-green-600/20 border-green-600 text-green-200'
                      : 'bg-gray-600/20 border-gray-500 text-gray-300'
                  }`}
                >
                  题库来源：{lastQuestionSource === 'deepseek' ? 'AI生成' : '本地默认'}
                </span>
                <div className="flex items-center space-x-2 text-gray-300">
                  <Clock className="h-4 w-4" />
                  <span className={`font-mono text-sm ${timeRemaining <= 10 ? 'text-red-600' : ''}`}>
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
            
            <ProgressBar value={progress} className="mb-2" />
            <div className="flex justify-between text-sm text-gray-400">
              <span>题目 {currentQuestionIndex + 1} / {currentAssessment.length}</span>
              <span>{Math.round(progress)}% 完成</span>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-8">
              {currentQuestion.question}
            </h2>

            <div className="space-y-4 mb-8">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id, option.hint)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 backdrop-blur-sm ${
                    selectedAnswer === option.id
                      ? 'border-blue-500 bg-blue-500/20 shadow-md transform scale-105'
                      : 'border-gray-600 hover:border-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                      selectedAnswer === option.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-500'
                    }`}>
                      {selectedAnswer === option.id && (
                        <CheckCircle className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{option.text}</p>
                      {option.trait && (
                        <p className="text-sm text-blue-600 mt-1">特质：{option.trait}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Hint Display */}
            {showHint && (
              <div className="mb-6 p-4 rounded-lg bg-purple-600/10 border border-purple-600/40">
                <div className="flex items-center gap-2 text-purple-200">
                  <Lightbulb className="h-4 w-4" />
                  <span>提示：{showHint}</span>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="inline-flex items-center px-4 py-2 text-gray-400 font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一题
              </button>

              <button
                onClick={handleNext}
                disabled={!selectedAnswer}
                className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isLastQuestion ? '完成测评' : '下一题'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showResult && currentResult) {
    const profile = (currentResult.careerProfile as CareerProfile | undefined) || buildFallbackCareerProfile();
    const readinessLabel: Record<CareerReadiness, string> = {
      ready_now: '可开始验证',
      build_evidence: '先补齐证据',
      explore: '需要先探索'
    };

    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <WorkflowProgress />
          <section className="border border-gray-700 bg-gray-800/50 shadow-xl">
            <header className="border-b border-gray-700 px-6 py-7 sm:px-8">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <Sparkles className="h-4 w-4" />
                职业决策报告
              </div>
              <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{profile.headline}</h1>
              <p className="mt-3 max-w-3xl leading-7 text-gray-300">{profile.summary}</p>
            </header>

            <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
              <section className="px-6 py-7 sm:px-8">
                <p className="text-sm text-gray-400">主目标岗位</p>
                {isEditingDirection ? (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={targetRoleDraft}
                      onChange={(event) => setTargetRoleDraft(event.target.value)}
                      aria-label="主目标岗位"
                      className="min-w-0 flex-1 border border-gray-600 bg-gray-900 px-3 py-2 text-lg font-semibold text-white outline-none focus:border-blue-400"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveDirection} className="border border-emerald-400/50 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10">确认</button>
                      <button onClick={() => setIsEditingDirection(false)} className="border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700">取消</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-white">{profile.primaryDirection.role}</h2>
                    <span className="border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">{readinessLabel[profile.primaryDirection.readiness]}</span>
                    <button onClick={() => setIsEditingDirection(true)} className="text-sm text-blue-300 hover:text-blue-200">修改</button>
                  </div>
                )}
                <p className="mt-4 max-w-xl leading-7 text-gray-300">{profile.primaryDirection.rationale}</p>
                <p className="mt-5 text-xs leading-5 text-gray-500">这是待验证的岗位方向，不是岗位录用结论或真实职位。</p>
              </section>

              <section className="border-t border-gray-700 px-6 py-7 lg:border-l lg:border-t-0 sm:px-8">
                <h2 className="text-lg font-semibold text-white">备选方向</h2>
                <div className="mt-4 space-y-4">
                  {profile.alternatives.map((alternative) => (
                    <div key={alternative.role} className="border-l-2 border-gray-600 pl-4">
                      <p className="font-medium text-white">{alternative.role}</p>
                      <p className="mt-1 text-sm leading-6 text-gray-400">{alternative.rationale}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid border-t border-gray-700 lg:grid-cols-2">
              <section className="px-6 py-7 sm:px-8">
                <h2 className="text-lg font-semibold text-white">已有证据</h2>
                <ul className="mt-4 space-y-4">
                  {profile.evidence.map((item) => (
                    <li key={`${item.source}-${item.claim}`} className="flex gap-3 text-sm leading-6 text-gray-300">
                      <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{item.claim}<span className="ml-2 text-xs text-gray-500">来自{item.source}</span></span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="border-t border-gray-700 px-6 py-7 lg:border-l lg:border-t-0 sm:px-8">
                <h2 className="text-lg font-semibold text-white">优先补齐</h2>
                <ol className="mt-4 space-y-4">
                  {profile.gaps.map((gap, index) => (
                    <li key={gap} className="flex gap-3 text-sm leading-6 text-gray-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-gray-600 text-xs text-gray-300">{index + 1}</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <section className="border-t border-gray-700 px-6 py-7 sm:px-8">
              <h2 className="text-lg font-semibold text-white">未来 7 天</h2>
              <ol className="mt-4 divide-y divide-gray-700 border-y border-gray-700">
                {profile.actionPlan.map((action, index) => (
                  <li key={action.title} className="grid gap-2 py-4 sm:grid-cols-[2rem_10rem_1fr] sm:gap-4">
                    <span className="text-sm text-gray-500">{index + 1}</span>
                    <span className="font-medium text-white">{action.title}</span>
                    <span className="text-sm leading-6 text-gray-400">{action.detail}</span>
                  </li>
                ))}
              </ol>
              <button
                onClick={handleGoToJobRecommendations}
                className="mt-6 inline-flex items-center justify-center bg-emerald-400 px-5 py-3 font-semibold text-gray-950 transition hover:bg-emerald-300"
              >
                确认目标岗位，查看岗位要求
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </section>

            <details className="border-t border-gray-700 px-6 py-5 sm:px-8">
              <summary className="cursor-pointer text-sm text-gray-400">查看分析依据</summary>
              <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-gray-400">{currentResult.aiAnalysis || profile.summary}</p>
            </details>
          </section>
          <button onClick={handleRestartAssessment} className="mt-5 text-sm text-gray-500 hover:text-gray-300">重新测评</button>
        </div>
      </div>
    );
  }

  if (showAdditionalInfo) {
    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <WorkflowProgress />
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">完善个人信息</h2>
            <p className="text-gray-300 mb-8">补充简历、价值观与性格信息，可帮助我们生成更贴近你的职业建议。</p>
            
            <div className="space-y-6">

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  上传过往简历 (可选)
                </label>
                <div className="min-h-[18rem] border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="resume-upload"
                    />
                    <label
                      htmlFor="resume-upload"
                      className="cursor-pointer text-purple-400 hover:text-purple-300"
                    >
                      点击上传简历文件
                    </label>
                    <p className="text-gray-500 text-sm mt-1">支持 PDF、DOC、DOCX、TXT 格式</p>
                  </div>
                  {additionalData.resume && (
                    <div className="mt-3 flex items-center justify-center text-green-400">
                      <FileText className="h-4 w-4 mr-2" />
                      <span className="text-sm">{additionalData.resume.name}</span>
                    </div>
                  )}
                  {resumeExtracting && (
                    <p className="mt-2 text-sm text-blue-300">正在提取文本，请稍候...</p>
                  )}
                  {resumeError && (
                    <div className="mt-2 text-sm">
                      <p className="text-red-400">{resumeError}</p>
                      {additionalData.resume && (additionalData.resume.type.includes('pdf') || additionalData.resume.name.toLowerCase().endsWith('.pdf')) && (
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            onClick={async () => {
                              setResumeError('');
                              const clientText = await tryPdfTextClient();
                              if (clientText && clientText.trim().length >= 50) {
                                setResumeText(clientText.slice(0, 12000));
                                setResumeMethod('pdf-client');
                                return;
                              }
                              const ocrText = await tryOcrPdfClient();
                              if (ocrText && ocrText.trim().length > 0) {
                                setResumeText(ocrText.slice(0, 12000));
                                setResumeMethod('ocr-pdf-client');
                              } else {
                                setResumeError('PDF解析失败，请上传DOCX/TXT或清晰图片');
                              }
                            }}
                            className="inline-flex items-center px-3 py-1 bg-yellow-600/30 border border-yellow-500 text-yellow-200 rounded hover:bg-yellow-600/40"
                          >
                            尝试OCR识别PDF
                          </button>
                          <span className="text-gray-400">或改为上传 DOCX/TXT/清晰图片</span>
                        </div>
                      )}
                    </div>
                  )}
                  {resumeText && !resumeExtracting && (
                    <div className="mt-3 text-left">
                      <p className="text-xs text-gray-400 mb-1">文本预览（最多展示前 1000 字）：</p>
                      <div className="max-h-56 overflow-auto text-sm bg-gray-900/60 border border-gray-700 rounded-md p-3 text-gray-200 whitespace-pre-wrap">
                        {resumeText.slice(0, 1000)}
                        {resumeText.length > 1000 ? '…' : ''}
                      </div>
                      {(resumeMethod === 'pdf' && resumeText.length < 100) && (
                        <div className="mt-2 text-xs text-yellow-300">
                          <p>*注意：该PDF可能为扫描件或图片型PDF，文本层为空。建议上传可读文本（DOCX/TXT）或图片以便OCR识别*</p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              onClick={tryOcrPdfClient}
                              disabled={ocrPdfLoading || !additionalData.resume}
                              className="inline-flex items-center px-3 py-1 bg-yellow-600/30 border border-yellow-500 text-yellow-200 rounded hover:bg-yellow-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {ocrPdfLoading ? 'OCR识别中…' : '尝试OCR识别PDF'}
                            </button>
                            <span className="text-gray-400">或改为上传 DOCX/TXT/清晰图片</span>
                          </div>
                        </div>
                      )}
                      {(resumeMethod.startsWith('ocr') && resumeText.length >= 1) && (
                        <p className="mt-2 text-xs text-blue-300">*已使用OCR识别，可能存在错字与段落断裂；为获得更精准分析，推荐上传DOCX/TXT*</p>
                      )}
                    </div>
                  )}
                </div>
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  价值观描述 (可选)
                </label>
                <textarea
                  value={additionalData.values}
                  onChange={(e) => setAdditionalData(prev => ({ ...prev, values: e.target.value }))}
                  placeholder="请描述您的职业价值观，如工作生活平衡、社会影响力、薪资待遇等..."
                  rows={3}
                  className="min-h-28 max-h-80 w-full resize-y p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  性格特点 (可选)
                </label>
                <textarea
                  value={additionalData.personality}
                  onChange={(e) => setAdditionalData(prev => ({ ...prev, personality: e.target.value }))}
                  placeholder="请描述您的性格特点，如内向/外向、细心/大胆、创新/稳重等..."
                  rows={3}
                  className="min-h-28 max-h-80 w-full resize-y p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  所学专业 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={additionalData.major}
                  onChange={(e) => setAdditionalData(prev => ({ ...prev, major: e.target.value }))}
                  placeholder="请输入您的专业，如计算机科学、市场营销、金融学等"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
                  required
                />
              </div>


              {(aiAnalyzing || aiError) && (
                <div className="border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-300">
                  {aiAnalyzing ? '正在生成职业决策报告…' : aiError}
                </div>
              )}
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={() => setShowAdditionalInfo(false)}
                className="inline-flex items-center px-4 py-2 text-gray-400 font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                返回测评
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleCompleteAssessment}
                  disabled={aiAnalyzing || !additionalData.major}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiAnalyzing ? '正在生成分析…' : '完成并生成分析'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentQuestion && !showResult && !showAdditionalInfo) {
    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <WorkflowProgress />

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Brain className="h-6 w-6 text-blue-600" />
                <span className="font-semibold text-white">
                  {selectedType === 'general' ? '通用职业测评' : '行业专项测评'}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Clock className="h-4 w-4" />
                <span className={`font-mono text-sm ${timeRemaining <= 10 ? 'text-red-600' : ''}`}>
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
            
            <ProgressBar value={progress} className="mb-2" />
            <div className="flex justify-between text-sm text-gray-400">
              <span>题目 {currentQuestionIndex + 1} / {currentAssessment.length}</span>
              <span>{Math.round(progress)}% 完成</span>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-8">
              {currentQuestion.question}
            </h2>

            <div className="space-y-4 mb-8">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id, option.hint)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 backdrop-blur-sm ${
                    selectedAnswer === option.id
                      ? 'border-blue-500 bg-blue-500/20 shadow-md transform scale-105'
                      : 'border-gray-600 hover:border-blue-400 hover:bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                      selectedAnswer === option.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-500'
                    }`}>
                      {selectedAnswer === option.id && (
                        <CheckCircle className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{option.text}</p>
                      {option.trait && (
                        <p className="text-sm text-blue-600 mt-1">特质：{option.trait}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Hint Display */}
            {showHint && (
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-300">特质提示</h4>
                    <p className="text-blue-200 text-sm">{showHint}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="inline-flex items-center px-4 py-2 text-gray-400 font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一题
              </button>

              <button
                onClick={handleNext}
                disabled={!selectedAnswer}
                className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isLastQuestion ? '完成测评' : '下一题'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <WorkflowProgress />
        
        <header className="mb-6 flex items-start gap-4 border-b border-gray-700 pb-6">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">职业方向测评</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-300">
              从你的偏好、能力与目标岗位出发，生成下一步求职建议。
            </p>
          </div>
        </header>

        {/* Assessment Types */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* General Assessment */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                  推荐
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">通用职业测评</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                全面评估你的性格特质、能力倾向、价值观念和兴趣爱好，适合初次求职或转行的用户
              </p>
              
              <div className="space-y-3 mb-8">
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  多维度能力评估
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  性格特质分析
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  职业兴趣匹配
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  职业发展建议
                </div>
              </div>
              
              <button
                onClick={() => handleStartAssessment('general')}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
              >
                开始通用测评
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Industry-Specific Assessment */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
                  专业
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">行业专项测评</h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                针对特定行业的专业评估，深度分析行业适配度和专业技能水平，适合有明确行业目标的用户
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  行业适配度分析
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  专业技能评估
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  岗位匹配推荐
                </div>
                <div className="flex items-center text-sm text-gray-400">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  技能提升建议
                </div>
              </div>

              {/* 行业与二级岗位选择 */}
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">选择行业</label>
                  <select
                    value={selectedIndustryLocal}
                    onChange={(e) => {
                      setSelectedIndustryLocal(e.target.value);
                      setSelectedPositionLocal('');
                      setIndustryValidationError('');
                    }}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
                  >
                    <option value="">{taxLoadingIndustries ? '正在加载行业...' : '请选择行业'}</option>
                    {(industriesRemote ?? industries).map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">二级行业/岗位</label>
                  <select
                    value={selectedPositionLocal}
                    onChange={(e) => {
                      setSelectedPositionLocal(e.target.value);
                      setIndustryValidationError('');
                    }}
                    disabled={!selectedIndustryLocal}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white disabled:opacity-50"
                  >
                    <option value="">{selectedIndustryLocal ? (taxLoadingPositions ? '正在加载岗位...' : '请选择岗位') : '请先选择行业'}</option>
                    {(
                      (positionsRemote ?? industryPositions[selectedIndustryLocal] ?? [])
                    ).map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
                <p className={`text-xs ${industryValidationError || taxError ? 'text-yellow-300' : 'text-gray-400'}`}>
                  {industryValidationError || taxError || '选择行业与二级岗位后，再开始专项测评'}
                </p>
              </div>
              
              <button
                onClick={handleStartIndustryAssessment}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg disabled:opacity-50"
                disabled={!selectedIndustryLocal || !selectedPositionLocal}
              >
                开始专项测评
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Assessment History */}
        {isAuthenticated && assessmentHistory.length > 0 && (
          <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">最近的测评记录</h2>
            <div className="space-y-4">
              {assessmentHistory.slice(0, 3).map((result, index) => (
                <div key={result.id} className="border border-gray-600 rounded-lg p-4 hover:border-blue-400 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-white">测评 #{assessmentHistory.length - index}</p>
                      <p className="text-sm text-gray-400">完成时间：{result.completedAt.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.traits.map((trait, traitIndex) => (
                        <span key={traitIndex} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-medium">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                  {result.aiAnalysis && (
                    <p className="mt-3 text-sm text-gray-400">
                      AI分析摘要：{result.aiAnalysis.slice(0, 160)}{result.aiAnalysis.length > 160 ? '…' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Assessment;
