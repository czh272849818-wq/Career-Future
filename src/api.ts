export const API_BASE = import.meta.env.VITE_API_BASE || '';
export const apiUrl = (path: string) => (API_BASE ? `${API_BASE}${path}` : path);
