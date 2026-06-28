import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { apiUrl } from '../api';

import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE, DEFAULT_STREAM } from '../llm/config';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'analysis';
}

interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  text?: string;
  dataUrl?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatContextType {
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  isTyping: boolean;
  createNewSession: () => void;
  switchSession: (sessionId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  sendMessageWithAttachments: (content: string, attachments: ChatAttachment[]) => Promise<void>;
  clearCurrentSession: () => void;
  deleteSession: (sessionId: string) => void;
  // settings
  model: string;
  temperature: number;
  streamEnabled: boolean;
  setModel: (m: string) => void;
  setTemperature: (t: number) => void;
  setStreamEnabled: (s: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // unique id generator
  const uid = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const [model, setModel] = useState<string>(DEFAULT_LLM_MODEL);
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const [streamEnabled, setStreamEnabled] = useState<boolean>(DEFAULT_STREAM);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uid(),
      title: `对话 ${sessions.length + 1}`,
      messages: [
        {
          id: 'welcome',
          content: '您好！我是您的AI职业规划师 🤖\n\n我可以帮助您：\n• 分析职业发展方向\n• 制定学习计划\n• 解答求职疑问\n• 提供行业洞察\n\n请告诉我您想了解什么？',
          sender: 'ai',
          timestamp: new Date(),
          type: 'text'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession);
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
    }
  };

  const sendMessageWithAttachments = async (content: string, attachments: ChatAttachment[]) => {
    const attachmentSummary = attachments.length
      ? attachments.map(item => `- ${item.name} (${item.type || 'unknown'}, ${(item.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')
      : '';
    const attachmentText = attachments
      .map(item => item.text || '')
      .filter(Boolean)
      .join('\n\n');
    const mergedContent = [content.trim(), attachmentSummary ? `附件:\n${attachmentSummary}` : '', attachmentText ? `附件内容:\n${attachmentText}` : '']
      .filter(Boolean)
      .join('\n\n');
    await sendMessage(mergedContent);
  };

  const sendMessage = async (content: string) => {
    if (!currentSession || !content.trim()) return;

    const userMessage: Message = {
      id: uid(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    const updatedSession = {
      ...currentSession,
      messages: [...currentSession.messages, userMessage],
      updatedAt: new Date()
    };

    setCurrentSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === currentSession.id ? updatedSession : s));
    setIsTyping(true);

    try {
      // 限制上下文长度，去除欢迎消息以减少首字节延迟
      const MAX_CONTEXT_MESSAGES = 8;
      const conversation = updatedSession.messages
        .filter(m => m.id !== 'welcome')
        .slice(-MAX_CONTEXT_MESSAGES);
      const apiMessages = [
        { role: 'system', content: '你是一位专业的中文职业规划顾问，请用清晰、结构化的方式回答。如果用户提供了附件，请结合附件中的内容作答，并指出你使用了哪些文件信息。' },
        ...conversation.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ];

      if (streamEnabled) {
        try {
          // create placeholder AI message for streaming updates
          const placeholder: Message = {
            id: uid(),
            content: '',
            sender: 'ai',
            timestamp: new Date(),
            type: 'text'
          };
          let streamingSession = {
            ...updatedSession,
            messages: [...updatedSession.messages, placeholder],
            updatedAt: new Date()
          };
          setCurrentSession(streamingSession);
          setSessions(prev => prev.map(s => s.id === currentSession.id ? streamingSession : s));

          const resp = await fetch(apiUrl('/api/deepseek/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: apiMessages, model, temperature, stream: true })
          });

          if (!resp.ok || !resp.body) {
            const text = await resp.text();
            throw new Error(`DeepSeek API stream error: ${text}`);
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let accumulated = '';
          let stoppedTyping = false;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
              const line = part.split('\n').find(l => l.startsWith('data:'));
              if (!line) continue;
              const dataStr = line.slice(5).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const json = JSON.parse(dataStr);
                const delta = json?.choices?.[0]?.delta?.content || json?.choices?.[0]?.message?.content || '';
                if (delta) {
                  accumulated += delta;
                  // first token received: remove typing indicator
                  if (!stoppedTyping) {
                    setIsTyping(false);
                    stoppedTyping = true;
                  }
                  // update last AI message content
                  streamingSession = {
                    ...streamingSession,
                    messages: streamingSession.messages.map((m, idx) =>
                      idx === streamingSession.messages.length - 1
                        ? { ...m, content: accumulated }
                        : m
                    ),
                    updatedAt: new Date()
                  };
                  setCurrentSession(streamingSession);
                  setSessions(prev => prev.map(s => s.id === currentSession.id ? streamingSession : s));
                }
              } catch {
                // ignore non-JSON lines
              }
            }
          }
          // ensure typing indicator off after stream completes
          setIsTyping(false);
          return;
        } catch (e: any) {
          const msg = String(e?.message || e);
          const lower = msg.toLowerCase();
          if (
            lower.includes('err_network_io_suspended') ||
            lower.includes('failed to fetch') ||
            lower.includes('edge function timed out') ||
            lower.includes('deepseek api stream error')
          ) {
            console.warn('[DeepSeek] streaming suspended/aborted, retrying without stream...');
            setStreamEnabled(false);
            const resp = await fetch(apiUrl('/api/deepseek/chat'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: apiMessages, model, temperature, stream: false })
            });
            if (!resp.ok) {
              const text = await resp.text();
              throw new Error(`DeepSeek API error: ${text}`);
            }
            const data = await resp.json();
            const aiContent = data?.choices?.[0]?.message?.content || '抱歉，暂时无法获取回复。请稍后重试。';
            const aiMessage: Message = {
              id: uid(),
              content: aiContent,
              sender: 'ai',
              timestamp: new Date(),
              type: 'text'
            };
            const finalSession = {
              ...updatedSession,
              messages: [...updatedSession.messages, aiMessage],
              updatedAt: new Date()
            };
            setIsTyping(false);
            setCurrentSession(finalSession);
            setSessions(prev => prev.map(s => s.id === currentSession.id ? finalSession : s));
            return;
          } else {
            throw e;
          }
        }
      }

      // non-streaming path
      const resp = await fetch(apiUrl('/api/deepseek/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, model, temperature, stream: false })
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`DeepSeek API error: ${text}`);
      }

      const data = await resp.json();
      const aiContent = data?.choices?.[0]?.message?.content || '抱歉，暂时无法获取回复。请稍后重试。';

      const aiMessage: Message = {
        id: uid(),
        content: aiContent,
        sender: 'ai',
        timestamp: new Date(),
        type: 'text'
      };

      const finalSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, aiMessage],
        updatedAt: new Date()
      };

      setIsTyping(false);
      setCurrentSession(finalSession);
      setSessions(prev => prev.map(s => s.id === currentSession.id ? finalSession : s));
    } catch (err) {
      console.error('DeepSeek 调用失败:', err);
      const aiMessage: Message = {
        id: uid(),
        content: '抱歉，AI服务暂时不可用，请稍后再试。',
        sender: 'ai',
        timestamp: new Date(),
        type: 'text'
      };
      const finalSession = {
        ...updatedSession,
        messages: [...updatedSession.messages, aiMessage],
        updatedAt: new Date()
      };
      setIsTyping(false);
      setCurrentSession(finalSession);
      setSessions(prev => prev.map(s => s.id === currentSession.id ? finalSession : s));
    }
  };

  const clearCurrentSession = () => {
    if (currentSession) {
      const clearedSession = {
        ...currentSession,
        messages: [currentSession.messages[0]],
        updatedAt: new Date()
      };
      setCurrentSession(clearedSession);
      setSessions(prev => prev.map(s => s.id === currentSession.id ? clearedSession : s));
    }
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
    }
  };

  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  return (
    <ChatContext.Provider value={{
      currentSession,
      sessions,
      isTyping,
      createNewSession,
      switchSession,
      sendMessage,
      sendMessageWithAttachments,
      clearCurrentSession,
      deleteSession,
      model,
      temperature,
      streamEnabled,
      setModel,
      setTemperature,
      setStreamEnabled
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
