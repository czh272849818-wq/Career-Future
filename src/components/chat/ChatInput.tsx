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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriberPromiseRef = useRef<Promise<any> | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || attachments.length > 0) && !disabled) {
      if (isRecording) {
        stopRecording();
      }
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
      setAttachmentError('');
      setSpeechStatus('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing || e.nativeEvent.isComposing) return;
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

  const releaseMedia = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort?.();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  };

  const getTranscriber = async () => {
    if (!transcriberPromiseRef.current) {
      transcriberPromiseRef.current = (async () => {
        const { pipeline } = await import('@xenova/transformers');
        return pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
      })();
    }
    return transcriberPromiseRef.current;
  };

  const resampleAudio = (audioData: Float32Array, sourceRate: number, targetRate = 16000) => {
    if (sourceRate === targetRate) return audioData;
    const ratio = sourceRate / targetRate;
    const newLength = Math.max(1, Math.round(audioData.length / ratio));
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i += 1) {
      const position = i * ratio;
      const leftIndex = Math.floor(position);
      const rightIndex = Math.min(leftIndex + 1, audioData.length - 1);
      const weight = position - leftIndex;
      result[i] = audioData[leftIndex] * (1 - weight) + audioData[rightIndex] * weight;
    }

    return result;
  };

  const decodeAudioBlob = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channels = decoded.numberOfChannels;
      const mixed = new Float32Array(decoded.length);

      for (let channel = 0; channel < channels; channel += 1) {
        const data = decoded.getChannelData(channel);
        for (let i = 0; i < data.length; i += 1) {
          mixed[i] += data[i] / channels;
        }
      }

      return resampleAudio(mixed, decoded.sampleRate, 16000);
    } finally {
      await audioContext.close().catch(() => {});
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    setSpeechStatus('正在识别语音...');
    try {
      const audio = await decodeAudioBlob(blob);
      const transcriber = await getTranscriber();
      const output = await transcriber(audio, {
        language: 'zh',
        task: 'transcribe',
        return_timestamps: false
      });
      const text = String(output?.text || '').trim();
      if (text) {
        setMessage(prev => (prev.trim() ? `${prev.trim()} ${text}` : text));
        setSpeechStatus('语音已转写');
      } else {
        setSpeechStatus('未识别到有效语音');
      }
    } catch (error) {
      console.error('[speech] transcribe failed:', error);
      setSpeechStatus('语音转写失败，请改用键盘输入');
    } finally {
      setIsTranscribing(false);
      releaseMedia();
      setTimeout(() => setSpeechStatus(''), 2500);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop?.();
      } catch {}
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      return;
    }
    releaseMedia();
  };

  const startRecording = async () => {
    if (disabled || isTranscribing) return;

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognitionRef.current = recognition;

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results || [])
            .map((result: any) => result?.[0]?.transcript || '')
            .join('')
            .trim();
          if (transcript) {
            setMessage(prev => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
            setSpeechStatus('语音已转写');
          } else {
            setSpeechStatus('未识别到有效语音');
          }
        };

        recognition.onerror = (event: any) => {
          console.error('[speech] recognition failed:', event);
          setSpeechStatus('语音识别失败，请改用键盘输入');
        };

        recognition.onend = () => {
          setIsRecording(false);
          recognitionRef.current = null;
          setTimeout(() => setSpeechStatus(''), 2500);
        };

        setIsRecording(true);
        setSpeechStatus('正在识别语音...');
        recognition.start();
        return;
      } catch (error) {
        console.warn('[speech] native recognition failed, fallback to recorder:', error);
        recognitionRef.current = null;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setSpeechStatus('当前浏览器不支持麦克风访问');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(
        stream,
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? { mimeType: 'audio/webm;codecs=opus' }
          : undefined
      );

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        void transcribeAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setSpeechStatus('录音中，再点一次停止并转写');
    } catch (error) {
      console.error('[speech] microphone access failed:', error);
      setSpeechStatus('麦克风权限未开启，请允许后重试');
      releaseMedia();
    }
  };

  const handleVoiceClick = () => {
    if (isTranscribing) return;
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  useEffect(() => () => releaseMedia(), []);

  return (
    <div className="border-t border-gray-800 bg-gray-900/80 px-4 py-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl items-end gap-2 rounded-3xl border border-gray-700 bg-gray-800/90 px-3 py-3 shadow-lg shadow-black/10">
        <button
          type="button"
          onClick={handleAttachClick}
          className="flex-shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
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

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="max-h-40 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-6 text-white placeholder-gray-400 focus:outline-none"
            style={{ minHeight: '36px' }}
          />
        </div>

        <button
          type="button"
          onClick={handleVoiceClick}
          disabled={disabled || isTranscribing}
          className={`flex-shrink-0 rounded-full p-2 transition-colors ${
            isRecording ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
          } disabled:cursor-not-allowed disabled:opacity-40`}
          title={isRecording ? '停止录音并转写' : '语音输入'}
        >
          {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        <button
          type="submit"
          disabled={(!message.trim() && attachments.length === 0) || disabled || isTranscribing}
          className="flex-shrink-0 rounded-full bg-white p-2 text-gray-900 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>

      {speechStatus && <p className="mx-auto mt-2 max-w-4xl text-xs text-emerald-300">{speechStatus}</p>}
      {attachmentError && <p className="mt-2 text-xs text-red-300">{attachmentError}</p>}

      {attachments.length > 0 && (
        <div className="mx-auto mt-3 flex max-w-4xl flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-200">
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
