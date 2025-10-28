export const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE.replace(/\/$/, '')}${path}`;
  // 本地开发走 Vite 代理，生产环境优先用 Edge Functions
  if (path === '/api/deepseek/chat') {
    return '/.netlify/edge-functions/deepseek-chat';
  }
  return path;
}