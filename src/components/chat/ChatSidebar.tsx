import React from 'react';
import { Plus, MessageSquare, Trash2, MoreHorizontal } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  sessions,
  currentSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession
}) => {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="w-80 bg-gray-800/50 backdrop-blur-sm border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          <span>新建对话</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative mb-2 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                currentSessionId === session.id
                  ? 'bg-purple-600/20 border border-purple-500/30'
                  : 'hover:bg-gray-700/50'
              }`}
              onClick={() => onSwitchSession(session.id)}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">
                    {session.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {session.messages.length > 1 
                      ? session.messages[session.messages.length - 1].content.slice(0, 50) + '...'
                      : '新对话'
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(session.updatedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      title="删除对话"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                      title="更多选项"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500 text-center">
          <p>AI职业规划师 v1.0</p>
          <p className="mt-1">为您提供专业的职业建议</p>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;