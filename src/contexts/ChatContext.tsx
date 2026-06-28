import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiUrl } from '../api';

import { DEFAULT_LLM_MODEL, DEFAULT_TEMPERATURE, DEFAULT_STREAM } from '../llm/config';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'analysis';
  attachments?: ChatAttachment[];
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
  const { user, isReady: isAuthReady } = useAuth();
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const didHydrateRef = useRef(false);

  // unique id generator
  const uid = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const [model, setModel] = useState<string>(DEFAULT_LLM_MODEL);
  const [temperature, setTemperature] = useState<number>(DEFAULT_TEMPERATURE);
  const [streamEnabled, setStreamEnabled] = useState<boolean>(DEFAULT_STREAM);

  const userId = user?.id || null;
  const getLocalStorageKey = (id: string | null) => id ? `ai_chat_sessions_${id}` : 'ai_chat_sessions_guest';

  const sanitizeAttachment = (attachment: ChatAttachment) => {
    const { dataUrl, ...safe } = attachment || {};
    return safe;
  };

  const serializeSession = (session: ChatSession) => ({
    ...session,
    messages: Array.isArray(session.messages)
      ? session.messages.map((message) => ({
          ...message,
          attachments: Array.isArray(message.attachments) ? message.attachments.map(sanitizeAttachment) : undefined
        }))
      : []
  });

  const reviveSession = (session: any): ChatSession => ({
    ...session,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
    messages: Array.isArray(session.messages)
      ? session.messages.map((message: any) => ({
          ...message,
          timestamp: new Date(message.timestamp),
          attachments: Array.isArray(message.attachments) ? message.attachments.map(sanitizeAttachment) : message.attachments
        }))
      : []
  });

  const isBlankWelcomeSession = (session: ChatSession) => {
    return Array.isArray(session.messages)
      && session.messages.length === 1
      && session.messages[0]?.id === 'welcome'
      && String(session.messages[0]?.content || '').includes('AI职业规划师');
  };

  const normalizeSessions = (inputSessions: ChatSession[]) => {
    const sessionsWithDates = Array.isArray(inputSessions) ? inputSessions : [];
    const seenBlank = new Set<string>();
    return sessionsWithDates.filter((session) => {
      if (!isBlankWelcomeSession(session)) return true;
      const key = `${session.title || ''}::${String(session.messages[0]?.content || '')}`;
      if (seenBlank.has(key)) return false;
      seenBlank.add(key);
      return true;
    });
  };

  const readLocalSessions = (storageKey: string) => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const storedSessions = normalizeSessions(Array.isArray(parsed?.sessions) ? parsed.sessions.map(reviveSession) : []);
      const storedCurrentId = parsed?.currentSessionId || null;
      return {
        sessions: storedSessions,
        currentSessionId: storedCurrentId
      };
    } catch (error) {
      console.warn('[chat] failed to read local sessions:', error);
      return null;
    }
  };

  const saveLocalSessions = (storageKey: string, nextSessions: ChatSession[], nextCurrentSessionId: string | null) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        sessions: nextSessions.map(serializeSession),
        currentSessionId: nextCurrentSessionId
      }));
    } catch (error) {
      console.warn('[chat] failed to persist local sessions:', error);
    }
  };

  const loadRemoteSessions = async (remoteUserId: string) => {
    const resp = await fetch(apiUrl(`/api/chat-sessions?userId=${encodeURIComponent(remoteUserId)}`));
    if (!resp.ok) {
      if (resp.status !== 404) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || '加载聊天记录失败');
      }
      return null;
    }

    const data = await resp.json();
    const storedSessions = normalizeSessions(Array.isArray(data?.sessions) ? data.sessions.map(reviveSession) : []);
    return {
      sessions: storedSessions,
      currentSessionId: data?.currentSessionId || null
    };
  };

  const saveRemoteSessions = async (remoteUserId: string, nextSessions: ChatSession[], nextCurrentSessionId: string | null) => {
    const resp = await fetch(apiUrl('/api/chat-sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: remoteUserId,
        sessions: nextSessions.map(serializeSession),
        currentSessionId: nextCurrentSessionId
      })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || '保存聊天记录失败');
    }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uid(),
      title: '新对话',
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

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;
    const run = async () => {
      didHydrateRef.current = false;
      try {
        const guestKey = getLocalStorageKey(null);
        const userKey = getLocalStorageKey(userId);
        const userLocalState = readLocalSessions(userKey);
        const guestLocalState = readLocalSessions(guestKey);
        const localState = (userLocalState?.sessions?.length ? userLocalState : null) || guestLocalState;

        if (!userId) {
          if (localState?.sessions.length) {
            const nextCurrentSession = localState.sessions.find(s => s.id === localState.currentSessionId) || localState.sessions[0] || null;
            if (!cancelled) {
              setSessions(localState.sessions);
              setCurrentSession(nextCurrentSession);
            }
          } else if (!cancelled) {
            createNewSession();
          }
          return;
        }

        const remoteState = await loadRemoteSessions(userId).catch((error) => {
          console.warn('[chat] failed to load remote sessions:', error);
          return null;
        });

        if (remoteState?.sessions.length) {
          const nextCurrentSession = remoteState.sessions.find(s => s.id === remoteState.currentSessionId) || remoteState.sessions[0] || null;
          if (!cancelled) {
            setSessions(normalizeSessions(remoteState.sessions));
            setCurrentSession(nextCurrentSession);
          }
          return;
        }

        if (localState?.sessions.length) {
          const nextCurrentSession = localState.sessions.find(s => s.id === localState.currentSessionId) || localState.sessions[0] || null;
          if (!cancelled) {
            setSessions(normalizeSessions(localState.sessions));
            setCurrentSession(nextCurrentSession);
          }
          try {
            await saveRemoteSessions(userId, normalizeSessions(localState.sessions), nextCurrentSession?.id || null);
          } catch (error) {
            console.warn('[chat] failed to migrate local sessions to cloud:', error);
          }
          try {
            localStorage.removeItem(userKey);
            if (guestKey !== userKey) localStorage.removeItem(guestKey);
          } catch {}
          return;
        }

        if (!cancelled) {
          createNewSession();
        }
      } catch (error) {
        console.warn('[chat] failed to hydrate sessions:', error);
        if (!cancelled) createNewSession();
      } finally {
        if (!cancelled) didHydrateRef.current = true;
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, userId]);

  useEffect(() => {
    if (!didHydrateRef.current) return;
    if (isTyping) return;
    const nextCurrentSessionId = currentSession?.id || null;
    if (userId) {
      const nextSessions = normalizeSessions(sessions);
      void saveRemoteSessions(userId, nextSessions, nextCurrentSessionId).catch((error) => {
        console.warn('[chat] failed to save remote sessions:', error);
        saveLocalSessions(getLocalStorageKey(userId), nextSessions, nextCurrentSessionId);
      });
    } else {
      saveLocalSessions(getLocalStorageKey(null), normalizeSessions(sessions), nextCurrentSessionId);
    }
  }, [sessions, currentSession, userId, isTyping]);

  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
    }
  };

  const sendMessageWithAttachments = async (content: string, attachments: ChatAttachment[]) => {
    await sendMessage(content, attachments);
  };

  const sendMessage = async (content: string, attachments: ChatAttachment[] = []) => {
    if (!currentSession || !content.trim()) return;

    const userMessage: Message = {
      id: uid(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date(),
      type: 'text',
      attachments: attachments.length ? attachments : undefined
    };

    const updatedSession = {
      ...currentSession,
      title:
        currentSession.messages.length === 1 && currentSession.title === '新对话'
          ? `${content.trim().slice(0, 18)}${content.trim().length > 18 ? '...' : ''}`
          : currentSession.title,
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
        { role: 'system', content: '你是一位专业的中文职业规划顾问。请用简洁、结构化的 Markdown 输出，默认采用以下结构：1) 结论 2) 关键分析 3) 建议/下一步。需要比较时使用表格，需要分步骤时使用编号列表。避免冗长铺陈，不要输出无意义的套话。如果用户提供了附件，请结合附件内容，并明确指出你引用了哪些文件信息。' },
        ...conversation.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ];

      const attachmentContext = attachments.length
        ? attachments.map(item => ({
            name: item.name,
            type: item.type,
            size: item.size,
            text: item.text || ''
          }))
        : [];

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
            body: JSON.stringify({ messages: apiMessages, attachmentContext, model, temperature, stream: true })
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
              body: JSON.stringify({ messages: apiMessages, attachmentContext, model, temperature, stream: false })
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
        body: JSON.stringify({ messages: apiMessages, attachmentContext, model, temperature, stream: false })
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
    const nextSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(nextSessions);
    if (currentSession?.id === sessionId) {
      if (nextSessions.length > 0) {
        setCurrentSession(nextSessions[0]);
      } else {
        createNewSession();
        return;
      }
    }
  };

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
