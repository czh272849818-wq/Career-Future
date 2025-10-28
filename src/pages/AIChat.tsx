import React, { useEffect, useRef } from 'react';
import { Bot, Sparkles, TrendingUp, Target, BookOpen } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';
import BackButton from '../components/ui/BackButton';

const AIChat = () => {
  const {
    currentSession,
    sessions,
    isTyping,
    createNewSession,
    switchSession,
    sendMessage,
    clearCurrentSession,
    deleteSession,
    // settings
    model,
    temperature,
    streamEnabled,
    setModel,
    setTemperature,
    setStreamEnabled
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isTyping]);

  const aiCapabilities = [
    {
      icon: <TrendingUp className="h-5 w-5" />,
      title: '职业发展分析',
      description: '基于行业趋势和个人背景，提供专业的职业发展建议'
    },
    {
      icon: <Target className="h-5 w-5" />,
      title: '目标规划制定',
      description: '帮助制定短期和长期的职业目标，规划实现路径'
    },
    {
      icon: <BookOpen className="h-5 w-5" />,
      title: '技能提升指导',
      description: '推荐相关课程和学习资源，提升核心竞争力'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <BackButton />
        </div>
        <div className="flex gap-6">
          {/* Sidebar */}
          <ChatSidebar
            sessions={sessions}
            currentSessionId={currentSession?.id || null}
            onNewSession={createNewSession}
            onSwitchSession={switchSession}
            onDeleteSession={deleteSession}
          />

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">AI职业规划师</h1>
                <p className="text-sm text-gray-400">
                  {isTyping ? '正在输入...' : '在线 - 随时为您提供专业建议'}
                </p>
              </div>
            </div>
            
            {/* Settings Controls */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                <label className="text-xs text-gray-400">模型</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-gray-700 text-white text-sm rounded-md px-2 py-1 focus:outline-none border border-gray-600"
                >
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                <label className="text-xs text-gray-400">温度</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-28"
                />
                <span className="text-xs text-gray-300 w-8 text-right">{temperature.toFixed(1)}</span>
              </div>

              <div className="flex items-center space-x-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                <label className="text-xs text-gray-400">流式</label>
                <input
                  type="checkbox"
                  checked={streamEnabled}
                  onChange={(e) => setStreamEnabled(e.target.checked)}
                />
              </div>

              <button
                onClick={clearCurrentSession}
                className="px-3 py-1 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:border-gray-500 transition-colors"
              >
                清空对话
              </button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {currentSession ? (
            <div className="p-4 space-y-6">
              {currentSession.messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">AI职业规划师</h2>
                <p className="text-gray-400 mb-8">
                  开始新的对话，让AI为您提供专业的职业发展建议
                </p>
                
                <div className="space-y-4">
                  {aiCapabilities.map((capability, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="text-purple-400">
                        {capability.icon}
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium text-white">{capability.title}</h3>
                        <p className="text-sm text-gray-400">{capability.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={createNewSession}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
                >
                  开始对话
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        {currentSession && (
          <ChatInput
            onSendMessage={sendMessage}
            disabled={isTyping}
            placeholder="请输入您的职业问题..."
          />
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;