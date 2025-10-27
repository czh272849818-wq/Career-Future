import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';
import { useWorkflow } from '../../contexts/WorkflowContext';

const WorkflowProgress = () => {
  const { currentStep } = useWorkflow();

  const steps = [
    { id: 1, name: '职业测评', description: '了解你的能力和兴趣' },
    { id: 2, name: '岗位推荐', description: '匹配最适合的职位' },
    { id: 3, name: '简历优化', description: '针对性优化简历' },
    { id: 4, name: '职业规划', description: '制定发展路径' }
  ];

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
      <h2 className="text-xl font-bold text-white mb-6">职业发展流程</h2>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                currentStep > step.id 
                  ? 'bg-green-600 border-green-600' 
                  : currentStep === step.id
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-purple-600'
                    : 'border-gray-600 bg-gray-800'
              }`}>
                {currentStep > step.id ? (
                  <CheckCircle className="h-6 w-6 text-white" />
                ) : (
                  <span className="text-white font-semibold">{step.id}</span>
                )}
              </div>
              <div className="mt-3 text-center">
                <p className={`font-medium ${
                  currentStep >= step.id ? 'text-white' : 'text-gray-400'
                }`}>
                  {step.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${
                currentStep > step.id ? 'bg-green-600' : 'bg-gray-600'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowProgress;