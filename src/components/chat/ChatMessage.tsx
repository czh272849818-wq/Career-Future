import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Clock } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'analysis';
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isAI = message.sender === 'ai';

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
      <div className={`flex-1 max-w-xs sm:max-w-md lg:max-w-2xl ${isAI ? '' : 'flex justify-end'}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isAI 
            ? 'bg-gray-800 border border-gray-700' 
            : 'bg-gradient-to-r from-purple-600 to-blue-600'
        }`}>
          <div className={`prose prose-invert max-w-none text-sm leading-relaxed ${
            isAI ? 'prose-gray text-gray-300' : 'prose-white text-white'
          }`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="mt-4 mb-2 text-xl font-semibold text-white first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="mt-4 mb-2 text-lg font-semibold text-white first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold text-white first:mt-0">{children}</h3>,
                ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
                li: ({ children }) => <li className="leading-6">{children}</li>,
                table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
                thead: ({ children }) => <thead className="bg-gray-700 text-white">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-gray-700">{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-gray-700">{children}</tr>,
                th: ({ children }) => <th className="border border-gray-700 px-3 py-2 font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-gray-700 px-3 py-2 align-top">{children}</td>,
                code: ({ inline, children }) => inline ? (
                  <code className="rounded bg-gray-900 px-1.5 py-0.5 text-[0.85em] text-emerald-300">{children}</code>
                ) : (
                  <code className="block whitespace-pre-wrap rounded-xl bg-gray-950 px-4 py-3 text-xs text-gray-200">{children}</code>
                ),
                pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-xl bg-gray-950 p-0">{children}</pre>,
                blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-purple-500 pl-4 text-gray-300">{children}</blockquote>
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {!isAI && message.attachments?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.attachments.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90"
                >
                  <span className="max-w-40 truncate">{file.name}</span>
                  <span className="text-white/50">·</span>
                  <span>{file.type || 'unknown'}</span>
                </div>
              ))}
            </div>
          ) : null}
          
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
