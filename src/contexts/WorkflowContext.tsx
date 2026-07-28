import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiUrl, authHeaders } from '../api';

interface AssessmentData {
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
}

interface JobRecommendation {
  id: string;
  title: string;
  company: string;
  matchScore: number;
  description: string;
  requirements: string[];
  salary: string;
  location: string;
  industry?: string;
  reason?: string;
  isNew?: boolean;
  isUrgent?: boolean;
}

interface WorkflowContextType {
  currentStep: number;
  assessmentData: AssessmentData;
  recommendedJobs: JobRecommendation[];
  selectedJob: JobRecommendation | null;
  optimizedResume: any;
  careerPlan: any;
  reloadWorkflowState: () => Promise<void>;
  
  // Actions
  setCurrentStep: (step: number) => void;
  updateAssessmentData: (data: Partial<AssessmentData>) => void;
  setRecommendedJobs: (jobs: JobRecommendation[]) => void;
  selectJob: (job: JobRecommendation) => void;
  setOptimizedResume: (resume: any) => void;
  setCareerPlan: (plan: any) => void;
  resetWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isReady: isAuthReady } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    answers: {}
  });
  const [recommendedJobs, setRecommendedJobs] = useState<JobRecommendation[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobRecommendation | null>(null);
  const [optimizedResumeState, setOptimizedResumeState] = useState<any>(null);
  const [careerPlanState, setCareerPlanState] = useState<any>(null);
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
    setSelectedJob(remote.selectedJob || null);
    setOptimizedResumeState(remote.optimizedResume || null);
    setCareerPlanState(remote.careerPlan || null);
  }, [isAuthReady, loadRemoteWorkflowState, userId]);

  const updateAssessmentData = useCallback((data: Partial<AssessmentData>) => {
    setAssessmentData(prev => {
      const next = { ...prev, ...data };
      void persistWorkflowState({ assessmentData: next });
      return next;
    });
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

  const resetWorkflow = useCallback(() => {
    setCurrentStep(1);
    setAssessmentData({ answers: {} });
    setRecommendedJobs([]);
    setSelectedJob(null);
    setOptimizedResumeState(null);
    setCareerPlanState(null);
    void persistWorkflowState({
      assessmentData: { answers: {} },
      selectedJob: null,
      optimizedResume: null,
      careerPlan: null
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
    reloadWorkflowState,
    setCurrentStep,
    updateAssessmentData,
    setRecommendedJobs,
    selectJob,
    setOptimizedResume,
    setCareerPlan,
    resetWorkflow
  }), [
    currentStep,
    assessmentData,
    recommendedJobs,
    selectedJob,
    optimizedResumeState,
    careerPlanState,
    reloadWorkflowState,
    setCurrentStep,
    updateAssessmentData,
    setRecommendedJobs,
    selectJob,
    setOptimizedResume,
    setCareerPlan,
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
