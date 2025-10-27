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
  Edit3,
  Trash2,
  UserPlus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
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
}

const InterviewSimulation = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { selectedJob, assessmentData } = useWorkflow();
  
  // 面试状态
  const [interviewType, setInterviewType] = useState<'comprehensive' | 'basic_quality' | 'industry_knowledge' | 'position_requirements' | null>(null);
  const [currentStep, setCurrentStep] = useState<'setup' | 'rounds_config' | 'interview' | 'result'>('setup');
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [isTimerActive, setIsTimerActive] = useState(false);
  
  // 多轮面试配置
  const [interviewRounds, setInterviewRounds] = useState<InterviewRound[]>([]);
  const [isMultiRound, setIsMultiRound] = useState(false);
  const [showRoundConfig, setShowRoundConfig] = useState(false);
  
  // 设备状态
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  
  // 面试结果
  const [interviewResult, setInterviewResult] = useState<InterviewResult | null>(null);
  const [llmQuestions, setLlmQuestions] = useState<Record<string, string[]>>({});
  const [generating, setGenerating] = useState(false);
  
  const generateInterviewQuestions = async (type: 'comprehensive' | 'basic_quality' | 'industry_knowledge' | 'position_requirements') => {
    try {
      setGenerating(true);
      const sys = '你是资深中文面试官。仅输出一个JSON数组，数组元素为面试问题字符串；不要输出Markdown或额外文本。';
      const typeMeta = interviewTypes.find(t => t.id === type);
      const count = typeMeta?.questions || 10;
      const ctxParts = [
        `面试类型：${typeMeta?.name || type}`,
        selectedJob?.title ? `目标岗位：${selectedJob.title}` : '',
        selectedJob?.company ? `公司：${selectedJob.company}` : '',
        assessmentData?.aiAnalysis ? `候选人分析摘要：${String(assessmentData.aiAnalysis).slice(0, 800)}` : ''
      ].filter(Boolean);
      const user = `请生成${count}条${typeMeta?.name || ''}面试问题。${ctxParts.join('\n')}\n仅返回JSON数组（纯字符串问题列表）。`;
  
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

  // 模拟面试问题
  const mockQuestions = {
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

  // 群体面试问题
  const groupInterviewQuestions = [
    "假设你们是一个创业团队，需要为一个新的移动应用制定6个月的发展计划，请讨论并达成一致意见。",
    "公司面临预算削减，你们部门需要在保持效率的同时减少20%的开支，请制定具体方案。",
    "如何设计一个员工激励方案来提高团队士气和工作效率？",
    "讨论如何处理一个重要客户的投诉，并制定预防类似问题的措施。",
    "如果要在新市场推广公司产品，你们会制定什么样的营销策略？"
  ];

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

  const startInterview = (type: 'comprehensive' | 'basic_quality' | 'industry_knowledge' | 'position_requirements') => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
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
      // 生成该面试类型的题库（DeepSeek）
      generateInterviewQuestions(type);
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    // 这里可以添加实际的录音逻辑
  };

  const stopRecording = () => {
    setIsRecording(false);
    // 保存当前答案
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = `答案 ${currentQuestionIndex + 1}`;
    setAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (!interviewType) return;
    
    const currentRound = interviewRounds[currentRoundIndex];
    const questions = currentRound ? currentRound.questions : (llmQuestions[interviewType] || mockQuestions[interviewType]);
    
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

  const completeInterview = () => {
    setIsTimerActive(false);
    setIsRecording(false);
    
    // 模拟面试结果
    const result: InterviewResult = {
      type: interviewType,
      isMultiRound,
      rounds: isMultiRound ? interviewRounds.length : 1,
      completedAt: new Date(),
      overallScore: Math.floor(Math.random() * 30) + 70,
      scores: {
        '基本素养': Math.floor(Math.random() * 30) + 70,
        '沟通表达': Math.floor(Math.random() * 30) + 70,
        '行业认知': Math.floor(Math.random() * 30) + 70,
        '岗位匹配': Math.floor(Math.random() * 30) + 70,
        '发展潜力': Math.floor(Math.random() * 30) + 70,
        ...(isMultiRound && interviewRounds.some(r => r.type === 'group') ? {
          '团队协作': Math.floor(Math.random() * 30) + 70,
          '领导能力': Math.floor(Math.random() * 30) + 70
        } : {})
      },
      feedback: [
        '基本素养扎实，展现出良好的职业素质和个人修养',
        '沟通表达能力强，能够清晰准确地传达自己的观点',
        '对发展趋势有深入理解，专业知识储备丰富',
        '与岗位需求匹配度高，相关经验和技能符合要求',
        '展现出良好的学习能力和发展潜力',
        ...(isMultiRound && interviewRounds.some(r => r.type === 'group') ? [
          '在群体面试中表现出色，具备良好的团队协作精神',
          '能够在讨论中积极发言，展现一定的领导潜质'
        ] : [])
      ],
      improvements: [
        '建议在回答行业问题时可以结合更多具体案例',
        '可以进一步加强对公司业务和文化的了解',
        '在描述项目经验时可以更突出个人贡献和成果',
        '建议关注行业最新动态，保持知识更新',
        ...(isMultiRound && interviewRounds.some(r => r.type === 'group') ? [
          '在群体讨论中可以更多地倾听他人意见',
          '建议提升在团队中的影响力和说服力'
        ] : [])
      ]
    };
    
    setInterviewResult(result);
    setCurrentStep('result');
  };

  const restartInterview = () => {
    setInterviewType(null);
    setCurrentStep('setup');
    setCurrentQuestionIndex(0);
    setCurrentRoundIndex(0);
    setAnswers([]);
    setInterviewResult(null);
    setIsRecording(false);
    setIsTimerActive(false);
    setIsMultiRound(false);
    setInterviewRounds([]);
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
                onClick={() => {/* 下载报告逻辑 */}}
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
    const questions = currentRound ? currentRound.questions : (llmQuestions[interviewType] || mockQuestions[interviewType]);
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const isGroupInterview = currentRound?.type === 'group';

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
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
                      isRecording
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                    }`}
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
                className="w-full inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200"
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
              <h1 className="text-4xl font-bold text-white mb-4">AI模拟面试</h1>
              <p className="text-xl text-gray-300">
                {selectedJob ? `针对「${selectedJob.title}」岗位的专业面试` : '真实面试环境模拟，提升面试表现'}
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
              <h2 className="text-2xl font-bold text-white mb-6">选择面试类型</h2>
              
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
                      className="w-full flex items-center justify-center text-blue-400 text-sm font-medium group-hover:text-blue-300 transition-colors"
                    >
                      开始面试
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
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400">
                        正常
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