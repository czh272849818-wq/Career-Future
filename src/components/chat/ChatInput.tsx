import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic } from 'lucide-react';

type Attachment = {
  name: string;
  type: string;
  size: number;
  text?: string;
  dataUrl?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || attachments.length > 0) && !disabled) {
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
      setAttachmentError('');
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

  const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const extractText = async (file: File) => {
    const name = file.name.toLowerCase();
    const type = file.type || '';
    if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
      return await file.text();
    }

    const dataUrl = await toDataUrl(file);
    if (type.startsWith('image/')) {
      return `[图片] ${file.name}`;
    }
    if (type === 'video/mp4' || name.endsWith('.mp4')) {
      return `[视频] ${file.name}`;
    }

    return dataUrl;
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachmentError('');
    try {
      const next = await Promise.all(files.map(async (file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
        text: await extractText(file),
        dataUrl: file.type.startsWith('image/') || file.type === 'video/mp4' ? await toDataUrl(file) : undefined
      })));
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
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-300 transition-colors"
          title="语音输入"
        >
          <Mic className="h-5 w-5" />
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
