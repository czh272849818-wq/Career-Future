export const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function isNetlifyDomain(base?: string): boolean {
  try {
    if (base) {
      const host = new URL(base).hostname;
      if (/netlify\.app$/i.test(host)) return true;
    }
  } catch {}
  if (typeof window !== 'undefined') {
    if (/netlify\.app$/i.test(window.location.hostname)) return true;
  }
  return false;
}

export function apiUrl(path: string): string {
  const base = (API_BASE || '').replace(/\/$/, '');
  const onNetlify = isNetlifyDomain(base);

  // 核心：在 Netlify 域上强制使用函数/边缘函数路径，避免 SPA 兜底吞掉 /api/*
  if (path === '/api/extract-text') {
    if (onNetlify || (!base && !(import.meta.env && import.meta.env.DEV))) {
      return '/.netlify/functions/extract-text';
    }
  }
  if (path === '/api/deepseek/chat') {
    // 在 Netlify 域上优先走 Edge（/deepseek-chat），获得更长执行窗口与SSE心跳
    if (onNetlify || (!base && !(import.meta.env && import.meta.env.DEV))) {
      return '/deepseek-chat';
    }
  }
  if (path === '/api/deepseek/taxonomy') {
    // 行业/岗位 taxonomy 走 Edge，非流式 JSON
    if (onNetlify || (!base && !(import.meta.env && import.meta.env.DEV))) {
      return '/deepseek-taxonomy';
    }
  }
  if (path === '/api/auth/register') {
    if (onNetlify || (!base && !(import.meta.env && import.meta.env.DEV))) {
      return '/.netlify/functions/auth-register';
    }
  }
  if (path === '/api/auth/login') {
    if (onNetlify || (!base && !(import.meta.env && import.meta.env.DEV))) {
      return '/.netlify/functions/auth-login';
    }
  }
  if (path === '/api/auth/demo') {
    if (onNetlify || (!base && !(import.meta.env && import.meta.env.DEV))) {
      return '/.netlify/functions/auth-demo';
    }
  }

  // 非 Netlify 且配置了后端基础地址时，拼接为绝对路径
  if (base && !onNetlify) return `${base}${path}`;

  // 开发环境保留相对路径，走 Vite 代理
  if (import.meta.env && import.meta.env.DEV) return path;

  // 其他情况返回原始路径
  return path;
}
