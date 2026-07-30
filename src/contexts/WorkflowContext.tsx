import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiUrl, authHeaders } from '../api';

export type CareerReadiness = 'ready_now' | 'build_evidence' | 'explore';

export interface CareerProfile {
  generatedAt: string;
  version: number;
  headline: string;
  summary: string;
  primaryDirection: {
    role: string;
    industry?: string;
    readiness: CareerReadiness;
    rationale: string;
  };
  alternatives: Array<{
    role: string;
    rationale: string;
  }>;
  evidence: Array<{
    claim: string;
    source: string;
  }>;
  gaps: string[];
  actionPlan: Array<{
    title: string;
    detail: string;
    destination: 'jobs' | 'resume' | 'interview';
  }>;
}

export interface AssessmentData {
  answers: { [questionId: string]: string };
  resume?: File;
  resumeText?: string;
  values?: string;
  personality?: string;
  major?: string;
  completedAt?: Date;
  aiAnalysis?: string;
  scores?: { [key: string]: number };
  traits?: string[];
  recommendations?: string[];
  industry?: string;
  targetPosition?: string;
  careerProfile?: CareerProfile;
  careerReports?: CareerProfile[];
  jobBrief?: JobBrief;
}

export interface JobBrief {
  industry: string;
  role: string;
  city: string;
  experienceLevel: string;
  salaryFloor: string;
  workMode: string;
  updatedAt: string;
}

export interface JobRecommendation {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  industry?: string;
  evidence?: string[];
  gaps?: string[];
  city?: string;
  experienceLevel?: string;
  workMode?: string;
  source?: 'strategy' | 'real_jd';
  jdText?: string;
}

export interface InterviewReportRecord {
  id: string;
  type: string | null;
  isMultiRound: boolean;
  rounds: number;
  completedAt: string;
  completedStages: string[];
  evidenceUsed: string[];
  missingEvidence: string[];
  feedback: string[];
  improvements: string[];
  answerRecords: string[];
  targetJob?: { title: string; industry?: string } | null;
}

interface WorkflowContextType {
  currentStep: number;
  assessmentData: AssessmentData;
  recommendedJobs: JobRecommendation[];
  selectedJob: JobRecommendation | null;
  optimizedResume: any;
  careerPlan: any;
  interviewReports: InterviewReportRecord[];
  reloadWorkflowState: () => Promise<void>;
  
  // Actions
  setCurrentStep: (step: number) => void;
  updateAssessmentData: (data: Partial<AssessmentData>) => void;
  setRecommendedJobs: (jobs: JobRecommendation[]) => void;
  selectJob: (job: JobRecommendation) => void;
  setOptimizedResume: (resume: any) => void;
  setCareerPlan: (plan: any) => void;
  saveInterviewReport: (report: InterviewReportRecord) => void;
  resetWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isReady: isAuthReady } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    answers: {}
  });
  const [recommendedJobs, setRecommendedJobsState] = useState<JobRecommendation[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobRecommendation | null>(null);
  const [optimizedResumeState, setOptimizedResumeState] = useState<any>(null);
  const [careerPlanState, setCareerPlanState] = useState<any>(null);
  const [interviewReports, setInterviewReports] = useState<InterviewReportRecord[]>([]);
  const userId = user?.id || null;

  const loadRemoteWorkflowState = useCallback(async (remoteUserId: string) => {
    const resp = await fetch(apiUrl(`/api/users/${encodeURIComponent(remoteUserId)}/data`), {
      headers: authHeaders()
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    return data?.data || null;
  }, []);

  const persistWorkflowState = useCallback(async (patch: Record<string, any>) => {
    if (!userId || !isAuthenticated) return;
    await fetch(apiUrl(`/api/users/${encodeURIComponent(userId)}/data`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch)
    });
  }, [isAuthenticated, userId]);

  const reloadWorkflowState = useCallback(async () => {
    if (!isAuthReady || !userId) return;
    const remote = await loadRemoteWorkflowState(userId).catch(() => null);
    if (!remote) return;
    setAssessmentData(prev => ({
      ...prev,
      ...(remote.assessmentData || {})
    }));
    setRecommendedJobsState(remote.recommendedJobs || []);
    setSelectedJob(remote.selectedJob || null);
    setOptimizedResumeState(remote.optimizedResume || null);
    setCareerPlanState(remote.careerPlan || null);
    setInterviewReports(Array.isArray(remote.interviewReports) ? remote.interviewReports : []);
  }, [isAuthReady, loadRemoteWorkflowState, userId]);

  const updateAssessmentData = useCallback((data: Partial<AssessmentData>) => {
    setAssessmentData(prev => {
      const next = { ...prev, ...data };
      void persistWorkflowState({ assessmentData: next });
      return next;
    });
  }, [persistWorkflowState]);

  const setRecommendedJobs = useCallback((jobs: JobRecommendation[]) => {
    setRecommendedJobsState(jobs);
    void persistWorkflowState({ recommendedJobs: jobs });
  }, [persistWorkflowState]);

  const selectJob = useCallback((job: JobRecommendation) => {
    setSelectedJob(job);
    void persistWorkflowState({ selectedJob: job });
  }, [persistWorkflowState]);

  const setOptimizedResume = useCallback((resume: any) => {
    setOptimizedResumeState(resume);
    void persistWorkflowState({ optimizedResume: resume });
  }, [persistWorkflowState]);

  const setCareerPlan = useCallback((plan: any) => {
    setCareerPlanState(plan);
    void persistWorkflowState({ careerPlan: plan });
  }, [persistWorkflowState]);

  const saveInterviewReport = useCallback((report: InterviewReportRecord) => {
    setInterviewReports(previous => {
      const next = [report, ...previous.filter(item => item.id !== report.id)].slice(0, 10);
      void persistWorkflowState({ interviewReports: next });
      return next;
    });
  }, [persistWorkflowState]);

  const resetWorkflow = useCallback(() => {
    setCurrentStep(1);
    setAssessmentData({ answers: {} });
    setRecommendedJobsState([]);
    setSelectedJob(null);
    setOptimizedResumeState(null);
    setCareerPlanState(null);
    setInterviewReports([]);
    void persistWorkflowState({
      assessmentData: { answers: {} },
      recommendedJobs: [],
      selectedJob: null,
      optimizedResume: null,
      careerPlan: null,
      interviewReports: []
    });
  }, [persistWorkflowState]);

  useEffect(() => {
    if (!isAuthReady || !userId) return;
    void reloadWorkflowState();
  }, [isAuthReady, reloadWorkflowState, userId]);

  const workflowValue = useMemo(() => ({
    currentStep,
    assessmentData,
    recommendedJobs,
    selectedJob,
    optimizedResume: optimizedResumeState,
    careerPlan: careerPlanState,
    interviewReports,
    reloadWorkflowState,
    setCurrentStep,
    updateAssessmentData,
    setRecommendedJobs,
    selectJob,
    setOptimizedResume,
    setCareerPlan,
    saveInterviewReport,
    resetWorkflow
  }), [
    currentStep,
    assessmentData,
    recommendedJobs,
    selectedJob,
    optimizedResumeState,
    careerPlanState,
    interviewReports,
    reloadWorkflowState,
    setCurrentStep,
    updateAssessmentData,
    setRecommendedJobs,
    selectJob,
    setOptimizedResume,
    setCareerPlan,
    saveInterviewReport,
    resetWorkflow
  ]);

  return (
    <WorkflowContext.Provider value={workflowValue}>
      {children}
    </WorkflowContext.Provider>
  );
}

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
};
