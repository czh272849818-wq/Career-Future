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

  // 预设的AI回复模板
  const aiResponses = [
    "根据您的情况，我建议您可以考虑以下几个方向：\n\n1. **技能提升**：重点关注数据分析和项目管理能力\n2. **行业选择**：互联网和金融科技领域有很好的发展前景\n3. **职业路径**：可以从产品助理开始，逐步向产品经理发展",
    
    "让我为您分析一下当前的职业发展趋势：\n\n📈 **热门领域**：AI、数据科学、产品管理\n💡 **核心技能**：跨部门协作、用户思维、数据驱动决策\n🎯 **发展建议**：建议您先完善基础技能，再考虑专业化发展",
    
    "基于您的背景，我推荐以下学习路径：\n\n**短期目标（3-6个月）**：\n- 完成产品管理相关课程\n- 参与1-2个实际项目\n\n**中期目标（6-12个月）**：\n- 建立个人作品集\n- 扩展行业人脉网络",
    
    "您提到的问题很有价值。让我从几个角度来分析：\n\n🔍 **市场需求**：该领域人才缺口较大\n📊 **薪资水平**：相比传统行业有20-30%的提升空间\n⚡ **发展速度**：新兴行业变化快，学习能力很重要",
    
    "关于职业转型，我的建议是：\n\n1. **评估现有技能**：找出可迁移的核心能力\n2. **补强关键技能**：针对目标岗位的要求进行学习\n3. **寻找过渡机会**：可以考虑内部转岗或相关项目经验\n4. **建立新的人脉**：参加行业活动和专业社群"
  ];

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
        { role: 'system', content: '你是一位专业的中文职业规划顾问，请用清晰、结构化的方式回答。' },
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
          if (msg.includes('ERR_NETWORK_IO_SUSPENDED') || msg.includes('Failed to fetch')) {
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