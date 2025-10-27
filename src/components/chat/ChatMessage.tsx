import React from 'react';
import { Bot, User, Clock } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'analysis';
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isAI = message.sender === 'ai';

  const formatContent = (content: string) => {
    // 处理换行
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // 处理粗体文本 **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = line.split(boldRegex);
      
      return (
        <div key={index} className={index > 0 ? 'mt-2' : ''}>
          {parts.map((part, partIndex) => {
            if (partIndex % 2 === 1) {
              return <strong key={partIndex} className="font-semibold text-white">{part}</strong>;
            }
            return part;
          })}
        </div>
      );
    });
  };

  return (
    <div className={`flex items-start space-x-3 ${isAI ? '' : 'flex-row-reverse space-x-reverse'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isAI 
          ? 'bg-gradient-to-r from-purple-600 to-blue-600' 
          : 'bg-gray-600'
      }`}>
        {isAI ? (
          <Bot className="h-4 w-4 text-white" />
        ) : (
          <User className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-xs sm:max-w-md lg:max-w-lg ${isAI ? '' : 'flex justify-end'}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isAI 
            ? 'bg-gray-800 border border-gray-700' 
            : 'bg-gradient-to-r from-purple-600 to-blue-600'
        }`}>
          <div className={`text-sm leading-relaxed ${
            isAI ? 'text-gray-300' : 'text-white'
          }`}>
            {formatContent(message.content)}
          </div>
          
          {/* Timestamp */}
          <div className={`flex items-center mt-2 text-xs ${
            isAI ? 'text-gray-500' : 'text-purple-100'
          }`}>
            <Clock className="h-3 w-3 mr-1" />
            <span>{message.timestamp.toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;