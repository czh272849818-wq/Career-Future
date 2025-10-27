import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  Download, 
  Star, 
  TrendingUp, 
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Target,
  Zap,
  Award,
  ArrowRight
} from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';
import WorkflowProgress from '../components/workflow/WorkflowProgress';
import BackButton from '../components/ui/BackButton';

const ResumeEnhancement = () => {
  const navigate = useNavigate();
  const { selectedJob, assessmentData, setOptimizedResume, setCurrentStep } = useWorkflow();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  // 如果有选中的岗位，自动填充JD
  React.useEffect(() => {
    if (selectedJob) {
      setJobDescription(`职位：${selectedJob.title}
公司：${selectedJob.company}
职位描述：${selectedJob.description}
任职要求：${selectedJob.requirements.join('、')}
薪资范围：${selectedJob.salary}
工作地点：${selectedJob.location}`);
    }
  }, [selectedJob]);
  const templates = [
    { 
      id: 'modern', 
      name: '现代简约', 
      description: '适合科技、互联网行业',
      color: 'from-blue-500 to-cyan-500',
      preview: 'https://images.pexels.com/photos/590020/pexels-photo-590020.jpeg?w=300'
    },
    { 
      id: 'professional', 
      name: '商务专业', 
      description: '适合金融、咨询行业',
      color: 'from-gray-600 to-gray-800',
      preview: 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?w=300'
    },
    { 
      id: 'creative', 
      name: '创意设计', 
      description: '适合设计、广告行业',
      color: 'from-purple-500 to-pink-500',
      preview: 'https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?w=300'
    },
    { 
      id: 'academic', 
      name: '学术研究', 
      description: '适合教育、科研行业',
      color: 'from-green-500 to-blue-500',
      preview: 'https://images.pexels.com/photos/590018/pexels-photo-590018.jpeg?w=300'
    }
  ];

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.docx')) {
        setUploadedFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    setIsProcessing(true);
    
    // Simulate API processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setAnalysisResult({
      competitiveScore: 85,
      improvements: [
        {
          category: '工作经历',
          severity: 'high',
          issue: '缺少量化数据',
          suggestion: '添加具体的数据指标，如"提升销售额25%"',
          examples: [
            '管理团队 → 管理15人团队，提升团队效率30%',
            '负责项目 → 负责3个重点项目，总预算500万元'
          ]
        },
        {
          category: '技能关键词',
          severity: 'medium',
          issue: 'JD匹配度较低',
          suggestion: '根据岗位要求补充相关技能关键词',
          keywords: selectedJob ? selectedJob.requirements : ['Python', '数据分析', '机器学习', '项目管理']
        },
        {
          category: '格式优化',
          severity: 'low',
          issue: '排版不够专业',
          suggestion: '使用更专业的模板和排版风格'
        }
      ],
      starOptimization: {
        before: '负责公司产品的开发工作',
        after: {
          situation: '面对用户增长放缓的挑战',
          task: '负责核心产品功能优化',
          action: '组建跨部门团队，制定用户体验提升方案',
          result: '用户活跃度提升35%，用户满意度达到4.8分'
        }
      },
      matchingJobs: [
        selectedJob ? { title: selectedJob.title, company: selectedJob.company, matchRate: selectedJob.matchScore } : { title: '高级产品经理', company: '腾讯', matchRate: 92 },
        { title: '产品总监', company: '字节跳动', matchRate: 88 },
        { title: '产品专家', company: '阿里巴巴', matchRate: 85 }
      ]
    });
    
    // 保存优化结果到工作流程
    setOptimizedResume({
      originalFile: uploadedFile,
      targetJob: selectedJob,
      analysisResult: analysisResult,
      optimizedAt: new Date()
    });
    
    setIsProcessing(false);
  };

  const handleGoToCareerPlanning = () => {
    setCurrentStep(4);
    navigate('/career-planning');
  };
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
        <WorkflowProgress />
        
        {/* Header */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">AI简历精修服务</h1>
              <p className="text-xl text-gray-300">
                {selectedJob ? `针对「${selectedJob.title}」岗位优化简历` : '上传简历文件，AI将基于STAR法则重写工作经历'}
              </p>
            </div>
            {selectedJob && (
              <div className="text-right">
                <p className="text-gray-400 text-sm">目标岗位</p>
                <p className="text-white font-semibold">{selectedJob.title}</p>
                <p className="text-gray-300 text-sm">{selectedJob.company}</p>
                <div className="mt-2">
                  <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-full">
                    匹配度 {selectedJob.matchScore}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Job Description Auto-filled Notice */}
        {selectedJob && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-2xl p-4 mb-8">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-blue-400 mr-3" />
              <p className="text-blue-300">
                已基于您选择的岗位自动填充职位描述，您可以在下方进行修改
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">
                {assessmentData.resume ? '更新简历文件' : '上传简历文件'}
              </h2>
              
              {assessmentData.resume && (
                <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-green-400 mr-2" />
                    <span className="text-green-300">已从测评中获取简历：{assessmentData.resume.name}</span>
                  </div>
                </div>
              )}
              
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-900/20' 
                    : uploadedFile 
                      ? 'border-green-500 bg-green-900/20' 
                      : 'border-gray-600 hover:border-gray-500'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {uploadedFile ? (
                  <div className="space-y-3">
                    <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                    <div>
                      <p className="font-semibold text-white">{uploadedFile.name}</p>
                      <p className="text-sm text-gray-400">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => setUploadedFile(null)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      重新选择文件
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 text-gray-500 mx-auto" />
                    <div>
                      <p className="text-lg font-medium text-white">
                        拖拽文件到此处，或点击选择
                      </p>
                      <p className="text-gray-400">支持 PDF、DOCX 格式，文件大小不超过10MB</p>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors cursor-pointer"
                      >
                        选择文件
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-300">智能解析说明</p>
                    <p className="text-sm text-blue-200 mt-1">
                      我们的AI引擎将以≥95%的准确率解析您的简历内容，自动提取个人信息、工作经历、技能等关键信息
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Job Description */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">
                目标岗位描述 {selectedJob ? '(已自动填充)' : '(可选)'}
              </h2>
              <p className="text-gray-300 mb-4">
                {selectedJob ? '基于您选择的岗位自动填充，您也可以手动修改' : '粘贴目标岗位的JD，AI将提取关键词并针对性优化您的简历'}
              </p>
              
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="请粘贴目标岗位的职位描述..."
                rows={8}
                className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-white placeholder-gray-400"
              />
              
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  {jobDescription.length}/2000 字符
                </p>
                {jobDescription && (
                  <div className="flex items-center text-green-400">
                    <Target className="h-4 w-4 mr-1" />
                    <span className="text-sm">JD已识别，将进行针对性优化</span>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis Button */}
            <div className="text-center">
              <button
                onClick={handleAnalyze}
                disabled={(!uploadedFile && !assessmentData.resume) || isProcessing}
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-lg rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-3"></div>
                    AI分析中...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    开始AI分析优化
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">选择简历模板</h2>
              
              <div className="space-y-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                      selectedTemplate === template.id
                        ? 'border-purple-500 bg-purple-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-white">{template.name}</h3>
                      {selectedTemplate === template.id && (
                        <CheckCircle className="h-5 w-5 text-purple-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{template.description}</p>
                    <div className={`h-2 rounded-full bg-gradient-to-r ${template.color}`}></div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
                <p className="text-sm text-purple-300">
                  <Award className="h-4 w-4 inline mr-1" />
                  提供15+行业适配模板，支持自定义格式
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4">服务特色</h2>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-900/30 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">STAR法则重写</h3>
                    <p className="text-sm text-gray-400">情境-任务-行动-结果，让经历更有说服力</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-900/30 rounded-lg">
                    <Target className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">关键词优化</h3>
                    <p className="text-sm text-gray-400">基于JD提取关键词，提升ATS通过率</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-900/30 rounded-lg">
                    <Star className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">竞争力评分</h3>
                    <p className="text-sm text-gray-400">多维度分析，给出具体改进建议</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        {analysisResult && (
          <div className="mt-8 space-y-6">
            {/* Competitive Score */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">竞争力分析报告</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-2 ${getScoreColor(analysisResult.competitiveScore)}`}>
                    {analysisResult.competitiveScore}
                  </div>
                  <p className="text-gray-400">综合竞争力评分</p>
                  <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${analysisResult.competitiveScore}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {analysisResult.improvements.length}
                  </div>
                  <p className="text-gray-400">待改进项目</p>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-600 mb-2">
                    {analysisResult.matchingJobs.length}
                  </div>
                  <p className="text-gray-400">匹配岗位</p>
                </div>
              </div>
            </div>

            {/* Improvements */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">改进建议</h2>
              
              <div className="space-y-6">
                {analysisResult.improvements.map((improvement: any, index: number) => (
                  <div key={index} className={`border rounded-lg p-4 bg-gray-700/30 ${
                    improvement.severity === 'high' ? 'border-red-500' :
                    improvement.severity === 'medium' ? 'border-yellow-500' :
                    'border-blue-500'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg text-white">{improvement.category}</h3>
                        <p className="text-sm text-gray-400">{improvement.issue}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        improvement.severity === 'high' ? 'bg-red-900/30 text-red-400' :
                        improvement.severity === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-blue-900/30 text-blue-400'
                      }`}>
                        {improvement.severity === 'high' ? '高优先级' :
                         improvement.severity === 'medium' ? '中优先级' : '低优先级'}
                      </span>
                    </div>
                    
                    <p className="mb-3 font-medium text-gray-300">建议：{improvement.suggestion}</p>
                    
                    {improvement.examples && (
                      <div className="space-y-2">
                        <p className="font-medium text-white">优化示例：</p>
                        {improvement.examples.map((example: string, exIndex: number) => (
                          <p key={exIndex} className="text-sm bg-gray-600/30 p-2 rounded text-gray-300">
                            {example}
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {improvement.keywords && (
                      <div className="mt-3">
                        <p className="font-medium mb-2 text-white">建议添加的关键词：</p>
                        <div className="flex flex-wrap gap-2">
                          {improvement.keywords.map((keyword: string, kIndex: number) => (
                            <span key={kIndex} className="px-2 py-1 bg-gray-600 text-gray-200 rounded-full text-xs font-medium">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback and Revision Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">简历反馈与修改</h2>
              
              <div className="space-y-6">
                {/* Text Feedback */}
                <div>
                  <h3 className="font-semibold text-white mb-3">文字反馈</h3>
                  <textarea
                    placeholder="请输入您对简历优化结果的反馈意见，我们将根据您的建议进行调整..."
                    rows={4}
                    className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-white placeholder-gray-400"
                  />
                </div>
                
                {/* Voice Feedback */}
                <div>
                  <h3 className="font-semibold text-white mb-3">语音反馈</h3>
                  <div className="flex items-center space-x-4">
                    <button className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors">
                      <div className="w-3 h-3 bg-white rounded-full mr-2 animate-pulse"></div>
                      开始录音
                    </button>
                    <button className="inline-flex items-center px-4 py-2 bg-gray-600 text-gray-300 font-medium rounded-lg hover:bg-gray-500 transition-colors">
                      停止录音
                    </button>
                    <span className="text-gray-400 text-sm">点击开始录音，说出您的反馈意见</span>
                  </div>
                  
                  {/* Voice Recording Status */}
                  <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                      <span className="text-blue-300 text-sm">准备录音中...</span>
                    </div>
                  </div>
                </div>
                
                {/* Revision Options */}
                <div>
                  <h3 className="font-semibold text-white mb-3">修改选项</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded" />
                        <span className="ml-2 text-gray-300">调整工作经历描述</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded" />
                        <span className="ml-2 text-gray-300">优化技能关键词</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded" />
                        <span className="ml-2 text-gray-300">调整简历格式</span>
                      </label>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded" />
                        <span className="ml-2 text-gray-300">修改个人简介</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded" />
                        <span className="ml-2 text-gray-300">调整教育背景</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 bg-gray-700 rounded" />
                        <span className="ml-2 text-gray-300">优化项目经历</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Submit Feedback */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400">
                    <p>💡 提示：详细的反馈有助于我们为您提供更精准的简历优化</p>
                  </div>
                  <button className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200">
                    提交反馈并重新优化
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </button>
                </div>
              </div>
            </div>

            {/* Download Section */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white text-center">
              <h2 className="text-2xl font-bold mb-4">下载优化后的简历</h2>
              <p className="mb-6 text-blue-100">
                AI已完成简历优化，您可以下载多个格式的简历文件
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="inline-flex items-center px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-colors">
                  <Download className="h-5 w-5 mr-2" />
                  下载PDF版本
                </button>
                <button className="inline-flex items-center px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors">
                  <Download className="h-5 w-5 mr-2" />
                  下载Word版本
                </button>
                <button 
                  onClick={handleGoToCareerPlanning}
                  className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-500 transition-colors"
                >
                  制定职业规划
                  <ArrowRight className="h-5 w-5 ml-2" />
                </button>
                <button 
                  onClick={() => navigate('/interview')}
                  className="inline-flex items-center px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-500 transition-colors"
                >
                  开始AI面试
                  <ArrowRight className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeEnhancement;