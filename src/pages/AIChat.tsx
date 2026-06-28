import React, { useEffect, useRef } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { apiUrl } from '../api';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ChatSidebar from '../components/chat/ChatSidebar';

const AIChat = () => {
  const {
    currentSession,
    sessions,
    isTyping,
    createNewSession,
    switchSession,
    sendMessageWithAttachments,
    deleteSession
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const handleSendMessage = async (
    message: string,
    attachments: Array<{ file: File; name: string; type: string; size: number }>
  ) => {
    const EXTRACT_LIMIT = 12 * 1024 * 1024;
    const parsed = await Promise.allSettled(attachments.map(async (item) => {
      const lowerName = item.name.toLowerCase();
      const isVideo = item.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(lowerName);
      const isTooLarge = item.size > EXTRACT_LIMIT;

      if (isVideo || isTooLarge) {
        const note = isVideo
          ? '视频附件当前仅记录文件信息，不做逐帧解析。'
          : '文件较大，已跳过内容提取以避免卡顿。';
        return {
          ...item,
          text: `[附件] ${item.name}（${formatFileSize(item.size)}）${note}`
        };
      }

      const dataBase64 = await fileToBase64(item.file);
      const resp = await fetch(apiUrl('/api/extract-text'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: item.name,
          mimeType: item.type,
          dataBase64
        })
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || '附件解析失败');
      }
      const data = await resp.json().catch(() => ({}));
      return { ...item, text: data.text || '' };
    }));

    const resolvedAttachments = parsed
      .map((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        return {
          ...attachments[index],
          text: ''
        };
      });

    await sendMessageWithAttachments(message || '请结合附件内容给出分析。', resolvedAttachments as any);
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isTyping]);

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-gray-950 px-3 py-3 sm:px-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <div className="flex min-h-0 flex-1 gap-4">
          <ChatSidebar
            sessions={sessions}
            currentSessionId={currentSession?.id || null}
            onNewSession={createNewSession}
            onSwitchSession={switchSession}
            onDeleteSession={deleteSession}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/70">
            <div className="shrink-0 border-b border-gray-800 bg-gray-900/80 px-5 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-medium text-white">AI 职业规划师</h1>
                  <p className="truncate text-sm text-gray-400">
                    {isTyping ? '正在输入...' : '像 ChatGPT 一样开始对话'}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {currentSession ? (
                <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5">
                  {currentSession.messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}

                  {isTyping && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3">
                        <div className="flex space-x-1">
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '0.1s' }} />
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-8">
                  <div className="max-w-md text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600">
                      <Sparkles className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="mb-3 text-2xl font-semibold text-white">AI 职业规划师</h2>
                    <p className="text-gray-400">开始新的对话。</p>
                    <button
                      onClick={createNewSession}
                      className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200"
                    >
                      新建对话
                    </button>
                  </div>
                </div>
              )}
            </div>

            {currentSession && (
              <div className="shrink-0 border-t border-gray-800 bg-gray-900/80">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={isTyping}
                  placeholder="给 AI 发消息"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
