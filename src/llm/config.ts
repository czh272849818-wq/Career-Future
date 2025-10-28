// 可通过 Netlify 环境变量覆盖
export const DEFAULT_LLM_MODEL = import.meta.env.VITE_LLM_MODEL ?? 'deepseek-chat';
export const DEFAULT_TEMPERATURE = Number(import.meta.env.VITE_TEMPERATURE ?? 0.7);
export const DEFAULT_STREAM = import.meta.env.VITE_STREAM_DEFAULT !== 'false'; // 默认 true