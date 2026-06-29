import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Video, 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  Star,
  TrendingUp,
  Award,
  Target,
  Brain,
  Users,
  MessageSquare,
  FileText,
  Download,
  ArrowRight,
  Settings,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  UserPlus
} from 'lucide-react';
import { useAssessment } from '../contexts/AssessmentContext';
import { useWorkflow } from '../contexts/WorkflowContext';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/ui/BackButton';
import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE } from '../llm/config';
import { apiUrl } from '../api';

interface InterviewRound {
  id: string;
  name: string;
  type: 'individual' | 'group';
  duration: number;
  questions: string[];
  position?: string;
  company?: string;
  interviewers?: string[];
  participants?: number;
  customInstructions?: string;
}

// 明确面试结果类型，避免 Object.entries 推断为 unknown
interface InterviewResult {
  type: string | null;
  isMultiRound: boolean;
  rounds: number;
  completedAt: Date;
  overallScore: number;
  scores: Record<string, number>;
  feedback: string[];
  improvements: string[];
  answerRecords: string[];
}

interface JobContextSection {
  title: string;
  items: string[];
}

const InterviewSimulation = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { selectedJob, assessmentData } = useWorkflow();
  const { getIndustryPositions } = useAssessment();
  const industryMap = getIndustryPositions();
  const industryOptions = Object.keys(industryMap);
  
  // 面试状态
  const [interviewType, setInterviewType] = useState<'comprehensive' | 'basic_quality' | 'industry_knowledge' | 'position_requirements' | null>(null);
  const [currentStep, setCurrentStep] = useState<'setup' | 'rounds_config' | 'interview' | 'result'>('setup');
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [speechStatus, setSpeechStatus] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [isTimerActive, setIsTimerActive] = useState(false);
  
  // 多轮面试配置
  const [interviewRounds, setInterviewRounds] = useState<InterviewRound[]>([]);
  const [isMultiRound, setIsMultiRound] = useState(false);
  
  // 设备状态
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  
  // 面试结果
  const [interviewResult, setInterviewResult] = useState<InterviewResult | null>(null);
  const [llmQuestions, setLlmQuestions] = useState<Record<string, string[]>>({});
  const [generating, setGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [selectedIndustryLocal, setSelectedIndustryLocal] = useState(selectedJob?.industry || '');
  const [selectedPositionLocal, setSelectedPositionLocal] = useState(selectedJob?.title || '');
  const [jobDescription, setJobDescription] = useState(selectedJob?.description || '');
  const [jobContext, setJobContext] = useState<JobContextSection[]>([
    {
      title: '核心职责',
      items: Array.isArray(selectedJob?.requirements) ? selectedJob.requirements.slice(0, 3) : ['']
    },
    {
      title: '必备技能',
      items: ['']
    },
    {
      title: '加分项',
      items: ['']
    }
  ]);
  const [digitalHumanMode, setDigitalHumanMode] = useState<'listen' | 'ask' | 'idle'>('idle');
  const [voiceMode, setVoiceMode] = useState<'auto' | 'push-to-talk'>('auto');

  useEffect(() => {
    if (!selectedJob) return;
    setSelectedIndustryLocal(selectedJob.industry || '');
    setSelectedPositionLocal(selectedJob.title || '');
    setJobDescription(selectedJob.description || '');
    setJobContext([
      {
        title: '核心职责',
        items: Array.isArray(selectedJob.requirements) ? selectedJob.requirements.slice(0, 3) : ['']
      },
      {
        title: '必备技能',
        items: ['']
      },
      {
        title: '加分项',
        items: ['']
      }
    ]);
  }, [selectedJob]);

  const availablePositions = selectedIndustryLocal ? (industryMap[selectedIndustryLocal] || []) : [];

  const buildQuestionContext = () => {
    const sectionText = jobContext
      .map((section) => {
        const items = section.items.map(item => item.trim()).filter(Boolean);
        if (!items.length) return '';
        return `${section.title}：\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`;
      })
      .filter(Boolean);
    const parts = [
      selectedIndustryLocal ? `行业：${selectedIndustryLocal}` : '',
      selectedPositionLocal ? `岗位：${selectedPositionLocal}` : '',
      selectedJob?.company ? `目标公司：${selectedJob.company}` : '',
      jobDescription.trim() ? `岗位介绍：${jobDescription.trim()}` : '',
      sectionText.length ? `岗位结构：\n${sectionText.join('\n\n')}` : '',
      assessmentData?.aiAnalysis ? `候选人画像：${String(assessmentData.aiAnalysis).slice(0, 500)}` : '',
      assessmentData?.traits?.length ? `候选人优势标签：${assessmentData.traits.slice(0, 5).join('、')}` : ''
    ].filter(Boolean);
    return parts.join('\n');
  };

  const updateContextItem = (sectionIndex: number, itemIndex: number, value: string) => {
    setJobContext(prev => prev.map((section, i) => {
      if (i !== sectionIndex) return section;
      return {
        ...section,
        items: section.items.map((item, j) => (j === itemIndex ? value : item))
      };
    }));
  };

  const addContextItem = (sectionIndex: number) => {
    setJobContext(prev => prev.map((section, i) => {
      if (i !== sectionIndex) return section;
      return {
        ...section,
        items: [...section.items, '']
      };
    }));
  };

  const removeContextItem = (sectionIndex: number, itemIndex: number) => {
    setJobContext(prev => prev.map((section, i) => {
      if (i !== sectionIndex) return section;
      const next = section.items.filter((_, j) => j !== itemIndex);
      return {
        ...section,
        items: next.length ? next : ['']
      };
    }));
  };
  
  const generateInterviewQuestions = async (type: 'comprehensive' | 'basic_quality' | 'industry_knowledge' | 'position_requirements') => {
    try {
      setGenerating(true);
      const sys = '你是资深中文面试官。仅输出一个JSON数组，数组元素为面试问题字符串；不要输出Markdown或额外文本。';
      const typeMeta = interviewTypes.find(t => t.id === type);
      const count = typeMeta?.questions || 10;
      const ctx = buildQuestionContext();
      const user = `请生成${count}条${typeMeta?.name || ''}面试问题，必须严格贴合下面上下文，并优先围绕岗位职责、行业要求和候选人画像出题。\n${ctx}\n仅返回JSON数组（纯字符串问题列表）。`;
  
      const resp = await fetch(apiUrl('/api/deepseek/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], model: DEFAULT_LLM_MODEL, temperature: DEFAULT_TEMPERATURE, stream: false })
      });
  
      if (!resp.ok) throw new Error(await resp.text());
      let content = (await resp.json())?.choices?.[0]?.message?.content || '[]';
      content = String(content).trim().replace(/^```json|^```|```$/g, '');
      const arr = JSON.parse(content);
      if (!Array.isArray(arr)) throw new Error('Invalid JSON');
      setLlmQuestions(prev => ({ ...prev, [type]: arr.map((s: any) => String(s)) }));
    } catch (e) {
      console.warn('[DeepSeek] interview question generation failed:', e);
    } finally {
      setGenerating(false);
    }
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriberPromiseRef = useRef<Promise<any> | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);

  // 面试类型配置
  const interviewTypes = [
    {
      id: 'comprehensive',
      name: '综合面试',
      description: '个人基本素养、行业知识、岗位需求全面评估，支持多轮面试和群体面试',
      icon: <Users className="h-6 w-6" />,
      color: 'from-blue-500 to-cyan-500',
      duration: '25-35分钟',
      questions: 12,
      supportsMultiRound: true,
      supportsGroup: true
    },
    {
      id: 'basic_quality',
      name: '基本素养面试',
      description: '沟通表达、逻辑思维、团队协作等基础能力评估',
      icon: <Brain className="h-6 w-6" />,
      color: 'from-purple-500 to-pink-500',
      duration: '15-20分钟',
      questions: 8,
      supportsMultiRound: false,
      supportsGroup: false
    },
    {
      id: 'industry_knowledge',
      name: '行业知识面试',
      description: '行业趋势、专业知识、发展前景深度考察',
      icon: <Target className="h-6 w-6" />,
      color: 'from-green-500 to-blue-500',
      duration: '20-25分钟',
      questions: 10,
      supportsMultiRound: false,
      supportsGroup: false
    },
    {
      id: 'position_requirements',
      name: '岗位需求面试',
      description: '针对具体岗位要求的专业技能和经验考察',
      icon: <Award className="h-6 w-6" />,
      color: 'from-orange-500 to-red-500',
      duration: '20-30分钟',
      questions: 10,
      supportsMultiRound: false,
      supportsGroup: false
    }
  ];

  // 默认面试轮次模板
  const defaultRoundTemplates = [
    {
      name: 'HR初面',
      type: 'individual' as const,
      duration: 30,
      questions: [
        '请简单介绍一下你自己',
        '为什么选择我们公司？',
        '你的职业规划是什么？',
        '你期望的薪资范围是多少？'
      ],
      interviewers: ['HR经理']
    },
    {
      name: '技术面试',
      type: 'individual' as const,
      duration: 45,
      questions: [
        '请介绍你最有挑战性的项目经历',
        '如何解决技术难题？',
        '对我们的技术栈有什么了解？',
        '如何保持技术学习和成长？'
      ],
      interviewers: ['技术总监', '资深工程师']
    },
    {
      name: '群体讨论',
      type: 'group' as const,
      duration: 60,
      participants: 6,
      questions: [
        '如果公司要推出一个新产品，你们团队会如何制定营销策略？',
        '讨论如何提高团队工作效率',
        '如何处理团队中的意见分歧？'
      ],
      interviewers: ['部门经理', 'HR经理'],
      customInstructions: '请积极参与讨论，展现团队协作能力和领导潜质'
    },
    {
      name: '终面',
      type: 'individual' as const,
      duration: 30,
      questions: [
        '你对这个岗位的理解是什么？',
        '如何在新环境中快速适应？',
        '你还有什么问题想问我们的？'
      ],
      interviewers: ['总经理']
    }
  ];

  // AI接口不可用时使用的基础题库，保证训练流程不中断
  const fallbackQuestions = {
    comprehensive: [
      // 个人基本素养
      "请用3分钟时间介绍一下你自己，包括教育背景、工作经历和个人特点。",
      "描述一次你在团队中发挥领导作用的经历，你是如何协调团队完成目标的？",
      "面对工作压力和紧急任务时，你通常如何安排优先级和时间管理？",
      
      // 行业相关知识
      "谈谈你对当前行业发展趋势的理解，以及未来3-5年的发展预测。",
      "请分析一下我们所在行业面临的主要挑战和机遇。",
      "你认为哪些新技术或新模式会对我们行业产生重大影响？",
      
      // 岗位需求
      "根据这个岗位的职责要求，你认为自己最大的优势是什么？",
      "如果让你负责这个岗位，你会如何制定前3个月的工作计划？",
      "描述一个与此岗位相关的项目经验，包括你的角色和取得的成果。",
      
      // 综合能力
      "当你的专业判断与上级意见不一致时，你会如何处理？",
      "请举例说明你是如何持续学习和提升专业技能的。",
      "你的职业规划是什么？为什么选择我们公司和这个岗位？"
    ],
    basic_quality: [
      "请用简洁的语言介绍一下你自己。",
      "描述一次你成功说服他人接受你观点的经历。",
      "当你面临多个紧急任务时，你如何确定处理顺序？",
      "谈谈你在团队合作中通常扮演什么角色？",
      "描述一次你从失败中学到重要经验的情况。",
      "你如何处理与同事之间的意见分歧？",
      "什么样的工作环境能让你发挥最佳表现？",
      "你认为自己最需要改进的能力是什么？"
    ],
    industry_knowledge: [
      "请分析当前行业的发展现状和主要特点。",
      "你认为我们行业在未来5年会有哪些重大变化？",
      "谈谈你对行业内主要竞争对手的了解和看法。",
      "哪些外部因素会对我们行业产生重大影响？",
      "你如何看待新技术对传统行业模式的冲击？",
      "请举例说明一个行业内的成功案例，并分析其成功因素。",
      "你认为我们行业面临的最大挑战是什么？",
      "如何评估一个行业项目的可行性和风险？",
      "谈谈你对行业监管政策变化的理解。",
      "你会如何向外行人解释我们行业的价值和意义？"
    ],
    position_requirements: [
      "根据岗位描述，你认为这个职位最重要的3项技能是什么？",
      "请详细描述一个与此岗位高度相关的项目经验。",
      "如果你获得这个职位，前90天你会重点关注哪些工作？",
      "你如何理解这个岗位在公司整体战略中的作用？",
      "描述一次你使用岗位相关技能解决复杂问题的经历。",
      "你认为在这个岗位上取得成功需要具备哪些关键素质？",
      "如何衡量这个岗位的工作成效和业绩表现？",
      "你在相关领域还有哪些需要提升的技能？",
      "请分享一个你在类似岗位上的创新实践案例。",
      "你如何平衡这个岗位的日常工作和长期发展目标？"
    ]
  };

  // 初始化摄像头
  useEffect(() => {
    if (currentStep === 'setup' || currentStep === 'rounds_config') {
      initializeCamera();
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentStep]);

  // 计时器
  useEffect(() => {
    if (isTimerActive && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeRemaining === 0) {
      handleNextQuestion();
    }
  }, [isTimerActive, timeRemaining]);

  useEffect(() => {
    if (currentStep !== 'interview' || !interviewType) return;
    const currentRound = interviewRounds[currentRoundIndex];
    const answerKey = getAnswerKey(currentRound, currentQuestionIndex);
    setCurrentAnswer(answers[answerKey] || '');
    setSpeechStatus('');
    setDigitalHumanMode('ask');
  }, [currentStep, interviewType, currentRoundIndex, currentQuestionIndex]);

  useEffect(() => () => releaseMedia(), []);

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
    }
  };

  const toggleCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCameraOn;
        setIsCameraOn(!isCameraOn);
      }
    }
  };

  const toggleMic = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
      }
    }
  };

  const getAnswerKey = (round: InterviewRound | undefined, questionIndex: number) => {
    if (round) return `${round.id}_${questionIndex}`;
    return `${interviewType || 'single'}_${questionIndex}`;
  };

  const saveCurrentAnswer = () => {
    const currentRound = interviewRounds[currentRoundIndex];
    const answerKey = getAnswerKey(currentRound, currentQuestionIndex);
    const value = currentAnswer.trim();
    setAnswers(prev => {
      if (!value) {
        const next = { ...prev };
        delete next[answerKey];
        return next;
      }
      return { ...prev, [answerKey]: value };
    });
    return value ? { key: answerKey, value } : null;
  };

  const getTranscriber = async () => {
    if (!transcriberPromiseRef.current) {
      transcriberPromiseRef.current = (async () => {
        const { pipeline } = await import('@xenova/transformers');
        return pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
      })();
    }
    return transcriberPromiseRef.current;
  };

  const resampleAudio = (audioData: Float32Array, sourceRate: number, targetRate = 16000) => {
    if (sourceRate === targetRate) return audioData;
    const ratio = sourceRate / targetRate;
    const newLength = Math.max(1, Math.round(audioData.length / ratio));
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i += 1) {
      const position = i * ratio;
      const leftIndex = Math.floor(position);
      const rightIndex = Math.min(leftIndex + 1, audioData.length - 1);
      const weight = position - leftIndex;
      result[i] = audioData[leftIndex] * (1 - weight) + audioData[rightIndex] * weight;
    }

    return result;
  };

  const decodeAudioBlob = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channels = decoded.numberOfChannels;
      const mixed = new Float32Array(decoded.length);

      for (let channel = 0; channel < channels; channel += 1) {
        const data = decoded.getChannelData(channel);
        for (let i = 0; i < data.length; i += 1) {
          mixed[i] += data[i] / channels;
        }
      }

      return resampleAudio(mixed, decoded.sampleRate, 16000);
    } finally {
      await audioContext.close().catch(() => {});
    }
  };

  const releaseMedia = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    setSpeechStatus('正在识别语音...');
    try {
      const audio = await decodeAudioBlob(blob);
      const transcriber = await getTranscriber();
      const output = await transcriber(audio, {
        language: 'zh',
        task: 'transcribe',
        return_timestamps: false
      });
      const text = String(output?.text || '').trim();
      if (text) {
        setCurrentAnswer(prev => (prev.trim() ? `${prev.trim()} ${text}` : text));
        setSpeechStatus('语音已转写');
      } else {
        setSpeechStatus('未识别到有效语音');
      }
    } catch (error) {
      console.error('[interview speech] transcribe failed:', error);
      setSpeechStatus('语音转写失败，请改用手动输入。');
    } finally {
      setIsTranscribing(false);
      const resolve = stopResolveRef.current;
      stopResolveRef.current = null;
      stopPromiseRef.current = null;
      resolve?.();
      releaseMedia();
      setTimeout(() => setSpeechStatus(''), 2500);
    }
  };

  const startInterview = (type: 'comprehensive' | 'basic_quality' | 'industry_knowledge' | 'position_requirements') => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (type !== 'basic_quality' && (!selectedIndustryLocal || !selectedPositionLocal)) {
      setSetupError('请先选择行业和岗位，再开始针对性面试。');
      return;
    }
    if (type !== 'basic_quality') {
      const hasUsefulContext = jobDescription.trim() || jobContext.some(section => section.items.some(item => item.trim()));
      if (!hasUsefulContext) {
        setSetupError('请至少补充岗位介绍或一项职责/技能，再开始面试。');
        return;
      }
    }
    setSetupError('');
    
    const selectedType = interviewTypes.find(t => t.id === type);
    setInterviewType(type);
    
    // 如果是综合面试且选择了多轮面试，进入轮次配置
    if (type === 'comprehensive' && isMultiRound) {
      setCurrentStep('rounds_config');
      // 初始化默认轮次
      if (interviewRounds.length === 0) {
        const defaultRounds = defaultRoundTemplates.map((template, index) => ({
          id: `round_${index + 1}`,
          ...template
        }));
        setInterviewRounds(defaultRounds);
      }
    } else {
      // 直接开始单轮面试
      setCurrentStep('interview');
      setCurrentQuestionIndex(0);
      setCurrentRoundIndex(0);
      setTimeRemaining(180);
      setIsTimerActive(true);
      setDigitalHumanMode('ask');
      // 生成该面试类型的题库（DeepSeek）
      generateInterviewQuestions(type);
    }
  };

  const startRecording = async () => {
    if (isTranscribing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setSpeechStatus('当前浏览器不支持麦克风访问。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(
        stream,
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? { mimeType: 'audio/webm;codecs=opus' }
          : undefined
      );

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        void transcribeAudio(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setSpeechStatus('录音中，再次点击可停止并转写。');
    } catch (error) {
      console.error('[interview speech] microphone access failed:', error);
      setSpeechStatus('麦克风权限未开启，请允许后重试。');
      releaseMedia();
    }
  };

  const stopRecording = async () => {
    if (stopPromiseRef.current) {
      await stopPromiseRef.current;
      return;
    }
    if (isTranscribing) return;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      releaseMedia();
      return;
    }

    if (!stopPromiseRef.current) {
      stopPromiseRef.current = new Promise<void>((resolve) => {
        stopResolveRef.current = resolve;
      });
      recorder.stop();
    }

    await stopPromiseRef.current;
  };

  const handleNextQuestion = async () => {
    if (!interviewType) return;
    if (isRecording || stopPromiseRef.current) {
      await stopRecording();
    }
    saveCurrentAnswer();
    
    const currentRound = interviewRounds[currentRoundIndex];
    const questions = currentRound ? currentRound.questions : (llmQuestions[interviewType] || fallbackQuestions[interviewType]);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeRemaining(180);
      setIsTimerActive(true);
      setIsRecording(false);
    } else if (isMultiRound && currentRoundIndex < interviewRounds.length - 1) {
      // 进入下一轮面试
      setCurrentRoundIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
      setTimeRemaining(interviewRounds[currentRoundIndex + 1].duration * 60);
      setIsTimerActive(true);
      setIsRecording(false);
    } else {
      completeInterview();
    }
  };

  const completeInterview = async () => {
    if (isRecording || stopPromiseRef.current) {
      await stopRecording();
    }
    const savedAnswer = saveCurrentAnswer();
    setIsTimerActive(false);
    setIsRecording(false);
    releaseMedia();

    const currentRound = interviewRounds[currentRoundIndex];
    const questions = currentRound ? currentRound.questions : (interviewType ? (llmQuestions[interviewType] || fallbackQuestions[interviewType]) : []);
    const allAnswers = {
      ...answers,
      ...(savedAnswer ? { [savedAnswer.key]: savedAnswer.value } : {})
    };
    const answeredValues = Object.values(allAnswers).filter(Boolean);
    const answeredCount = new Set(answeredValues).size;
    const averageLength = answeredValues.length
      ? Math.round(answeredValues.reduce((sum, item) => sum + item.length, 0) / answeredValues.length)
      : 0;
    const completionRate = questions.length ? Math.round((answeredCount / questions.length) * 100) : 70;
    const evidenceScore = Math.max(0, Math.min(25, Math.round(averageLength / 12)));
    const targetBonus = selectedJob ? 8 : 0;
    const assessmentBonus = assessmentData?.traits?.length ? 6 : 0;
    const overallScore = Math.max(55, Math.min(95, Math.round(completionRate * 0.45 + evidenceScore + 20 + targetBonus + assessmentBonus)));

    const result: InterviewResult = {
      type: interviewType,
      isMultiRound,
      rounds: isMultiRound ? interviewRounds.length : 1,
      completedAt: new Date(),
      overallScore,
      scores: {
        '基本素养': Math.max(55, Math.min(95, overallScore + 2)),
        '沟通表达': Math.max(55, Math.min(95, completionRate + 5)),
        '行业认知': Math.max(55, Math.min(95, overallScore - (selectedJob ? 0 : 8))),
        '岗位匹配': Math.max(55, Math.min(95, overallScore + targetBonus - 4)),
        '发展潜力': Math.max(55, Math.min(95, overallScore + assessmentBonus - 3)),
        ...(isMultiRound && interviewRounds.some(r => r.type === 'group') ? {
          '团队协作': Math.max(55, Math.min(95, overallScore - 2)),
          '领导能力': Math.max(55, Math.min(95, overallScore - 5))
        } : {})
      },
      feedback: [
        selectedJob ? `回答已围绕「${selectedJob.title}」展开，岗位聚焦度更高` : '建议先选择目标岗位，再进行针对性面试训练',
        `本次记录 ${answeredCount}/${questions.length || 1} 个回答，平均回答长度 ${averageLength || 0} 字`,
        assessmentData?.traits?.length ? `已结合职业画像优势：${assessmentData.traits.slice(0, 3).join('、')}` : '职业画像信息不足，建议先完成测评',
        '能完成完整面试流程，具备继续迭代表达素材的基础',
        ...(isMultiRound && interviewRounds.some(r => r.type === 'group') ? [
          '多轮/群面流程已覆盖，后续应重点训练倾听、总结和推动共识'
        ] : [])
      ],
      improvements: [
        '每个核心问题准备一个STAR案例，避免只讲观点不讲证据',
        selectedJob ? `补充 ${selectedJob.company} 与岗位业务的调研信息` : '先锁定一个目标岗位和公司，再训练高频问题',
        '回答项目经历时突出个人动作、关键决策和量化结果',
        '准备3个反问问题，验证岗位目标、团队协作和成功标准',
        ...(isMultiRound && interviewRounds.some(r => r.type === 'group') ? [
          '群体讨论中先复述共识，再提出分歧方案'
        ] : [])
      ],
      answerRecords: answeredValues
    };
    
    setInterviewResult(result);
    setCurrentStep('result');
    setDigitalHumanMode('idle');
  };

  const restartInterview = () => {
    setInterviewType(null);
    setCurrentStep('setup');
    setCurrentQuestionIndex(0);
    setCurrentRoundIndex(0);
    setAnswers({});
    setCurrentAnswer('');
    setSpeechStatus('');
    setInterviewResult(null);
    setIsRecording(false);
    setIsTimerActive(false);
    setIsMultiRound(false);
    setInterviewRounds([]);
    setDigitalHumanMode('idle');
  };

  const downloadInterviewReport = () => {
    if (!interviewResult) return;
    const lines = [
      '职向未来 Pro - 面试训练报告',
      `生成时间：${interviewResult.completedAt.toLocaleString()}`,
      `目标岗位：${selectedJob ? `${selectedJob.company} / ${selectedJob.title}` : '未选择'}`,
      `总体评分：${interviewResult.overallScore}`,
      '',
      '回答记录：',
      ...interviewResult.answerRecords.map((item, index) => `Q${index + 1}: ${item}`),
      '',
      '分项评分：',
      ...Object.entries(interviewResult.scores).map(([name, score]) => `- ${name}: ${score}`),
      '',
      '表现亮点：',
      ...interviewResult.feedback.map(item => `- ${item}`),
      '',
      '改进建议：',
      ...interviewResult.improvements.map(item => `- ${item}`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interview-report-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  // 添加新轮次
  const addNewRound = () => {
    const newRound: InterviewRound = {
      id: `round_${interviewRounds.length + 1}`,
      name: `面试轮次 ${interviewRounds.length + 1}`,
      type: 'individual',
      duration: 30,
      questions: ['请介绍一下你自己'],
      interviewers: ['面试官']
    };
    setInterviewRounds([...interviewRounds, newRound]);
  };

  // 删除轮次
  const deleteRound = (roundId: string) => {
    setInterviewRounds(interviewRounds.filter(round => round.id !== roundId));
  };

  // 更新轮次
  const updateRound = (roundId: string, updates: Partial<InterviewRound>) => {
    setInterviewRounds(interviewRounds.map(round => 
      round.id === roundId ? { ...round, ...updates } : round
    ));
  };

  // 添加问题到轮次
  const addQuestionToRound = (roundId: string) => {
    const round = interviewRounds.find(r => r.id === roundId);
    if (round) {
      updateRound(roundId, {
        questions: [...round.questions, '新问题']
      });
    }
  };

  // 删除轮次中的问题
  const deleteQuestionFromRound = (roundId: string, questionIndex: number) => {
    const round = interviewRounds.find(r => r.id === roundId);
    if (round) {
      const newQuestions = round.questions.filter((_, index) => index !== questionIndex);
      updateRound(roundId, { questions: newQuestions });
    }
  };

  // 更新轮次中的问题
  const updateQuestionInRound = (roundId: string, questionIndex: number, newQuestion: string) => {
    const round = interviewRounds.find(r => r.id === roundId);
    if (round) {
      const newQuestions = [...round.questions];
      newQuestions[questionIndex] = newQuestion;
      updateRound(roundId, { questions: newQuestions });
    }
  };

  // 轮次配置页面
  if (currentStep === 'rounds_config') {
    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* 头部 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-4">
                  <Settings className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-4">多轮面试配置</h1>
                <p className="text-xl text-gray-300">
                  自定义每轮面试的内容、时长和参与人员
                </p>
              </div>
            </div>
          </div>

          {/* 轮次列表 */}
          <div className="space-y-6">
            {interviewRounds.map((round, index) => (
              <div key={round.id} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      value={round.name}
                      onChange={(e) => updateRound(round.id, { name: e.target.value })}
                      className="text-xl font-bold bg-transparent text-white border-none outline-none"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => deleteRound(round.id)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 基本设置 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">面试类型</label>
                      <select
                        value={round.type}
                        onChange={(e) => updateRound(round.id, { type: e.target.value as 'individual' | 'group' })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                      >
                        <option value="individual">个人面试</option>
                        <option value="group">群体面试</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">时长（分钟）</label>
                      <input
                        type="number"
                        value={round.duration}
                        onChange={(e) => updateRound(round.id, { duration: parseInt(e.target.value) })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                        min="5"
                        max="120"
                      />
                    </div>

                    {round.type === 'group' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">参与人数</label>
                        <input
                          type="number"
                          value={round.participants || 6}
                          onChange={(e) => updateRound(round.id, { participants: parseInt(e.target.value) })}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                          min="3"
                          max="12"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">目标岗位（可选）</label>
                      <input
                        type="text"
                        value={round.position || ''}
                        onChange={(e) => updateRound(round.id, { position: e.target.value })}
                        placeholder="如：高级产品经理"
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">目标公司（可选）</label>
                      <input
                        type="text"
                        value={round.company || ''}
                        onChange={(e) => updateRound(round.id, { company: e.target.value })}
                        placeholder="如：腾讯科技"
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>

                  {/* 面试官和问题设置 */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">面试官</label>
                      <div className="space-y-2">
                        {(round.interviewers || []).map((interviewer, interviewerIndex) => (
                          <div key={interviewerIndex} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={interviewer}
                              onChange={(e) => {
                                const newInterviewers = [...(round.interviewers || [])];
                                newInterviewers[interviewerIndex] = e.target.value;
                                updateRound(round.id, { interviewers: newInterviewers });
                              }}
                              className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                            />
                            <button
                              onClick={() => {
                                const newInterviewers = (round.interviewers || []).filter((_, i) => i !== interviewerIndex);
                                updateRound(round.id, { interviewers: newInterviewers });
                              }}
                              className="p-2 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newInterviewers = [...(round.interviewers || []), '新面试官'];
                            updateRound(round.id, { interviewers: newInterviewers });
                          }}
                          className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>添加面试官</span>
                        </button>
                      </div>
                    </div>

                    {round.type === 'group' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">特殊说明</label>
                        <textarea
                          value={round.customInstructions || ''}
                          onChange={(e) => updateRound(round.id, { customInstructions: e.target.value })}
                          placeholder="如：请积极参与讨论，展现团队协作能力..."
                          rows={3}
                          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-400"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 问题设置 */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-300">面试问题</label>
                    <button
                      onClick={() => addQuestionToRound(round.id)}
                      className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
                    >
                      <Plus className="h-4 w-4" />
                      <span>添加问题</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {round.questions.map((question, questionIndex) => (
                      <div key={questionIndex} className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-medium mt-2">
                          {questionIndex + 1}
                        </div>
                        <textarea
                          value={question}
                          onChange={(e) => updateQuestionInRound(round.id, questionIndex, e.target.value)}
                          className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                          rows={2}
                        />
                        <button
                          onClick={() => deleteQuestionFromRound(round.id, questionIndex)}
                          className="p-2 text-red-400 hover:text-red-300 mt-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* 添加新轮次 */}
            <div className="text-center">
              <button
                onClick={addNewRound}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                添加新轮次
              </button>
            </div>

            {/* 开始面试按钮 */}
            <div className="text-center pt-8">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setCurrentStep('setup')}
                  className="px-6 py-3 border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:border-gray-500 hover:bg-gray-700 transition-all duration-200"
                >
                  返回设置
                </button>
                <button
                  onClick={() => {
                    setCurrentStep('interview');
                    setCurrentQuestionIndex(0);
                    setCurrentRoundIndex(0);
                    setTimeRemaining(interviewRounds[0]?.duration * 60 || 180);
                    setIsTimerActive(true);
                  }}
                  disabled={interviewRounds.length === 0}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  开始多轮面试
                  <ArrowRight className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 结果页面
  if (currentStep === 'result' && interviewResult) {
    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* 结果头部 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-blue-500 rounded-full mb-4">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">面试完成！</h1>
              <p className="text-gray-300">
                您的{interviewTypes.find(t => t.id === interviewType)?.name}表现分析
                {interviewResult.isMultiRound && ` (${interviewResult.rounds}轮面试)`}
              </p>
            </div>
          </div>

          {/* 总体评分 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 mb-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">综合评分</h2>
            
            <div className="text-center mb-8">
              <div className={`text-6xl font-bold mb-4 ${getScoreColor(interviewResult.overallScore)}`}>
                {interviewResult.overallScore}
              </div>
              <p className="text-gray-400 text-lg">总体表现评分</p>
            </div>

            {/* 各项评分 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(interviewResult.scores as Record<string, number>).map(([skill, score], index) => (
  <div key={index} className="text-center">
    <div className={`text-2xl font-bold mb-2 ${getScoreColor(score)}`}>
      {score}
    </div>
    <p className="text-gray-400">{skill}</p>
    <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
      <div
        className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full transition-all duration-500"
        style={{ width: `${score}%` }}
      ></div>
    </div>
  </div>
))}
            </div>
          </div>

          {/* 详细反馈 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* 优点反馈 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <Star className="h-5 w-5 text-yellow-400 mr-2" />
                表现亮点
              </h3>
              <div className="space-y-3">
                {interviewResult.feedback.map((item: string, index: number) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-300 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 改进建议 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 text-blue-400 mr-2" />
                改进建议
              </h3>
              <div className="space-y-3">
                {interviewResult.improvements.map((item: string, index: number) => (
                  <div key={index} className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-300 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="text-center space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={downloadInterviewReport}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
              >
                <Download className="h-5 w-5 mr-2" />
                下载面试报告
              </button>
              <button
                onClick={restartInterview}
                className="inline-flex items-center px-6 py-3 border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:border-gray-500 hover:bg-gray-700 transition-all duration-200"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                重新面试
              </button>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              返回控制台
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 面试进行中
  if (currentStep === 'interview' && interviewType) {
    const currentRound = interviewRounds[currentRoundIndex];
    const questions = currentRound ? currentRound.questions : (llmQuestions[interviewType] || fallbackQuestions[interviewType]);
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const isGroupInterview = currentRound?.type === 'group';
    const interviewerName = selectedPositionLocal || selectedJob?.title || 'AI 面试官';

    return (
      <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* 进度条 */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Video className="h-6 w-6 text-blue-600" />
                <div>
                  <span className="font-semibold text-white">
                    {interviewTypes.find(t => t.id === interviewType)?.name}
                  </span>
                  {isMultiRound && currentRound && (
                    <div className="text-sm text-gray-400">
                      {currentRound.name} ({currentRoundIndex + 1}/{interviewRounds.length})
                      {isGroupInterview && ` - 群体面试 (${currentRound.participants}人)`}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-gray-300">
                  <Clock className="h-4 w-4" />
                  <span className={`font-mono text-sm ${timeRemaining <= 30 ? 'text-red-400' : ''}`}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>问题 {currentQuestionIndex + 1} / {questions.length}</span>
              <span>{Math.round(progress)}% 完成</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 视频区域 */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    className="w-full h-80 bg-gray-900 rounded-lg object-cover"
                  />
                  {!isCameraOn && (
                    <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center">
                      <CameraOff className="h-12 w-12 text-gray-500" />
                    </div>
                  )}
                  
                  {/* 录制指示器 */}
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="text-white text-sm font-medium">录制中</span>
                    </div>
                  )}

                  {/* 群体面试标识 */}
                  {isGroupInterview && (
                    <div className="absolute top-4 left-4 flex items-center space-x-2 bg-purple-600 px-3 py-1 rounded-full">
                      <Users className="h-4 w-4 text-white" />
                      <span className="text-white text-sm font-medium">群体面试</span>
                    </div>
                  )}
                </div>

                {/* 控制按钮 */}
                <div className="flex justify-center space-x-4 mt-6">
                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-full transition-colors ${
                      isCameraOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isCameraOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
                  </button>
                  
                  <button
                    onClick={toggleMic}
                    className={`p-3 rounded-full transition-colors ${
                      isMicOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </button>
                  
                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`p-3 rounded-full transition-colors ${
                      isSpeakerOn 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </button>
                  
                  <button
                    onClick={() => { void (isRecording ? stopRecording() : startRecording()); }}
                    disabled={isTranscribing}
                    className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
                      isRecording
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isRecording ? (
                      <>
                        <Pause className="h-5 w-5 mr-2 inline" />
                        停止回答
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2 inline" />
                        开始回答
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
                  <div className="rounded-3xl border border-gray-700 bg-gradient-to-b from-gray-900 to-gray-950 p-4">
                    <div className="relative overflow-hidden rounded-2xl border border-gray-700 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.28),_transparent_55%),linear-gradient(180deg,_rgba(17,24,39,0.9),_rgba(3,7,18,0.96))] p-4">
                      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-80" />
                      <div className="absolute inset-x-6 top-4 h-20 rounded-full bg-purple-500/10 blur-2xl" />
                      <div className="relative flex items-center justify-center">
                        <div className={`relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 ${
                          digitalHumanMode === 'ask' ? 'border-purple-300 shadow-[0_0_40px_rgba(168,85,247,0.55)]' : 'border-gray-600'
                        } bg-gradient-to-br from-slate-950 via-purple-700 to-indigo-500`}>
                          <div className={`absolute inset-0 ${digitalHumanMode === 'ask' ? 'animate-pulse bg-white/15' : 'bg-white/5'}`} />
                          <div className="absolute inset-3 rounded-full border border-white/15" />
                          <div className="relative z-10 flex items-end gap-1">
                            <span className="h-6 w-1.5 rounded-full bg-white/90" />
                            <span className="h-10 w-1.5 rounded-full bg-white/70" />
                            <span className="h-7 w-1.5 rounded-full bg-white/90" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.3em] text-purple-300">AI数字人面试官</p>
                          <h3 className="truncate text-lg font-semibold text-white">{interviewerName}</h3>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs ${
                          isRecording ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-800 text-gray-300'
                        }`}>
                          {isRecording ? 'Listening' : 'Asking'}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-gray-700 bg-white/5 p-2 text-center">
                          <div className={`mx-auto mb-2 h-2 w-2 rounded-full ${digitalHumanMode === 'ask' ? 'bg-purple-400 animate-pulse' : 'bg-gray-500'}`} />
                          <p className="text-[11px] text-gray-400">聚焦</p>
                        </div>
                        <div className="rounded-xl border border-gray-700 bg-white/5 p-2 text-center">
                          <div className={`mx-auto mb-2 h-2 w-2 rounded-full ${isRecording ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                          <p className="text-[11px] text-gray-400">监听</p>
                        </div>
                        <div className="rounded-xl border border-gray-700 bg-white/5 p-2 text-center">
                          <div className={`mx-auto mb-2 h-2 w-2 rounded-full ${voiceMode === 'auto' ? 'bg-cyan-400 animate-pulse' : 'bg-gray-500'}`} />
                          <p className="text-[11px] text-gray-400">语音</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-gray-300">
                      <p>行业：{selectedIndustryLocal || '未选择'}</p>
                      <p>岗位：{selectedPositionLocal || '未选择'}</p>
                      <p>状态：{isRecording ? '正在听取回答' : digitalHumanMode === 'ask' ? '正在提问' : '等待开始'}</p>
                      <p>语音模式：{voiceMode === 'auto' ? '自动识别' : '按住说话'}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-purple-300">Current Question</p>
                    <p className="mt-2 text-base leading-7 text-white">
                      {currentQuestion}
                    </p>
                    <p className="mt-3 text-sm text-gray-400">
                      {digitalHumanMode === 'ask'
                        ? '数字人会基于行业、岗位介绍和职责持续追问。'
                        : '点击开始面试后，数字人面试官将进入提问状态。'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setVoiceMode('auto')}
                    className={`rounded-full px-4 py-2 text-sm ${
                      voiceMode === 'auto' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    自动语音
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceMode('push-to-talk')}
                    className={`rounded-full px-4 py-2 text-sm ${
                      voiceMode === 'push-to-talk' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    按住说话
                  </button>
                </div>
                <div className="mt-5">
                  <label className="mb-2 block text-sm font-medium text-gray-300">回答记录</label>
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    onBlur={saveCurrentAnswer}
                    rows={5}
                    placeholder="点击“开始回答”可尝试语音转文字；也可以直接输入你的回答。系统会基于真实回答生成评分与报告。"
                    className="w-full rounded-xl border border-gray-600 bg-gray-900/80 p-4 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  {speechStatus && (
                    <p className="mt-2 text-xs text-yellow-300">{speechStatus}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 问题区域 */}
            <div className="space-y-6">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4">
                  {isGroupInterview ? '群体讨论题目' : '面试问题'}
                </h2>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <p className="text-gray-300 leading-relaxed">{currentQuestion}</p>
                </div>
                
                {/* 轮次信息 */}
                {currentRound && (
                  <div className="mt-4 space-y-3">
                    {currentRound.position && (
                      <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                        <p className="text-blue-300 text-sm">
                          <Target className="h-4 w-4 inline mr-1" />
                          目标岗位：{currentRound.position}
                        </p>
                      </div>
                    )}
                    
                    {currentRound.company && (
                      <div className="p-3 bg-green-900/20 border border-green-700 rounded-lg">
                        <p className="text-green-300 text-sm">
                          <Award className="h-4 w-4 inline mr-1" />
                          目标公司：{currentRound.company}
                        </p>
                      </div>
                    )}

                    {currentRound.interviewers && currentRound.interviewers.length > 0 && (
                      <div className="p-3 bg-purple-900/20 border border-purple-700 rounded-lg">
                        <p className="text-purple-300 text-sm">
                          <Users className="h-4 w-4 inline mr-1" />
                          面试官：{currentRound.interviewers.join('、')}
                        </p>
                      </div>
                    )}

                    {isGroupInterview && currentRound.customInstructions && (
                      <div className="p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
                        <p className="text-orange-300 text-sm">
                          <MessageSquare className="h-4 w-4 inline mr-1" />
                          特殊说明：{currentRound.customInstructions}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <p className="text-blue-300 text-sm">
                    💡 {isGroupInterview 
                      ? '群体面试提示：积极参与讨论，展现团队协作能力和领导潜质' 
                      : '建议使用STAR法则回答：情境(Situation) - 任务(Task) - 行动(Action) - 结果(Result)'
                    }
                  </p>
                </div>
              </div>

              {/* 面试提示 */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold text-white mb-4">
                  {isGroupInterview ? '群体面试提示' : '面试提示'}
                </h3>
                <div className="space-y-3 text-sm">
                  {isGroupInterview ? (
                    <>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">积极参与讨论，表达自己的观点</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">倾听他人意见，展现团队协作精神</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">适时引导讨论方向，展现领导能力</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">保持专业态度，尊重每个人的发言</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">保持眼神接触，查看摄像头</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">语速适中，表达清晰</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">结合具体例子说明</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                        <p className="text-gray-300">展现积极正面的态度</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 下一题按钮 */}
              <button
                onClick={handleNextQuestion}
                disabled={isTranscribing}
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentQuestionIndex < questions.length - 1 
                  ? '下一题' 
                  : isMultiRound && currentRoundIndex < interviewRounds.length - 1
                    ? '下一轮面试'
                    : '完成面试'
                }
                <ArrowRight className="h-5 w-5 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 设置页面
  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-4">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">AI面试训练</h1>
              <p className="text-xl text-gray-300">
                {selectedJob ? `针对「${selectedJob.title}」岗位训练高频问题` : '围绕目标岗位训练表达、案例和追问应对'}
              </p>
            </div>
            {selectedJob && (
              <div className="text-right">
                <p className="text-gray-400 text-sm">目标岗位</p>
                <p className="text-white font-semibold">{selectedJob.title}</p>
                <p className="text-gray-300 text-sm">{selectedJob.company}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 面试类型选择 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">面试上下文</h2>
                  <p className="text-sm text-gray-400 mt-1">先选行业、岗位，再补充岗位介绍和职责，面试题会据此生成。</p>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
                  digitalHumanMode === 'ask' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700 text-gray-300'
                }`}>
                  <div className="h-2 w-2 rounded-full bg-current" />
                  {digitalHumanMode === 'ask' ? '数字人面试官已就位' : '待开始'}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">行业</label>
                  <select
                    value={selectedIndustryLocal}
                    onChange={(e) => {
                      const nextIndustry = e.target.value;
                      setSelectedIndustryLocal(nextIndustry);
                      setSelectedPositionLocal('');
                    }}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">请选择行业</option>
                    {industryOptions.map((industry) => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">岗位</label>
                  <select
                    value={selectedPositionLocal}
                    onChange={(e) => setSelectedPositionLocal(e.target.value)}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">{selectedIndustryLocal ? '请选择岗位' : '请先选择行业'}</option>
                    {availablePositions.map((position) => (
                      <option key={position} value={position}>{position}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">岗位介绍</label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="例如：负责招聘、团队管理、候选人评估、业务协同..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-4">
                  {jobContext.map((section, sectionIndex) => (
                    <div key={section.title} className="rounded-2xl border border-gray-700 bg-gray-900/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                          <p className="text-xs text-gray-400">每项一行，越具体越好。</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addContextItem(sectionIndex)}
                          className="text-xs text-purple-300 hover:text-purple-200"
                        >
                          + 添加
                        </button>
                      </div>
                      <div className="space-y-2">
                        {section.items.map((item, itemIndex) => (
                          <div key={`${section.title}-${itemIndex}`} className="flex items-start gap-2">
                            <div className="mt-3 h-2 w-2 rounded-full bg-purple-400" />
                            <input
                              value={item}
                              onChange={(e) => updateContextItem(sectionIndex, itemIndex, e.target.value)}
                              placeholder={`${section.title} ${itemIndex + 1}`}
                              className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-700 p-3 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeContextItem(sectionIndex, itemIndex)}
                              className="mt-2 rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-300 hover:border-red-500 hover:text-red-300"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-300">
                <div className="flex items-center gap-2 text-white">
                  <MessageSquare className="h-4 w-4 text-purple-300" />
                  面试官视角
                </div>
                <p className="mt-2 leading-6">
                  {selectedIndustryLocal && selectedPositionLocal
                    ? `当前面试官将以「${selectedIndustryLocal} / ${selectedPositionLocal}」为基准追问岗位能力、职责理解和真实工作场景。`
                    : '选择行业和岗位后，系统会自动生成针对性的面试题。'}
                </p>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">选择面试类型</h2>
              {setupError && (
                <div className="mb-4 rounded-xl border border-yellow-700/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
                  {setupError}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {interviewTypes.map((type) => (
                  <div
                    key={type.id}
                    className="group cursor-pointer bg-gray-700/50 rounded-xl p-6 border border-gray-600 hover:border-gray-500 transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1"
                  >
                    <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r ${type.color} rounded-lg text-white mb-4 group-hover:scale-110 transition-transform`}>
                      {type.icon}
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2">{type.name}</h3>
                    <p className="text-gray-400 text-sm mb-4 leading-relaxed">{type.description}</p>
                    
                    <div className="space-y-2 text-sm text-gray-500 mb-4">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{type.duration}</span>
                      </div>
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        <span>{type.questions} 个问题</span>
                      </div>
                      {type.supportsMultiRound && (
                        <div className="flex items-center">
                          <Target className="h-4 w-4 mr-2" />
                          <span>支持多轮面试</span>
                        </div>
                      )}
                      {type.supportsGroup && (
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          <span>支持群体面试</span>
                        </div>
                      )}
                    </div>

                    {/* 综合面试的额外选项 */}
                    {type.id === 'comprehensive' && (
                      <div className="space-y-3 mb-4 p-3 bg-gray-600/30 rounded-lg">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isMultiRound}
                            onChange={(e) => setIsMultiRound(e.target.checked)}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded"
                          />
                          <span className="ml-2 text-gray-300 text-sm">启用多轮面试</span>
                        </label>
                        {isMultiRound && (
                          <p className="text-xs text-gray-400 ml-6">
                            可自定义每轮面试内容，支持个人面试和群体面试
                          </p>
                        )}
                      </div>
                    )}
                    
                    <button
                      onClick={() => startInterview(type.id as any)}
                      disabled={!(selectedIndustryLocal && selectedPositionLocal) && type.id !== 'basic_quality'}
                      className="w-full flex items-center justify-center text-blue-400 text-sm font-medium group-hover:text-blue-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {type.id === 'basic_quality' ? '开始基础面试' : '开始针对性面试'}
                      <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 设备检测 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">设备检测</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 摄像头预览 */}
                <div>
                  <h3 className="font-semibold text-gray-300 mb-3">摄像头预览</h3>
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-40 bg-gray-900 rounded-lg object-cover"
                    />
                    <div className="absolute bottom-2 right-2 flex space-x-2">
                      <button
                        onClick={toggleCamera}
                        className={`p-2 rounded-full ${isCameraOn ? 'bg-green-600' : 'bg-red-600'} text-white`}
                      >
                        {isCameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={toggleMic}
                        className={`p-2 rounded-full ${isMicOn ? 'bg-green-600' : 'bg-red-600'} text-white`}
                      >
                        {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 设备状态 */}
                <div>
                  <h3 className="font-semibold text-gray-300 mb-3">设备状态</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center">
                        <Camera className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-gray-300">摄像头</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isCameraOn ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                      }`}>
                        {isCameraOn ? '正常' : '关闭'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center">
                        <Mic className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-gray-300">麦克风</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isMicOn ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                      }`}>
                        {isMicOn ? '正常' : '关闭'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center">
                        <Volume2 className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-gray-300">扬声器</span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isSpeakerOn ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                      }`}>
                        {isSpeakerOn ? '正常' : '关闭'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 侧边栏信息 */}
          <div className="space-y-6">
            {/* 面试准备 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">面试准备</h2>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-900/30 rounded-lg">
                    <Settings className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">环境准备</h3>
                    <p className="text-sm text-gray-400">确保光线充足，背景整洁</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-900/30 rounded-lg">
                    <FileText className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">材料准备</h3>
                    <p className="text-sm text-gray-400">准备简历和相关作品集</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-900/30 rounded-lg">
                    <Brain className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">心理准备</h3>
                    <p className="text-sm text-gray-400">保持放松，展现真正的自己</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 评估维度 */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">评估维度</h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">基本素养</span>
                  <Award className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">沟通表达</span>
                  <Award className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">行业认知</span>
                  <Award className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">岗位匹配</span>
                  <Award className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">发展潜力</span>
                  <Award className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">团队协作</span>
                  <Award className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">领导能力</span>
                  <Award className="h-4 w-4 text-yellow-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewSimulation;
