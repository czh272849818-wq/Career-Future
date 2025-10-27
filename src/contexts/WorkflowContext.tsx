import React, { createContext, useContext, useState } from 'react';

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
}

interface WorkflowContextType {
  currentStep: number;
  assessmentData: AssessmentData;
  recommendedJobs: JobRecommendation[];
  selectedJob: JobRecommendation | null;
  optimizedResume: any;
  careerPlan: any;
  
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
  const [currentStep, setCurrentStep] = useState(1);
  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    answers: {}
  });
  const [recommendedJobs, setRecommendedJobs] = useState<JobRecommendation[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobRecommendation | null>(null);
  const [optimizedResume, setOptimizedResume] = useState(null);
  const [careerPlan, setCareerPlan] = useState(null);

  const updateAssessmentData = (data: Partial<AssessmentData>) => {
    setAssessmentData(prev => ({ ...prev, ...data }));
  };

  const selectJob = (job: JobRecommendation) => {
    setSelectedJob(job);
  };

  const resetWorkflow = () => {
    setCurrentStep(1);
    setAssessmentData({ answers: {} });
    setRecommendedJobs([]);
    setSelectedJob(null);
    setOptimizedResume(null);
    setCareerPlan(null);
  };

  return (
    <WorkflowContext.Provider value={{
      currentStep,
      assessmentData,
      recommendedJobs,
      selectedJob,
      optimizedResume,
      careerPlan,
      setCurrentStep,
      updateAssessmentData,
      setRecommendedJobs,
      selectJob,
      setOptimizedResume,
      setCareerPlan,
      resetWorkflow
    }}>
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