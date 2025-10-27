import React, { createContext, useContext, useState } from 'react';
import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE } from '../llm/config';
import { apiUrl } from '../api';

interface AssessmentQuestion {
  id: string;
  question: string;
  options: {
    id: string;
    text: string;
    trait?: string;
    hint?: string;
  }[];
  category: 'personality' | 'skills' | 'interests' | 'values';
}

interface AssessmentResult {
  id: string;
  completedAt: Date;
  scores: {
    [key: string]: number;
  };
  traits: string[];
  recommendations: string[];
  aiAnalysis?: string;
}

interface AssessmentContextType {
  currentAssessment: AssessmentQuestion[];
  currentQuestionIndex: number;
  answers: { [questionId: string]: string };
  results: AssessmentResult[];
  selectedIndustry: string;
  selectedPosition: string;
  // 新增：生成状态与题库来源
  isGenerating: boolean;
  lastQuestionSource: 'initial' | 'deepseek';
  generationError: string | null;
  startAssessment: (type: 'general' | 'industry', industry?: string, position?: string) => void;
  answerQuestion: (questionId: string, answerId: string) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  completeAssessment: (aiAnalysis?: string) => AssessmentResult;
  getAssessmentHistory: () => AssessmentResult[];
  getIndustryPositions: () => Record<string, string[]>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

// 行业和岗位数据
const industryPositions = {
  '人工智能': [
    'AI产品经理',
    '机器学习工程师',
    '算法工程师',
    '数据科学家',
    'AI研究员',
    '计算机视觉工程师',
    '自然语言处理工程师',
    '芯片研发工程师'
  ],
  '互联网': [
    '产品经理',
    '前端工程师',
    '后端工程师',
    '全栈工程师',
    'UI/UX设计师',
    '运营专员',
    '数据分析师',
    '测试工程师'
  ],
  '金融科技': [
    '量化分析师',
    '风控专员',
    '金融产品经理',
    '区块链工程师',
    '投资顾问',
    '财务分析师',
    '合规专员',
    '金融数据分析师'
  ],
  '生物医药': [
    '生物信息工程师',
    '药物研发工程师',
    '临床研究员',
    '医疗器械工程师',
    '生物统计师',
    '药事专员',
    '质量控制专员',
    '医学编辑'
  ],
  '新能源': [
    '电池工程师',
    '新能源汽车工程师',
    '光伏工程师',
    '储能系统工程师',
    '充电桩工程师',
    '能源管理师',
    '电力系统工程师',
    '新材料研发工程师'
  ],
  '航空航天': [
    '航空发动机工程师',
    '飞行器设计工程师',
    '航天器结构工程师',
    '导航控制工程师',
    '航空材料工程师',
    '卫星通信工程师',
    '火箭推进工程师',
    '航空电子工程师'
  ],
  '电子通信': [
    '射频工程师',
    '通信协议工程师',
    '5G网络工程师',
    '信号处理工程师',
    '嵌入式工程师',
    '硬件设计工程师',
    '天线设计工程师',
    '光通信工程师'
  ],
  '机械制造': [
    '机械设计工程师',
    '工艺工程师',
    '自动化工程师',
    '精密制造工程师',
    '模具设计工程师',
    '数控编程工程师',
    '质量工程师',
    '设备维护工程师'
  ],
  '化工材料': [
    '化工工艺工程师',
    '材料研发工程师',
    '高分子材料工程师',
    '催化剂工程师',
    '环保工程师',
    '安全工程师',
    '分析化学工程师',
    '纳米材料工程师'
  ],
  '土木建筑': [
    '结构工程师',
    '建筑设计师',
    '岩土工程师',
    '道路桥梁工程师',
    '建筑施工工程师',
    'BIM工程师',
    '工程造价师',
    '城市规划师'
  ],
  '环境工程': [
    '环境监测工程师',
    '污水处理工程师',
    '大气治理工程师',
    '固废处理工程师',
    '环境影响评价师',
    '碳排放管理师',
    '生态修复工程师',
    '清洁生产工程师'
  ],
  '教育': [
    '教师',
    '教研员',
    '班主任',
    '培训师',
    '教育产品经理'
  ]
};

// 针对不同岗位的专业测评题目
const getIndustryQuestions = (industry: string, position: string) => {
  const baseQuestions = [
    {
      id: 'industry_1',
      question: `作为${position}，您认为最重要的核心能力是什么？`,
      category: 'skills' as const,
      options: [
        {
          id: 'i1a',
          text: '技术深度和专业知识',
          trait: '专业技能',
          hint: '注重技术能力和专业知识的积累'
        },
        {
          id: 'i1b',
          text: '跨部门协作和沟通能力',
          trait: '协作能力',
          hint: '重视团队合作和沟通协调'
        },
        {
          id: 'i1c',
          text: '创新思维和问题解决',
          trait: '创新思维',
          hint: '具备创新思维和解决复杂问题的能力'
        },
        {
          id: 'i1d',
          text: '项目管理和执行力',
          trait: '管理能力',
          hint: '擅长项目管理和高效执行'
        }
      ]
    },
    {
      id: 'industry_2',
      question: `在${industry}行业中，您最感兴趣的发展方向是？`,
      category: 'interests' as const,
      options: [
        {
          id: 'i2a',
          text: '技术专家路线',
          trait: '技术导向',
          hint: '专注于技术深度发展'
        },
        {
          id: 'i2b',
          text: '管理领导路线',
          trait: '管理导向',
          hint: '向管理和领导方向发展'
        },
        {
          id: 'i2c',
          text: '产品商业路线',
          trait: '商业导向',
          hint: '关注产品和商业价值'
        },
        {
          id: 'i2d',
          text: '创业创新路线',
          trait: '创业导向',
          hint: '有创业和创新的意愿'
        }
      ]
    },
    {
      id: 'industry_3',
      question: `面对${industry}行业的快速变化，您的应对策略是？`,
      category: 'personality' as const,
      options: [
        {
          id: 'i3a',
          text: '持续学习新技术和知识',
          trait: '学习能力',
          hint: '具备强烈的学习意愿和能力'
        },
        {
          id: 'i3b',
          text: '建立行业人脉网络',
          trait: '社交能力',
          hint: '重视人脉关系的建立和维护'
        },
        {
          id: 'i3c',
          text: '关注行业趋势和前沿',
          trait: '洞察能力',
          hint: '具备敏锐的行业洞察力'
        },
        {
          id: 'i3d',
          text: '积累实战项目经验',
          trait: '实践能力',
          hint: '注重实践经验的积累'
        }
      ]
    }
  ];
  
  return [...mockQuestions, ...baseQuestions];
};

const mockQuestions: AssessmentQuestion[] = [
  {
    id: '1',
    question: '在团队项目中，你更倾向于什么角色？',
    category: 'personality',
    options: [
      { id: '1a', text: '领导者，统筹全局', trait: '领导力', hint: '显示出强烈的领导意愿和统筹能力' },
      { id: '1b', text: '协调者，促进合作', trait: '团队合作', hint: '具备优秀的沟通协调能力' },
      { id: '1c', text: '执行者，专注完成任务', trait: '执行力', hint: '展现出卓越的任务执行能力' },
      { id: '1d', text: '创新者，提供新思路', trait: '创新思维', hint: '拥有独特的创新和思考能力' }
    ]
  },
  {
    id: '2',
    question: '面对复杂问题时，你的第一反应是？',
    category: 'personality',
    options: [
      { id: '2a', text: '分析问题的各个组成部分', trait: '逻辑分析', hint: '具备强大的逻辑思维和分析能力' },
      { id: '2b', text: '寻找相似的历史案例', trait: '经验学习', hint: '善于从过往经验中汲取智慧' },
      { id: '2c', text: '直觉判断可能的解决方案', trait: '直觉洞察', hint: '拥有敏锐的直觉和洞察力' },
      { id: '2d', text: '向他人征求意见和建议', trait: '协作沟通', hint: '重视团队智慧和集体决策' }
    ]
  },
  {
    id: '3',
    question: '在工作环境中，你最看重什么？',
    category: 'values',
    options: [
      { id: '3a', text: '稳定的收入和保障', trait: '安全导向', hint: '追求稳定和安全感' },
      { id: '3b', text: '个人成长和发展机会', trait: '成长导向', hint: '重视个人能力的提升和发展' },
      { id: '3c', text: '工作的社会意义和价值', trait: '价值导向', hint: '关注工作的社会影响和意义' },
      { id: '3d', text: '创新和挑战的机会', trait: '挑战导向', hint: '喜欢接受挑战和创新尝试' }
    ]
  },
  // MBTI 题型（简版）
  {
    id: 'mbti_1',
    question: '与他人互动时，你更倾向于：',
    category: 'personality',
    options: [
      { id: 'mbti_1a', text: '主动社交、表达观点', trait: 'E', hint: '外向(E)：喜欢主动交流与表达' },
      { id: 'mbti_1b', text: '独处思考、更谨慎表达', trait: 'I', hint: '内向(I)：偏好独立思考与深度交流' }
    ]
  },
  {
    id: 'mbti_2',
    question: '获取信息时更看重：',
    category: 'personality',
    options: [
      { id: 'mbti_2a', text: '事实细节、现状数据', trait: 'S', hint: '感觉(S)：偏好具体与现实' },
      { id: 'mbti_2b', text: '可能性、趋势与抽象', trait: 'N', hint: '直觉(N)：关注潜在可能与模式' }
    ]
  },
  {
    id: 'mbti_3',
    question: '做决策时更依赖：',
    category: 'personality',
    options: [
      { id: 'mbti_3a', text: '客观逻辑与原则', trait: 'T', hint: '思考(T)：重视逻辑与一致性' },
      { id: 'mbti_3b', text: '人际影响与感受', trait: 'F', hint: '情感(F)：关注人本与关系' }
    ]
  },
  {
    id: 'mbti_4',
    question: '规划生活/工作更偏好：',
    category: 'personality',
    options: [
      { id: 'mbti_4a', text: '有序计划、按部就班', trait: 'J', hint: '判断(J)：偏好结构与计划' },
      { id: 'mbti_4b', text: '灵活适应、随机探索', trait: 'P', hint: '知觉(P)：偏好弹性与探索' }
    ]
  },
  {
    id: 'mbti_5',
    question: '会议中你通常会：',
    category: 'personality',
    options: [
      { id: 'mbti_5a', text: '主动发言、推动讨论', trait: 'E', hint: '外向(E)' },
      { id: 'mbti_5b', text: '倾听思考、再提出观点', trait: 'I', hint: '内向(I)' }
    ]
  },
  // 盖洛普优势（简版）
  {
    id: 'gallup_1',
    question: '当面对重要任务时，你通常：',
    category: 'skills',
    options: [
      { id: 'gallup_1a', text: '快速拆解目标并执行', trait: 'Achiever', hint: '成就( Achiever )：以完成为导向' },
      { id: 'gallup_1b', text: '从多角度分析后制定方案', trait: 'Analytical', hint: '分析( Analytical )：数据与逻辑导向' },
      { id: 'gallup_1c', text: '提出差异化路径与愿景', trait: 'Strategic', hint: '战略( Strategic )：规划路径与优先级' }
    ]
  },
  {
    id: 'gallup_2',
    question: '学习新领域时，你更倾向于：',
    category: 'skills',
    options: [
      { id: 'gallup_2a', text: '沉浸学习并持续积累', trait: 'Learner', hint: '学习者( Learner )：热爱学习过程' },
      { id: 'gallup_2b', text: '连接资源、靠人脉推动', trait: 'Relator', hint: '关系( Relator )：以深度关系推进' },
      { id: 'gallup_2c', text: '主动承担与可靠交付', trait: 'Responsibility', hint: '责任( Responsibility )：有承诺必有交付' }
    ]
  },
  {
    id: 'gallup_3',
    question: '团队协作时你的优势更像：',
    category: 'interests',
    options: [
      { id: 'gallup_3a', text: '凝聚团队氛围与认同', trait: 'Positivity', hint: '积极( Positivity )：传递正能量' },
      { id: 'gallup_3b', text: '快速找到共识与连接点', trait: 'Harmony', hint: '和谐( Harmony )：化解冲突、寻求共识' },
      { id: 'gallup_3c', text: '敏锐洞察他人动机', trait: 'Individualization', hint: '个体化( Individualization )：善察人心' }
    ]
  }
];

// 基于 DeepSeek 生成题库（JSON）
const generateQuestionsWithDeepSeek = async (params: { type: 'general' | 'industry'; industry?: string; position?: string }): Promise<AssessmentQuestion[]> => {
  try {
    const sys = '你是资深中文职业测评题目生成器。请严格输出JSON数组，每个元素包含: id, question, category, options(4项，每项含id,text,trait可选,hint可选)。category仅限: personality | skills | interests | values。不要输出Markdown代码块或任何额外文本。';
    const target = params.type === 'general'
      ? '通用职业测评（覆盖性格、能力、兴趣、价值观）'
      : `行业专项测评（行业：${params.industry || ''}，岗位：${params.position || ''}）`;
    const user = `请生成${target}的单选题，共12题。保证id短且唯一；每题4个选项；中文输出；贴合中国职场语境。仅返回JSON数组。`;

    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ];

    const resp = await fetch(apiUrl('/api/deepseek/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: DEFAULT_LLM_MODEL, temperature: DEFAULT_TEMPERATURE, stream: false })
    });

    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    let content = data?.choices?.[0]?.message?.content || '';
    content = String(content).trim().replace(/^```json|^```|```$/g, '');
    const arr = JSON.parse(content);
    if (!Array.isArray(arr)) throw new Error('Invalid JSON');

    const validCats = ['personality','skills','interests','values'];
    const normalized: AssessmentQuestion[] = arr.map((q: any, idx: number) => ({
      id: String(q?.id || `q_${idx + 1}`),
      question: String(q?.question || ''),
      category: validCats.includes(q?.category) ? q.category : 'personality',
      options: Array.isArray(q?.options)
        ? q.options.slice(0, 4).map((o: any, j: number) => ({
            id: String(o?.id || `o${idx + 1}${j + 1}`),
            text: String(o?.text || ''),
            trait: o?.trait ? String(o.trait) : undefined,
            hint: o?.hint ? String(o.hint) : undefined
          }))
        : []
    })).filter(q => q.question && q.options.length >= 2);

    if (!normalized.length) throw new Error('No questions generated');
    return normalized;
  } catch (e) {
    console.warn('[DeepSeek] question generation failed:', e);
    return [];
  }
};

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  // 新增：生成状态与题库来源
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastQuestionSource, setLastQuestionSource] = useState<'initial' | 'deepseek'>('initial');
  const [generationError, setGenerationError] = useState<string | null>(null);

  const startAssessment = (type: 'general' | 'industry', industry?: string, position?: string) => {
    // 记录选择状态
    if (type === 'industry' && industry && position) {
      setSelectedIndustry(industry);
      setSelectedPosition(position);
    } else {
      setSelectedIndustry('');
      setSelectedPosition('');
    }

    // 重置进度
    setCurrentQuestionIndex(0);
    setAnswers({});

    // 新逻辑：不再立即使用本地题库，先等待AI题库生成
    setCurrentAssessment([]);
    setLastQuestionSource('initial');
    setGenerationError(null);

    // 前台等待生成
    setIsGenerating(true);
    (async () => {
      try {
        const qs = await generateQuestionsWithDeepSeek({ type, industry, position });
        if (Array.isArray(qs) && qs.length > 0) {
          setCurrentAssessment(qs);
          setLastQuestionSource('deepseek');
        } else {
          setGenerationError('AI题库生成失败，请稍后重试');
        }
      } catch (e) {
        console.warn('[Assessment] DeepSeek generation failed:', e);
        setGenerationError('AI题库生成失败，请稍后重试');
      } finally {
        setIsGenerating(false);
      }
    })();
  };

  const answerQuestion = (questionId: string, answerId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerId
    }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < currentAssessment.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const completeAssessment = (aiAnalysis?: string): AssessmentResult => {
    // 基于答案的简单计分
    const traitCounts: Record<string, number> = {};
    for (const q of currentAssessment) {
      const ansId = answers[q.id];
      if (!ansId) continue;
      const opt = q.options.find(o => o.id === ansId);
      const trait = opt?.trait;
      if (!trait) continue;
      traitCounts[trait] = (traitCounts[trait] || 0) + 1;
    }
  
    // MBTI 维度统计
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
      if (total > 0) {
        mbtiScores[a] = Math.round((aCount / total) * 100);
        mbtiScores[b] = Math.round((bCount / total) * 100);
      } else {
        mbtiScores[a] = 50;
        mbtiScores[b] = 50;
      }
    }
  
    // 盖洛普优势取Top3
    const gallupTraits = ['Achiever','Analytical','Strategic','Learner','Relator','Responsibility','Positivity','Harmony','Individualization'];
    const gallupScores: Record<string, number> = {};
    for (const t of gallupTraits) {
      const c = traitCounts[t] || 0;
      gallupScores[t] = c * 20; // 简单换算到100分制（每次命中20分）
    }
    const topGallup = gallupTraits
      .map(t => ({ t, s: gallupScores[t] }))
      .sort((x,y) => y.s - x.s)
      .slice(0, 3)
      .map(x => x.t);
  
    // 汇总分数（MBTI维度 + Top优势）
    const scores: Record<string, number> = {
      ...mbtiScores,
      ...topGallup.reduce((acc, t) => ({ ...acc, [t]: gallupScores[t] }), {})
    };
  
    // 标签
    const traits = [
      `MBTI：${mbtiType}`,
      ...topGallup
    ];
  
    // 建议（基于维度的简单文案拼接）
    const recs: string[] = [];
    if (mbtiType.startsWith('E')) recs.push('外向倾向：适合团队合作与对外沟通岗位');
    else recs.push('内向倾向：适合深度研究与专业技术岗位');
    if (mbtiType.includes('N')) recs.push('直觉倾向：适合创新产品、战略规划类工作');
    else recs.push('感觉倾向：适合运营执行、质量与流程相关岗位');
    if (mbtiType.includes('T')) recs.push('思考倾向：适合工程、数据分析与逻辑决策场景');
    else recs.push('情感倾向：适合用户体验、HR/培训与客户成功类岗位');
    if (mbtiType.includes('J')) recs.push('判断倾向：适合项目管理与流程规范型工作');
    else recs.push('知觉倾向：适合探索型岗位与快节奏变化环境');
    if (topGallup[0]) recs.push(`你的优势偏好：${topGallup[0]}，建议在岗位中强化相关场景与职责。`);
  
    const result: AssessmentResult = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      completedAt: new Date(),
      scores,
      traits,
      recommendations: recs,
      aiAnalysis
    };
  
    setResults(prev => [result, ...prev]);
    return result;
  };

  const getAssessmentHistory = () => {
    return results;
  };

  return (
    <AssessmentContext.Provider value={{
      currentAssessment,
      currentQuestionIndex,
      answers,
      results,
      selectedIndustry,
      selectedPosition,
      // 新增：生成状态与题库来源
      isGenerating,
      lastQuestionSource,
      generationError,
      startAssessment,
      answerQuestion,
      nextQuestion,
      previousQuestion,
      completeAssessment,
      getAssessmentHistory,
      getIndustryPositions: () => industryPositions
    }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};