export const DEFAULT_LLM_MODEL = 'deepseek-chat';
export const DEFAULT_TEMPERATURE = 0.7;

// Allow environment override: set VITE_STREAM_DEFAULT=false on Netlify to disable streaming
const envStream = String(import.meta.env.VITE_STREAM_DEFAULT || '').toLowerCase();
export const DEFAULT_STREAM = envStream ? envStream === 'true' : false;
