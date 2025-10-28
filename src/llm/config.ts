// 默认模型优先使用 deepseek-chat，并对环境变量做容错处理
const RAW_MODEL = String(import.meta.env.VITE_LLM_MODEL ?? '').trim().toLowerCase();
export const DEFAULT_LLM_MODEL = RAW_MODEL === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';

export const DEFAULT_TEMPERATURE = Number(import.meta.env.VITE_TEMPERATURE ?? 0.7);

// 仅当值为字符串 'false' 时关闭流式，其余均视为开启
const RAW_STREAM = String(import.meta.env.VITE_STREAM_DEFAULT ?? '').trim().toLowerCase();
export const DEFAULT_STREAM = RAW_STREAM !== 'false'; // 默认 true