import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, MicOff } from 'lucide-react';

type Attachment = {
  file: File;
  name: string;
  type: string;
  size: number;
};

interface ChatInputProps {
  onSendMessage: (message: string, attachments: Attachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false,
  placeholder = "输入您的问题..."
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptPrefixRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || attachments.length > 0) && !disabled) {
      stopSpeechRecognition();
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
      setAttachmentError('');
      setSpeechStatus('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // 自动调整textarea高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachmentError('');
    try {
      const next = files.map((file) => ({
        file,
        name: file.name,
        type: file.type,
        size: file.size
      }));
      setAttachments(prev => [...prev, ...next]);
    } catch {
      setAttachmentError('附件读取失败，请重试');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceClick = () => {
    if (disabled) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechStatus('当前浏览器不支持语音输入');
      return;
    }

    if (isListening) {
      stopSpeechRecognition();
      setSpeechStatus('');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      transcriptPrefixRef.current = message.trim();

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        const nextTranscript = `${transcriptPrefixRef.current}${transcriptPrefixRef.current ? ' ' : ''}${finalTranscript}${interimTranscript}`.trim();
        setMessage(nextTranscript);
      };

      recognition.onerror = () => {
        setSpeechStatus('语音输入不可用，请改用键盘输入');
        stopSpeechRecognition();
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setSpeechStatus('正在聆听，请开始说话');
    } catch {
      setSpeechStatus('语音输入启动失败，请重试');
      stopSpeechRecognition();
    }
  };

  useEffect(() => () => stopSpeechRecognition(), []);

  const quickQuestions = [
    "如何转行到互联网行业？",
    "产品经理需要什么技能？",
    "如何提升简历竞争力？",
    "职业发展规划建议"
  ];

  return (
    <div className="border-t border-gray-700 bg-gray-800/50 backdrop-blur-sm p-4">
      {/* Quick Questions */}
      {message === '' && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">快速提问：</p>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setMessage(question)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-full transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        {/* Attachment Button */}
        <button
          type="button"
          onClick={handleAttachClick}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-300 transition-colors"
          title="附件"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.mp4"
          onChange={handleFileChange}
        />

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-white placeholder-gray-400 max-h-32"
            style={{ minHeight: '48px' }}
          />
        </div>

        {/* Voice Button */}
        <button
          type="button"
          onClick={handleVoiceClick}
          className={`flex-shrink-0 p-2 transition-colors ${isListening ? 'text-emerald-400 hover:text-emerald-300' : 'text-gray-400 hover:text-gray-300'}`}
          title="语音输入"
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!message.trim() && attachments.length === 0) || disabled}
          className="flex-shrink-0 p-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      {speechStatus && <p className="mt-2 text-xs text-emerald-300">{speechStatus}</p>}
      {attachmentError && <p className="mt-2 text-xs text-red-300">{attachmentError}</p>}

      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-gray-600 bg-gray-900/60 px-3 py-1 text-xs text-gray-200">
              <span className="max-w-48 truncate">{file.name}</span>
              <button type="button" onClick={() => removeAttachment(index)} className="text-gray-400 hover:text-white">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatInput;
