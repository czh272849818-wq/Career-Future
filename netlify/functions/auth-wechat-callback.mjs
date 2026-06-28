import { createToken, sanitizeUser, upsertWechatUser } from './_shared/auth-store.mjs';

export default async (req) => {
  const frontendUrl = process.env.FRONTEND_URL || new URL(req.url).origin;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || '';
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!code) return Response.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信授权失败')}`, 302);
    if (!appId || !appSecret) {
      return Response.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信登录需要配置 WECHAT_APP_ID 与 WECHAT_APP_SECRET')}`, 302);
    }

    const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    tokenUrl.searchParams.set('appid', appId);
    tokenUrl.searchParams.set('secret', appSecret);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || tokenData.errcode) throw new Error(tokenData.errmsg || '微信授权换取失败');

    const userUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
    userUrl.searchParams.set('access_token', tokenData.access_token);
    userUrl.searchParams.set('openid', tokenData.openid);
    userUrl.searchParams.set('lang', 'zh_CN');
    const userResp = await fetch(userUrl);
    const userData = await userResp.json();
    if (!userResp.ok || userData.errcode) throw new Error(userData.errmsg || '微信用户信息获取失败');

    const user = await upsertWechatUser({
      openid: userData.openid,
      unionid: userData.unionid,
      nickname: userData.nickname,
      avatar: userData.headimgurl
    });
    const token = createToken(user);
    const payload = encodeURIComponent(JSON.stringify(sanitizeUser(user)));
    return Response.redirect(`${frontendUrl}/login?auth_token=${encodeURIComponent(token)}&user=${payload}`, 302);
  } catch (err) {
    console.error('[auth-wechat-callback] error:', err);
    return Response.redirect(`${frontendUrl}/login?auth_error=${encodeURIComponent('微信登录失败，请稍后重试')}`, 302);
  }
};
