export const API_BASE = import.meta.env.VITE_API_BASE || '';

// Map known API paths to Netlify Functions when no external API base is set
export const apiUrl = (path: string) => {
  if (API_BASE) return `${API_BASE}${path}`;
  // default: use Netlify Functions for backend
  if (path.startsWith('/api/deepseek/chat')) return '/.netlify/functions/deepseek-chat';
  return path;
};
