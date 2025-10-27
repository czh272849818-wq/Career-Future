import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AssessmentProvider } from './contexts/AssessmentContext';
import { WorkflowProvider } from './contexts/WorkflowContext';
import { ChatProvider } from './contexts/ChatContext';
import Navbar from './components/layout/Navbar';
import Homepage from './pages/Homepage';
import Assessment from './pages/Assessment';
import ResumeEnhancement from './pages/ResumeEnhancement';
import InterviewSimulation from './pages/InterviewSimulation';
import JobMatching from './pages/JobMatching';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import CareerPlanning from './pages/CareerPlanning';
import AIChat from './pages/AIChat';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <AssessmentProvider>
        <WorkflowProvider>
          <ChatProvider>
            <Router>
              <div className="min-h-screen bg-gray-900">
                <Navbar />
                <main className="pt-16">
                  <Routes>
                    <Route path="/" element={<Homepage />} />
                    <Route path="/assessment" element={<Assessment />} />
                    <Route path="/resume" element={<ResumeEnhancement />} />
                    <Route path="/interview" element={<InterviewSimulation />} />
                    <Route path="/jobs" element={<JobMatching />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/career-planning" element={<CareerPlanning />} />
                    <Route path="/ai-chat" element={<AIChat />} />
                  </Routes>
                </main>
              </div>
            </Router>
          </ChatProvider>
        </WorkflowProvider>
      </AssessmentProvider>
    </AuthProvider>
  );
}

export default App;