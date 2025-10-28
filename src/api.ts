export const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export function apiUrl(path: string): string {
  // 本地或 Railway 后端走原路径；Netlify 无 BASE 时走边缘函数
  if (!API_BASE && path.startsWith('/api/deepseek/chat')) {
    return '/.netlify/edge-functions/deepseek-chat-edge';
  }
  return (API_BASE + path).replace(/([^:])\/+/g, '$1/');
}