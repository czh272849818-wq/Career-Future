import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  CheckCircle,
  ArrowRight,
  Lightbulb,
  BarChart3,
  Users,
  Target,
  Upload,
  FileText,
  Bot
} from 'lucide-react';
import { useAssessment } from '../contexts/AssessmentContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkflow } from '../contexts/WorkflowContext';
import RadarChart from '../components/ui/RadarChart';
import ProgressBar from '../components/ui/ProgressBar';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';
import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE } from '../llm/config';
import { apiUrl } from '../api';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

const Assessment = () => {
  const [selectedType, setSelectedType] = useState<'general' | 'industry' | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [showHint, setShowHint] = useState<string>('');
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
  const [aiAnalysisText, setAiAnalysisText] = useState('');
  const [aiError, setAiError] = useState('');
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
  const { setCurrentStep, updateAssessmentData } = useWorkflow();
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
      // 简单提示；也可改为更精致的UI提示
      alert('请先选择行业和二级岗位');
      return;
    }
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

  // DeepSeek AI analysis for additional info（融合简历、测评、性格、价值观、专业）
  const analyzeAdditionalInfo = async () => {
    try {
      setAiAnalyzing(true);
      setAiError('');
      setAiAnalysisText('');

      // 在分析前确保简历已解析；若未解析则尝试解析
      let finalResumeText = resumeText || '';
      if (!finalResumeText && additionalData.resume) {
        try {
          // 主动触发一次解析（与上传逻辑相同）
          const file = additionalData.resume;
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
          const data = await resp.json();
          finalResumeText = String(data?.text || '');
          setResumeText(finalResumeText.slice(0, 12000));
          setResumeMethod(String(data?.method || ''));
          // PDF文本过短先尝试客户端文本提取，再OCR
          if (String(data?.method || '') === 'pdf' && finalResumeText.trim().length < 100) {
            const clientText = await tryPdfTextClient();
            if (clientText && clientText.trim().length >= 100) {
              finalResumeText = clientText;
            } else {
              const ocrText = await tryOcrPdfClient();
              if (ocrText && ocrText.trim().length > 0) {
                finalResumeText = ocrText;
              }
            }
          }
        } catch (preParseErr) {
          console.warn('[Pre-Analyze parse] failed:', preParseErr);
        }
      }

      if (!finalResumeText) {
        setAiError('必须先解析简历文档后才能进行AI分析，请上传可读文本（DOCX/TXT）或点击OCR后重试。');
        return;
      }

      // 生成测评摘要（MBTI + 盖洛普Top3 + 行业/岗位）
      const traitCounts: Record<string, number> = {};
      for (const q of currentAssessment) {
        const ansId = answers[q.id];
        if (!ansId) continue;
        const opt = q.options.find(o => o.id === ansId);
        const trait = opt?.trait;
        if (!trait) continue;
        traitCounts[trait] = (traitCounts[trait] || 0) + 1;
      }
      const mbtiPairs: [string, string, string][] = [
        ['E', 'I', '外向/内向'],
        ['S', 'N', '感觉/直觉'],
        ['T', 'F', '思考/情感'],
        ['J', 'P', '判断/知觉']
      ];
      const mbtiScores: Record<string, number> = {};
      let mbtiType = '';
      for (const [a, b] of mbtiPairs.map(p => [p[0], p[1]])) {
        const aCount = traitCounts[a] || 0;
        const bCount = traitCounts[b] || 0;
        mbtiType += (aCount >= bCount ? a : b);
        const total = aCount + bCount;
        mbtiScores[a] = total > 0 ? Math.round((aCount / total) * 100) : 50;
        mbtiScores[b] = total > 0 ? Math.round((bCount / total) * 100) : 50;
      }
      const gallupTraits = ['Achiever','Analytical','Strategic','Learner','Relator','Responsibility','Positivity','Harmony','Individualization'];
      const gallupScores: Record<string, number> = {};
      for (const t of gallupTraits) gallupScores[t] = (traitCounts[t] || 0) * 20;
      const topGallup = gallupTraits
        .map(t => ({ t, s: gallupScores[t] }))
        .sort((x,y) => y.s - x.s)
        .slice(0, 3)
        .map(x => `${x.t}(${gallupScores[x.t]})`);
      const summaryLines = [
        `MBTI：${mbtiType}（E:${mbtiScores.E}% I:${mbtiScores.I}% S:${mbtiScores.S}% N:${mbtiScores.N}% T:${mbtiScores.T}% F:${mbtiScores.F}% J:${mbtiScores.J}% P:${mbtiScores.P}%）`,
        `盖洛普优势Top3：${topGallup.join('，') || '暂无'}`,
        `答题总数：${Object.keys(answers).length} / ${currentAssessment.length}`,
        selectedType === 'industry' ? `意向行业/岗位：${selectedIndustryLocal || '未选'} / ${selectedPositionLocal || '未选'}` : '通用测评'
      ];
      const summary = summaryLines.join('\n');

      const resumeTxt = finalResumeText || '';
      const userContent = `请基于以下用户资料进行融合分析，并以层级化中文要点输出：\n\n` +
        `【测评答案摘要】\n${summary}\n\n` +
        `【简历文本】\n${resumeTxt}\n\n` +
        `【价值观】\n${additionalData.values || '未填写'}\n\n` +
        `【性格】\n${additionalData.personality || '未填写'}\n\n` +
        `【专业】\n${additionalData.major || '未填写'}\n\n` +
        `【要求】请完成：1) 个人优势与潜在短板；2) 与专业/行业/岗位的匹配度及证据；3) 推荐3-5个岗位与技能清单；4) 未来3个月行动计划（含学习资源与项目实践建议）；5) 若简历存在问题，请指出并给出优化方向。`;

      const messages = [
        { role: 'system', content: '你是资深中文职业分析顾问，擅长结合测评结果、简历与专业背景给出结构化、可执行的职业建议。' },
        { role: 'user', content: userContent }
      ];

      // 优先使用流式输出
      try {
        const resp = await fetch(apiUrl('/api/deepseek/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, model: DEFAULT_LLM_MODEL, temperature: DEFAULT_TEMPERATURE, stream: true })
        });
        if (!resp.ok || !resp.body) throw new Error('streaming not available');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const evt = JSON.parse(payload);
              const delta = evt?.choices?.[0]?.delta?.content || '';
              if (delta) setAiAnalysisText(prev => prev + delta);
            } catch {}
          }
        }
      } catch (streamErr) {
        // 回退到非流式
        try {
          const resp2 = await fetch(apiUrl('/api/deepseek/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model: DEFAULT_LLM_MODEL, temperature: DEFAULT_TEMPERATURE, stream: false })
          });
          const data = await resp2.json();
          const text = data?.choices?.[0]?.message?.content || 'AI分析生成失败';
          setAiAnalysisText(text);
        } catch (e2) {
          setAiError('AI分析失败，请稍后重试');
        }
      }
    } catch (err) {
      console.error('[AI Analyze] error:', err);
      setAiError('分析过程出现错误');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleCompleteAssessment = () => {
    const result = completeAssessment(aiAnalysisText || undefined);
    setCurrentResult(result);
    
    // 更新工作流程数据（包含简历文本与测评详情）
    updateAssessmentData({
      answers,
      resume: additionalData.resume || undefined,
      resumeText: resumeText || undefined,
      values: additionalData.values,
      personality: additionalData.personality,
      major: additionalData.major,
      completedAt: new Date(),
      aiAnalysis: result.aiAnalysis,
      scores: result.scores,
      traits: result.traits,
      recommendations: result.recommendations
    });
     
     setShowResult(true);
   };

  const handleGoToJobRecommendations = () => {
    setCurrentStep(2);
    navigate('/jobs');
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
    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <WorkflowProgress />
          
          {/* Result Header */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-4">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">测评完成！</h1>
              <p className="text-gray-300">您的职业能力分析报告已生成</p>
            </div>

            {/* Radar Chart */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">能力雷达图</h2>
              <div className="bg-gray-700/50 rounded-xl p-6">
                <RadarChart data={currentResult.scores} />
              </div>
            </div>

            {/* Traits Cloud */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">职业身份标签</h2>
              <div className="flex flex-wrap gap-3">
                {currentResult.traits.map((trait: string, index: number) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-medium text-sm shadow-md"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">职业发展建议</h2>
              <div className="space-y-3">
                {currentResult.recommendations.map((rec: string, index: number) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                      <span className="text-blue-600 font-semibold text-xs">{index + 1}</span>
                    </div>
                    <p className="text-gray-300">{rec}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid md:grid-cols-3 gap-4">
                <button
                  onClick={handleGoToJobRecommendations}
                  className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 shadow-lg"
                >
                  查看岗位推荐
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
                <button
                  onClick={handleRestartAssessment}
                  className="inline-flex items-center justify-center px-6 py-3 border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:border-gray-500 hover:bg-gray-700 transition-all duration-200"
                >
                  重新测评
                </button>
                <button
                  onClick={() => setShowAdditionalInfo(true)}
                  className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
                >
                  优化简历与画像
                </button>
              </div>
            </div>

            {/* Recent Assessments */}
            {isAuthenticated && assessmentHistory.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">最近记录</h3>
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
            <p className="text-gray-300 mb-8">以下信息将帮助我们为您提供更精准的职业建议（可选填写）</p>
            
            <div className="space-y-6">

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  上传过往简历 (可选)
                </label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
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
                      <p className="text-xs text-gray-400 mb-1">文本预览（前12000字）：</p>
                      <div className="max-h-40 overflow-auto text-sm bg-gray-900/60 border border-gray-700 rounded-md p-3 text-gray-200 whitespace-pre-wrap">
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
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
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-400"
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


              {(aiAnalyzing || aiAnalysisText || aiError) && (
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-white">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mr-2">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-white font-medium">AI 分析</span>
                  </div>
                  {aiAnalyzing && (
                    <p className="text-sm text-gray-400">正在分析您的资料，请稍候...</p>
                  )}
                  {aiError && (
                    <p className="text-sm text-red-400">{aiError}</p>
                  )}
                  {aiAnalysisText && (
                    <ReactMarkdown
                      className="max-w-none text-sm text-white"
                      remarkPlugins={[remarkGfm]}
                    >
                      {aiAnalysisText}
                    </ReactMarkdown>
                  )}
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
                  onClick={analyzeAdditionalInfo}
                  className="inline-flex items-center px-6 py-3 border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:border-gray-500 hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={aiAnalyzing || !additionalData.major}
                >
                  进行AI分析
                </button>
                <button
                  onClick={handleCompleteAssessment}
                  disabled={!additionalData.major}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  完成测评
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
        
        {/* Header */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-6">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">AI职业隐藏身份测评</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            通过科学的评估方法，深度挖掘你的职业潜能和隐藏优势，为你的职业发展提供精准指导
          </p>
        </div>

        {/* Assessment Types */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
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
                    onChange={(e) => setSelectedPositionLocal(e.target.value)}
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
                <p className="text-xs text-gray-400">{taxError || '选择行业与二级岗位后，再开始专项测评'}</p>
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

        {/* Features */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">测评特色功能</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-white mb-2">雷达图可视化</h3>
              <p className="text-gray-300 text-sm">多维度能力雷达图，直观展示你的能力分布和优势领域</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
                <Lightbulb className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-white mb-2">智能特质提示</h3>
              <p className="text-gray-300 text-sm">答题过程中实时显示特质提示，帮助你更好理解选择意义</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-white mb-2">断点续答功能</h3>
              <p className="text-gray-300 text-sm">支持登录状态下的断点续答，随时暂停随时继续</p>
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
