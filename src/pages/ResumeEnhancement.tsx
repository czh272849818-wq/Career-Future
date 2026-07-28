import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle,
  Copy,
  Download,
  FileText,
  Lightbulb,
  Sparkles,
  Target,
  Upload,
  Zap
} from 'lucide-react';
import JSZip from 'jszip';
import { useWorkflow } from '../contexts/WorkflowContext';
import { useAuth } from '../contexts/AuthContext';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';
import { apiUrl } from '../api';

type ResumeDraft = {
  headline: string;
  summary: string;
  education?: string[];
  experience: string[];
  skills: string[];
  projects: string[];
  keywords: string[];
  gapNotes: string[];
  copyText: string;
};

type ResumeHistoryItem = {
  optimizedAt?: string;
  targetJob?: { title?: string; company?: string } | null;
  draft?: ResumeDraft;
  comparison?: { before?: string; after?: string; changedPoints?: string[] };
  analysisResult?: { competitiveScore?: number; keywordScore?: number; evidenceScore?: number };
  originalFileName?: string;
};

const XML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
const DOCX_DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildRun = (text: string, options?: { bold?: boolean; size?: number; color?: string; italic?: boolean }) => {
  const rPr = [
    options?.bold ? '<w:b/>' : '',
    options?.italic ? '<w:i/>' : '',
    options?.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '',
    options?.color ? `<w:color w:val="${options.color}"/>` : '',
    '<w:rFonts w:ascii="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:eastAsia="Microsoft YaHei"/>'
  ].join('');
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
};

const buildParagraph = (
  text: string,
  options?: { bold?: boolean; size?: number; color?: string; spacingAfter?: number; align?: 'left' | 'center'; indent?: number }
) => {
  const pPr = [
    options?.align === 'center' ? '<w:jc w:val="center"/>' : '',
    typeof options?.spacingAfter === 'number'
      ? `<w:spacing w:after="${options.spacingAfter}" w:line="360" w:lineRule="auto"/>`
      : '<w:spacing w:after="120" w:line="360" w:lineRule="auto"/>',
    typeof options?.indent === 'number' ? `<w:ind w:left="${options.indent}"/>` : ''
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${buildRun(text, options)}</w:p>`;
};

const buildResumeDocx = async (draft: ResumeDraft, targetTitle: string, targetCompany: string) => {
  const zip = new JSZip();
  const headline = draft.headline || `${targetTitle} | ${targetCompany}`;
  const sections = [
    buildParagraph(headline, { bold: true, size: 32, color: '111827', align: 'center', spacingAfter: 240 }),
    buildParagraph(`求职方向：${targetTitle || '目标岗位'}${targetCompany ? ` · ${targetCompany}` : ''}`, { size: 22, color: '6B7280', align: 'center', spacingAfter: 240 }),
    buildParagraph('联系方式：手机号 / 邮箱 / 城市', { size: 20, color: '6B7280', align: 'center', spacingAfter: 240 }),
    buildParagraph('个人简介', { bold: true, size: 26, color: '111827', spacingAfter: 120 }),
    buildParagraph(draft.summary, { size: 22, color: '111827', spacingAfter: 180 }),
    ...(draft.education && draft.education.length
      ? [
          buildParagraph('教育经历', { bold: true, size: 26, color: '111827', spacingAfter: 120 }),
          ...draft.education.map(item => buildParagraph(`• ${item}`, { size: 22, color: '111827', indent: 360 }))
        ]
      : []),
    buildParagraph('工作经历', { bold: true, size: 26, color: '111827', spacingAfter: 120 }),
    ...draft.experience.map(item => buildParagraph(`• ${item}`, { size: 22, color: '111827', indent: 360 })),
    buildParagraph('核心技能', { bold: true, size: 26, color: '111827', spacingAfter: 120 }),
    buildParagraph(draft.skills.join(' / '), { size: 22, color: '111827', spacingAfter: 180 }),
    buildParagraph('项目经历', { bold: true, size: 26, color: '111827', spacingAfter: 120 }),
    ...draft.projects.map(item => buildParagraph(`• ${item}`, { size: 22, color: '111827', indent: 360 })),
    buildParagraph('优势关键词', { bold: true, size: 26, color: '111827', spacingAfter: 120 }),
    buildParagraph(draft.keywords.join(' / ') || '待补充', { size: 22, color: '111827', spacingAfter: 120 }),
    buildParagraph('岗位关键词', { bold: true, size: 26, color: '111827', spacingAfter: 120 }),
    buildParagraph(draft.gapNotes.join(' / ') || '待补充', { size: 22, color: '111827', spacingAfter: 120 })
  ].join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${XML_NS}" xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" mc:Ignorable="w14 w15 w16se w16cid wp14">
  <w:body>
    ${sections}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', DOCX_CONTENT_TYPES);
  zip.file('_rels/.rels', DOCX_RELS);
  zip.file('word/_rels/document.xml.rels', DOCX_DOCUMENT_RELS);
  zip.file('word/document.xml', documentXml);

  return zip.generateAsync({ type: 'blob' });
};

type TemplateType = 'zh' | 'en';

const TEMPLATE_URLS: Record<TemplateType, string> = {
  zh: '/resume-templates/chinese-template.docx',
  en: '/resume-templates/english-template.docx'
};

const extractTag = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`));
  return match ? match[0] : '';
};

const replaceParagraphBlock = (block: string, text: string, fontFamily: string) => {
  const pPr = extractTag(block, 'w:pPr');
  const rPr = extractTag(block, 'w:rPr');
  const safeText = escapeXml(text || ' ');
  const run = rPr
    ? `<w:r>${rPr}<w:t xml:space="preserve">${safeText}</w:t></w:r>`
    : `<w:r><w:rPr><w:rFonts w:ascii="${fontFamily}" w:hAnsi="${fontFamily}" w:eastAsia="${fontFamily}"/></w:rPr><w:t xml:space="preserve">${safeText}</w:t></w:r>`;
  return `<w:p>${pPr}${run}</w:p>`;
};

const buildChineseTemplateLines = (draft: ResumeDraft, user: { email?: string; phone?: string } | null, selectedJob: { title?: string; company?: string; location?: string } | null) => {
  const skillLine = draft.skills.slice(0, 6).join(' / ') || draft.keywords.slice(0, 6).join(' / ') || '岗位匹配 / 项目表达 / 量化结果';
  const exp = draft.experience.length ? draft.experience : [
    '将经历改写为“动作 + 方法 + 结果”。',
    '压缩无关描述，只保留证据。',
    '补充数字、比例或明确结果。'
  ];
  const proj = draft.projects.length ? draft.projects : [
    '项目1：围绕目标岗位最相关的业务问题，说明背景、动作、结果。',
    '项目2：补充一个能证明你做成事情的案例。',
    '项目3：写清楚你负责了什么、影响了什么。'
  ];
  const edu = draft.education?.length ? draft.education : [
    '学校 / 专业 / 学位 / 时间',
    'GPA / 荣誉 / 课程',
    '相关课程 / 证书 / 研究方向'
  ];
  return [
    '',
    draft.headline || `${selectedJob?.title || '目标岗位'}候选人`,
    `电话：${user?.phone || '待补充'}    邮箱：${user?.email || '待补充'}    地点：${selectedJob?.location || '全国'}`,
    '教育背景',
    edu[0] || '',
    edu[1] || '',
    edu[2] || '',
    '',
    '',
    '实习经历',
    `${selectedJob?.company || '公司名称'} ｜ ${selectedJob?.title || '岗位名称'} ｜ 时间`,
    exp[0] || '',
    exp[1] || '',
    exp[2] || '',
    `${selectedJob?.company || '公司名称'} ｜ ${selectedJob?.title || '岗位名称'} ｜ 时间`,
    exp[3] || exp[0] || '',
    exp[4] || exp[1] || '',
    exp[5] || exp[2] || '',
    '课外经历',
    '组织 / 社团 / 时间',
    '与目标岗位相关的课外实践或组织经历',
    '强调协作、推动与执行',
    '体现领导或沟通能力',
    '项目经历',
    '项目名称 ｜ 角色 ｜ 时间',
    proj[0] || '',
    proj[1] || '',
    proj[2] || '',
    '自我评价',
    draft.summary || `面向${selectedJob?.title || '目标岗位'}，擅长把复杂工作转成可量化结果。`,
    skillLine,
    '结果导向 / 执行力 / 协作',
    '个人特质',
    '语言能力：中文 / 英语',
    `计算机能力：${skillLine}`,
    '兴趣爱好：待补充'
  ];
};

const buildEnglishTemplateLines = (draft: ResumeDraft, user: { email?: string; phone?: string } | null, selectedJob: { title?: string; company?: string; location?: string } | null) => {
  const exp = draft.experience.length ? draft.experience : [
    'Reframed responsibilities into action, method, and impact.',
    'Kept only evidence that supports the target role.',
    'Added numbers and business outcomes.'
  ];
  const proj = draft.projects.length ? draft.projects : [
    'Project 1: Describe the problem, action, and result.',
    'Project 2: Add a measurable result.',
    'Project 3: Keep it concise.'
  ];
  const skills = draft.skills.length ? draft.skills : ['Problem Solving', 'Execution', 'Communication'];
  return [
    draft.headline || 'YOUR NAME',
    `Email: ${user?.email || 'TBD'} | Phone: ${user?.phone || 'TBD'} | Location: ${selectedJob?.location || 'TBD'}`,
    'Education',
    'University | City, State',
    'Degree in Major | Expected Month Year',
    'Minor: Optional',
    'GPA: Optional',
    'Honor: Optional',
    'Relevant Coursework: Optional',
    'Skills',
    `Programming Languages: ${skills.slice(0, 3).join(', ')}`,
    `Software Skills: ${skills.slice(3, 6).join(', ') || skills.join(', ')}`,
    'Language Skills: Chinese, English',
    'Work Experience',
    `${selectedJob?.company || 'Company Name'} | ${selectedJob?.title || 'Job Title'}`,
    'Month Year - Month Year',
    exp[0] || '',
    exp[1] || '',
    exp[2] || '',
    'Research/Lab Experience',
    'Research / Lab Name | City, Country',
    'Professor’s Job Title, Name, School | Month Year - Month Year',
    'Describe the research problem, your role, and measurable outcome.',
    'Describe the technical or analytical skills you used.',
    'Summarize the impact or conclusion.',
    'Project Experience',
    'Project Name | City, Country',
    'Role | Month Year - Month Year',
    proj[0] || '',
    proj[1] || '',
    proj[2] || '',
    'Leadership Experience',
    'Organization Name | City, Country',
    'Job Title | Month Year - Month Year',
    'Describe leadership impact, scope, and result.',
    'Describe coordination or communication work.',
    'Describe a measurable outcome.',
    'Volunteer Experience',
    'Organization Name | City, Country',
    'Job Title | Month Year - Month Year',
    'Describe contribution.',
    'Describe your responsibility and outcome.',
    'Keep it concise.',
    draft.summary || `Targeting ${selectedJob?.title || 'the role'} with outcome-driven experience.`,
  ];
};

const buildTemplateResumeDocx = async (
  templateType: TemplateType,
  draft: ResumeDraft,
  user: { email?: string; phone?: string } | null,
  selectedJob: { title?: string; company?: string; location?: string } | null
) => {
  const templateResp = await fetch(TEMPLATE_URLS[templateType]);
  if (!templateResp.ok) {
    throw new Error('模板加载失败');
  }
  const templateBuffer = await templateResp.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('模板文档缺失');

  const documentXml = await documentFile.async('string');
  const paragraphs = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const replacements = templateType === 'en'
    ? buildEnglishTemplateLines(draft, user, selectedJob)
    : buildChineseTemplateLines(draft, user, selectedJob);

  const fontFamily = templateType === 'en' ? 'Times New Roman' : 'Microsoft YaHei';
  let cursor = 0;
  const rebuilt = documentXml.replace(/<w:p[\s\S]*?<\/w:p>/g, (block) => {
    const text = replacements[cursor++] ?? '';
    return replaceParagraphBlock(block, text, fontFamily);
  });

  if (cursor < paragraphs.length) {
    // leave untouched paragraphs replaced with blank text to keep template layout stable
  }

  zip.file('word/document.xml', rebuilt);
  return zip.generateAsync({ type: 'blob' });
};

const ResumeEnhancement = () => {
  const navigate = useNavigate();
  const { selectedJob, assessmentData, optimizedResume, setOptimizedResume, setCurrentStep, updateAssessmentData } = useWorkflow();
  const { user, isAuthenticated } = useAuth();
  const [resumeTemplate, setResumeTemplate] = useState<TemplateType>('zh');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');
  const [resumeHistory, setResumeHistory] = useState<ResumeHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!selectedJob) return;
    setJobDescription(`职位：${selectedJob.title}
公司：${selectedJob.company}
职位描述：${selectedJob.description}
任职要求：${selectedJob.requirements.join('、')}
薪资范围：${selectedJob.salary}
工作地点：${selectedJob.location}`);
  }, [selectedJob]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const resp = await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/data`));
        if (!resp.ok) return;
        const payload = await resp.json().catch(() => ({}));
        const history = Array.isArray(payload?.data?.resumes) ? payload.data.resumes : [];
        setResumeHistory(history);
        const latest = history[0] || payload?.data?.optimizedResume || null;
        if (!draft && latest?.draft) setDraft(latest.draft);
      } finally {
        setHistoryLoading(false);
      }
    };
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!draft && optimizedResume?.draft) {
      setDraft(optimizedResume.draft);
    }
  }, [draft, optimizedResume]);

  const hasResumeSource = Boolean(uploadedFile || assessmentData.resume || assessmentData.resumeText);

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ');

  const extractKeywords = (text: string) => Array.from(new Set(
    text
      .replace(/[，。；、：！？（）()[\]{}|/\\]/g, ' ')
      .split(/\s+/)
      .map(item => item.trim())
      .filter(item => item.length >= 2 && item.length <= 24)
  )).slice(0, 80);

  const getResumeText = async () => {
    if (assessmentData.resumeText) return assessmentData.resumeText;
    const file = uploadedFile || assessmentData.resume;
    if (!file) return '';

    const base64 = await fileToBase64(file);
    const resp = await fetch(apiUrl('/api/extract-text'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: base64 })
    });
    if (!resp.ok) return '';
    const data = await resp.json();
    return String(data?.text || '');
  };

  const buildFallbackDraft = (resumeText: string, targetKeywords: string[]): ResumeDraft => {
    const topKeywords = targetKeywords.slice(0, 6);
    const focus = selectedJob?.title || '目标岗位';
    const company = selectedJob?.company || '目标公司';
    const summary = selectedJob
      ? `面向${focus}岗位，擅长把复杂工作转成可量化结果，能够围绕${topKeywords.slice(0, 3).join('、') || '岗位要求'}快速产出业务价值。`
      : '围绕目标岗位重写的简历概要，突出量化成果、岗位关键词和可验证能力。';

    return {
      headline: `${focus} | ${company} | 结果导向型候选人`,
      summary,
      education: [
        '教育经历：按“学校 / 专业 / 学位 / 时间”填写。',
        '如果有优秀课程、GPA 或奖项，可单独保留一行。'
      ],
      experience: [
        `将原始经历重写为“动作 + 方法 + 结果”，优先保留能证明${topKeywords[0] || '岗位能力'}的项目。`,
        `把与目标岗位无关的描述压缩为一行，只保留能够支撑投递的证据。`,
        `如果当前简历缺少数字结果，优先补充用户增长、效率提升、成本下降、协作规模等指标。`
      ],
      skills: topKeywords.length ? topKeywords : ['岗位匹配', '项目表达', '量化结果', '协作推进'],
      projects: [
        '项目1：围绕目标岗位最相关的业务问题，说明背景、动作、结果。',
        '项目2：补充一个能证明你做成事情的案例，尽量带数字。',
        '项目3：如果没有项目链接，至少写清楚你具体负责了什么、影响了什么。'
      ],
      keywords: topKeywords,
      gapNotes: resumeText ? [
        '把职责改成结果，不要只写做了什么。',
        '把弱相关经历压缩掉，留出简历版面给最强证据。',
        '用目标岗位词汇重写项目标题和摘要。'
      ] : [
        '先提供一份可解析的简历文本或文件。',
        '再基于目标岗位重写经历和技能。',
        '优化时优先保留可验证成果。'
      ],
      copyText: [
        `姓名｜${focus}候选人`,
        `目标岗位：${focus}`,
        `当前标题：${focus} | ${company} | 结果导向型候选人`,
        '',
        '个人简介',
        summary,
        '',
        '工作经历',
        ...[
          `• 将原始经历重写为“动作 + 方法 + 结果”，优先保留能证明${topKeywords[0] || '岗位能力'}的项目。`,
          `• 把与目标岗位无关的描述压缩为一行，只保留能够支撑投递的证据。`,
          `• 如果当前简历缺少数字结果，优先补充用户增长、效率提升、成本下降、协作规模等指标。`
        ],
        '',
        '核心技能',
        topKeywords.join(' / ') || '岗位匹配 / 项目表达 / 量化结果 / 协作推进',
        '',
        '项目经历',
        '• 项目1：围绕目标岗位最相关的业务问题，说明背景、动作、结果。',
        '• 项目2：补充一个能证明你做成事情的案例，尽量带数字。',
        '• 项目3：如果没有项目链接，至少写清楚你具体负责了什么、影响了什么。'
      ].join('\n')
    };
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type === 'application/pdf' || file.name.endsWith('.docx')) {
      setUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
  };

  const handleResumeTextChange = (value: string) => {
    updateAssessmentData({ resumeText: value });
  };

  const handleRestoreHistory = (item: ResumeHistoryItem | null) => {
    if (!item?.draft) return;
    setDraft(item.draft);
    setOptimizedResume(item);
  };

  const handleAnalyze = async () => {
    setIsProcessing(true);
    setCopyState('idle');

    try {
      const resumeText = await getResumeText();
      const targetText = [
        jobDescription,
        selectedJob?.title,
        selectedJob?.description,
        selectedJob?.requirements?.join(' '),
        assessmentData.traits?.join(' ')
      ].filter(Boolean).join('\n');

      const resumeNorm = normalizeText(resumeText);
      const jdKeywords = extractKeywords(targetText);
      const matchedKeywords = jdKeywords.filter(keyword => resumeNorm.includes(keyword.toLowerCase()));
      const missingKeywords = jdKeywords.filter(keyword => !resumeNorm.includes(keyword.toLowerCase())).slice(0, 12);

      const keywordScore = jdKeywords.length ? Math.round((matchedKeywords.length / jdKeywords.length) * 100) : 55;
      const evidenceScore = /\d+|%|万|千|增长|提升|降低|节省|用户|收入|转化|留存/.test(resumeText) ? 82 : 52;
      const focusScore = selectedJob ? 88 : 64;
      const competitiveScore = Math.max(35, Math.min(96, Math.round(keywordScore * 0.4 + evidenceScore * 0.35 + focusScore * 0.25)));

      const aiPrompt = {
        headline: '请输出可直接复制的优化简历',
        summary: '围绕目标岗位重写个人简介，避免空话',
        experience: '每条经历用动作+方法+结果表达，保留量化结果',
        skills: '只保留和岗位直接相关的技能关键词',
        projects: '给出3条项目表达，适合直接放进简历',
        keywords: '输出最该补齐的关键词',
        copyText: '输出一份完整可复制的简历正文'
      };

      const sys = '你是中文简历优化器。目标不是打分，而是生成一份可以直接复制到简历里的成品。只输出JSON，不要Markdown，不要解释。';
      const user = [
        `【简历文本】${resumeText || '（无）'}`,
        `【目标岗位】${selectedJob ? `${selectedJob.company} / ${selectedJob.title}` : '（未选择）'}`,
        `【岗位描述】${jobDescription || '（无）'}`,
        `【命中关键词】${matchedKeywords.join('、') || '（无）'}`,
        `【缺失关键词】${missingKeywords.join('、') || '（无）'}`,
        `【输出字段】${JSON.stringify(aiPrompt)}`,
        '请基于以上信息输出JSON，字段为 headline, summary, experience, skills, projects, keywords, gapNotes, copyText。'
      ].join('\n');

      let parsedDraft: ResumeDraft | null = null;

      try {
        const resp = await fetch(apiUrl('/api/deepseek/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: user }
            ],
            model: 'deepseek-chat',
            temperature: 0.3,
            stream: false
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const content = data?.choices?.[0]?.message?.content || '';
          const jsonText = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
          const raw = JSON.parse(jsonText);
          parsedDraft = {
            headline: String(raw.headline || raw.title || selectedJob?.title || '优化后的简历'),
            summary: String(raw.summary || ''),
            education: Array.isArray(raw.education) ? raw.education.map(String).slice(0, 3) : [],
            experience: Array.isArray(raw.experience) ? raw.experience.map(String).slice(0, 5) : [],
            skills: Array.isArray(raw.skills) ? raw.skills.map(String).slice(0, 8) : [],
            projects: Array.isArray(raw.projects) ? raw.projects.map(String).slice(0, 4) : [],
            keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String).slice(0, 8) : missingKeywords,
            gapNotes: Array.isArray(raw.gapNotes) ? raw.gapNotes.map(String).slice(0, 4) : [],
            copyText: String(raw.copyText || '')
          };
        }
      } catch {
        parsedDraft = null;
      }

      const finalDraft = parsedDraft || buildFallbackDraft(resumeText, jdKeywords.length ? jdKeywords : missingKeywords);
      if (!finalDraft.copyText) {
        finalDraft.copyText = buildFallbackDraft(resumeText, jdKeywords.length ? jdKeywords : missingKeywords).copyText;
      }

      const beforeSummary = resumeText
        ? String(resumeText).slice(0, 180)
        : '未提供可解析的简历文本';

      setDraft(finalDraft);
      setOptimizedResume({
        originalFile: uploadedFile || assessmentData.resume,
        targetJob: selectedJob,
        analysisResult: {
          competitiveScore,
          keywordScore,
          evidenceScore,
          matchedKeywords: matchedKeywords.slice(0, 16),
          missingKeywords,
          improvements: [
            {
              category: '简历成品',
              severity: 'low',
              issue: '页面已从分析页改成可复制的优化简历页',
              suggestion: '直接复制右侧简历草稿到投递版本中。'
            },
            {
              category: '岗位关键词',
              severity: missingKeywords.length > 4 ? 'medium' : 'low',
              issue: `还需补齐 ${missingKeywords.length} 个高频关键词`,
              suggestion: '优先补齐目标岗位中重复出现但简历没有出现的词。',
              keywords: missingKeywords
            },
            {
              category: '证据强度',
              severity: evidenceScore >= 80 ? 'low' : 'medium',
              issue: evidenceScore >= 80 ? '已有量化表达' : '量化结果仍偏少',
              suggestion: '每段经历至少保留一个数字、百分比或明确结果。'
            },
            {
              category: '导出文件',
              severity: 'low',
              issue: '已支持下载 Word 简历',
              suggestion: '下载后可直接投递，不需要再手动拼版。'
            }
          ],
          starOptimization: {
            before: '负责公司产品的开发工作',
            after: {
              situation: selectedJob ? `面向${selectedJob.title}岗位要求` : '面向目标岗位要求',
              task: '把经历改写成可投递内容',
              action: '优先保留结果、关键词和项目证据',
              result: `预计匹配度可达到 ${competitiveScore}% 左右`
            }
          },
          matchingJobs: selectedJob
            ? [{ title: selectedJob.title, company: selectedJob.company, matchRate: selectedJob.matchScore }]
            : [{ title: '请先选择目标岗位', company: '岗位推荐模块', matchRate: competitiveScore }]
        },
        comparison: {
          before: beforeSummary,
          after: finalDraft.summary,
          changedPoints: [
            '把职责描述改成结果表达',
            '把目标岗位关键词写进简历',
            '压缩弱相关内容，突出核心证据'
          ]
        },
        draft: finalDraft,
        optimizedAt: new Date()
      });

      if (isAuthenticated && user?.id) {
        const savedRecord: ResumeHistoryItem = {
          optimizedAt: new Date().toISOString(),
          targetJob: selectedJob ? { title: selectedJob.title, company: selectedJob.company } : null,
          draft: finalDraft,
          comparison: {
            before: beforeSummary,
            after: finalDraft.summary,
            changedPoints: [
              '把职责描述改成结果表达',
              '把目标岗位关键词写进简历',
              '压缩弱相关内容，突出核心证据'
            ]
          },
          analysisResult: {
            competitiveScore,
            keywordScore,
            evidenceScore
          },
          originalFileName: (uploadedFile || assessmentData.resume)?.name || ''
        };

        try {
          const resp = await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/data`));
          const payload = await resp.json().catch(() => ({}));
          const existing = Array.isArray(payload?.data?.resumes) ? payload.data.resumes : [];
          const nextResumes = [savedRecord, ...existing].slice(0, 10);
          await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/data`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              optimizedResume: savedRecord,
              resumes: nextResumes
            })
          });
          setResumeHistory(nextResumes);
        } catch {
          // 保存失败不阻塞本地结果展示
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!draft?.copyText) return;
    await navigator.clipboard.writeText(draft.copyText);
    setCopyState('done');
    window.setTimeout(() => setCopyState('idle'), 1500);
  };

  const handleDownloadWord = async () => {
    if (!draft) return;
    let blob;
    try {
      blob = await buildTemplateResumeDocx(resumeTemplate, draft, user, selectedJob);
    } catch {
      blob = await buildResumeDocx(
        draft,
        selectedJob?.title || '目标岗位',
        selectedJob?.company || '目标公司'
      );
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedJob?.title || '优化简历'}-${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleGoToCareerPlanning = () => {
    setCurrentStep(4);
    navigate('/career-planning');
  };

  const showReadyState = useMemo(() => Boolean(draft), [draft]);
  const latestHistory = resumeHistory[0] || optimizedResume || null;

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <BackButton />
        </div>
        <WorkflowProgress />

        <section className="mt-6 rounded-3xl border border-gray-700 bg-gray-800/60 p-8 shadow-2xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">Resume Optimization</p>
              <h1 className="text-4xl font-bold text-white">把简历改成可直接投递的成品</h1>
              <p className="mt-4 text-lg leading-8 text-gray-300">
                只做一件事：围绕一个目标岗位，重写个人简介、经历和技能，让用户能直接复制使用。
              </p>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-950/50 p-5 lg:min-w-[280px]">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-emerald-300" />
                <span className="font-semibold text-white">目标状态</span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">目标岗位</span>
                  <span className="text-right text-white">{selectedJob ? selectedJob.title : '未选择'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">简历来源</span>
                  <span className="text-white">{hasResumeSource ? '已就绪' : '待上传'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">输出结果</span>
                  <span className={showReadyState ? 'text-emerald-300' : 'text-yellow-300'}>{showReadyState ? '已生成' : '待生成'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">云端记录</h2>
              <p className="mt-2 text-sm text-gray-400">
                {historyLoading ? '正在读取最近一次优化结果...' : latestHistory ? '已恢复最近一次保存的简历版本' : '暂无历史记录'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {latestHistory?.optimizedAt && (
                <span className="rounded-full border border-emerald-700 bg-emerald-900/20 px-3 py-1 text-sm text-emerald-200">
                  {new Date(latestHistory.optimizedAt).toLocaleString()}
                </span>
              )}
              {latestHistory?.draft && (
                <button
                  type="button"
                  onClick={() => handleRestoreHistory(latestHistory)}
                  className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-700"
                >
                  恢复最近版本
                </button>
              )}
            </div>
          </div>
          {latestHistory && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-gray-200">
                <p className="text-sm text-gray-400">目标岗位</p>
                <p className="mt-2 font-semibold text-white">{latestHistory.targetJob?.title || selectedJob?.title || '未记录'}</p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-gray-200">
                <p className="text-sm text-gray-400">综合评分</p>
                <p className="mt-2 font-semibold text-white">{latestHistory.analysisResult?.competitiveScore ?? '未记录'}</p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-gray-200">
                <p className="text-sm text-gray-400">保存文件</p>
                <p className="mt-2 font-semibold text-white">{latestHistory.originalFileName || '手动生成'}</p>
              </div>
            </div>
          )}
        </section>

        {optimizedResume?.comparison && (
          <section className="mt-8 rounded-2xl border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-white">修改前后对比</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-red-700 bg-red-900/20 p-4">
                <p className="text-sm font-semibold text-red-200">修改前</p>
                <p className="mt-2 leading-7 text-red-50">
                  {optimizedResume.comparison.before || '暂无原始摘要'}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-700 bg-emerald-900/20 p-4">
                <p className="text-sm font-semibold text-emerald-200">修改后</p>
                <p className="mt-2 leading-7 text-emerald-50">
                  {optimizedResume.comparison.after || '暂无优化摘要'}
                </p>
              </div>
            </div>
            {Array.isArray(optimizedResume.comparison.changedPoints) && optimizedResume.comparison.changedPoints.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {optimizedResume.comparison.changedPoints.map((item: string) => (
                  <span key={item} className="rounded-full border border-gray-600 bg-gray-900 px-3 py-1 text-sm text-gray-200">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
              <h2 className="mb-4 text-2xl font-bold text-white">1. 提供简历来源</h2>
              {assessmentData.resume && (
                <div className="mb-4 rounded-xl border border-green-700 bg-green-900/20 p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-green-400" />
                    <span className="text-green-300">已从测评中获取简历：{assessmentData.resume.name}</span>
                  </div>
                </div>
              )}

              <div
                className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
                  dragActive ? 'border-emerald-500 bg-emerald-900/20' : uploadedFile ? 'border-emerald-500 bg-emerald-900/10' : 'border-gray-600'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {uploadedFile ? (
                  <div className="space-y-3">
                    <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
                    <div>
                      <p className="font-semibold text-white">{uploadedFile.name}</p>
                      <p className="text-sm text-gray-400">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={() => setUploadedFile(null)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      移除文件
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="mx-auto h-12 w-12 text-gray-500" />
                    <div>
                      <p className="text-lg font-medium text-white">拖拽简历到这里，或点击选择</p>
                      <p className="text-gray-400">支持 PDF、DOCX</p>
                    </div>
                    <div>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-flex cursor-pointer items-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-white transition hover:from-purple-700 hover:to-blue-700"
                      >
                        选择文件
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-gray-700 bg-gray-900/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">直接粘贴简历文本</p>
                    <p className="mt-1 text-sm text-gray-400">没有文件也可以继续，系统会优先读取这里的内容。</p>
                  </div>
                  {assessmentData.resumeText && (
                    <button
                      type="button"
                      onClick={() => handleResumeTextChange('')}
                      className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 transition hover:bg-gray-800"
                    >
                      清空
                    </button>
                  )}
                </div>
                <textarea
                  value={assessmentData.resumeText || ''}
                  onChange={(e) => handleResumeTextChange(e.target.value)}
                  placeholder="把简历全文粘贴到这里。"
                  rows={7}
                  className="mt-4 w-full resize-none rounded-xl border border-gray-600 bg-gray-950/60 p-4 text-sm leading-7 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
              <h2 className="mb-3 text-2xl font-bold text-white">2. 目标岗位</h2>
              <p className="mb-4 text-gray-300">
                {selectedJob ? '已自动带入岗位信息，可按需微调。' : '粘贴目标岗位描述，系统会据此重写简历。'}
              </p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="请粘贴目标岗位的职位描述..."
                rows={9}
                className="w-full resize-none rounded-xl border border-gray-600 bg-gray-700 p-4 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="mt-3 flex items-center justify-between text-sm text-gray-400">
                <span>{jobDescription.length}/2000</span>
                {jobDescription && (
                  <span className="inline-flex items-center text-emerald-300">
                    <Target className="mr-1 h-4 w-4" />
                    已识别目标岗位
                  </span>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-gray-700 bg-gray-900/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Word 模板</p>
                    <p className="mt-1 text-sm text-gray-400">下载时使用的简历版式，直接决定最终文件长什么样。</p>
                  </div>
                  <div className="rounded-full border border-gray-700 bg-gray-950/60 px-3 py-1 text-xs text-gray-300">
                    当前：{resumeTemplate === 'zh' ? '中文模板' : '英文模板'}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResumeTemplate('zh')}
                    className={`rounded-lg px-4 py-3 text-sm font-medium transition ${
                      resumeTemplate === 'zh'
                        ? 'bg-emerald-500 text-gray-950'
                        : 'border border-gray-700 bg-gray-950/40 text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    中文模板
                  </button>
                  <button
                    type="button"
                    onClick={() => setResumeTemplate('en')}
                    className={`rounded-lg px-4 py-3 text-sm font-medium transition ${
                      resumeTemplate === 'en'
                        ? 'bg-emerald-500 text-gray-950'
                        : 'border border-gray-700 bg-gray-950/40 text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    英文模板
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
              <button
                onClick={handleAnalyze}
                disabled={!hasResumeSource || isProcessing}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-lg font-semibold text-white transition hover:from-purple-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    正在生成优化简历
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    生成优化简历
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-sm text-gray-400">
                输出会优先生成“可复制文本”，不是只给分析分数。
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
              <h2 className="mb-4 text-2xl font-bold text-white">3. 优化结果</h2>

              {!draft ? (
                <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-6 text-center text-gray-400">
                  生成后，这里会显示一份可以直接复制的简历草稿。
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-xl border border-emerald-700 bg-emerald-900/20 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Headline</p>
                    <p className="mt-2 text-xl font-bold text-white">{draft.headline}</p>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                    <p className="text-sm font-semibold text-gray-300">个人简介</p>
                    <p className="mt-2 leading-7 text-gray-100">{draft.summary}</p>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                    <p className="text-sm font-semibold text-gray-300">工作经历</p>
                    <div className="mt-3 space-y-2">
                      {draft.experience.map(item => (
                        <p key={item} className="leading-7 text-gray-100">• {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                    <p className="text-sm font-semibold text-gray-300">核心技能</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {draft.skills.map(item => (
                        <span key={item} className="rounded-full border border-gray-600 bg-gray-800 px-3 py-1 text-sm text-gray-100">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
                    <p className="text-sm font-semibold text-gray-300">项目经历</p>
                    <div className="mt-3 space-y-2">
                      {draft.projects.map(item => (
                        <p key={item} className="leading-7 text-gray-100">• {item}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-yellow-700 bg-yellow-900/20 p-4">
                    <p className="text-sm font-semibold text-yellow-200">优先补齐</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {draft.keywords.map(item => (
                        <span key={item} className="rounded-full border border-yellow-700 bg-yellow-950/40 px-3 py-1 text-sm text-yellow-100">
                          {item}
                        </span>
                      ))}
                    </div>
                    {draft.gapNotes.length > 0 && (
                      <div className="mt-4 space-y-2 text-sm text-yellow-100">
                        {draft.gapNotes.map(item => (
                          <p key={item}>• {item}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">4. 可复制文本</h2>
                {draft && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center rounded-lg border border-gray-600 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copyState === 'done' ? '已复制' : '复制'}
                    </button>
                    <button
                      onClick={handleDownloadWord}
                      className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-gray-950 transition hover:bg-emerald-400"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      下载 Word（{resumeTemplate === 'zh' ? '中文' : '英文'}）
                    </button>
                  </div>
                )}
              </div>
              <textarea
                readOnly
                value={draft?.copyText || '生成后可复制完整简历正文。'}
                aria-label="可复制的完整简历正文"
                className="h-[34rem] w-full resize-none overflow-y-auto rounded-xl border border-gray-600 bg-gray-950/60 p-4 text-sm leading-7 text-gray-100 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {draft && (
          <section className="mt-8 rounded-2xl border border-gray-700 bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white shadow-lg">
            <h2 className="text-2xl font-bold">下一步只做两件事</h2>
            <p className="mt-2 text-blue-100">
              先把这版简历用于投递，再进入职业规划和面试训练。不要继续堆功能。
            </p>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row">
              <button
                onClick={handleGoToCareerPlanning}
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 font-semibold text-purple-700 transition hover:bg-blue-50"
              >
                进入职业规划
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/interview')}
                className="inline-flex items-center justify-center rounded-xl border border-white/30 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                去面试训练
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ResumeEnhancement;
