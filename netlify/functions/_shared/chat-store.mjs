import { getStore } from '@netlify/blobs';

const STORE_NAME = 'career-future-chat-sessions';

function sessionKey(userId, sessionId) {
  return `users/${userId}/sessions/${sessionId}`;
}

function indexKey(userId) {
  return `users/${userId}/index`;
}

function stripAttachmentPayload(attachments = []) {
  return attachments.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') return attachment;
    const { dataUrl, ...safe } = attachment;
    return safe;
  });
}

function serializeSession(session) {
  if (!session || typeof session !== 'object') return session;
  const messages = Array.isArray(session.messages)
    ? session.messages.map((message) => ({
        ...message,
        attachments: Array.isArray(message?.attachments) ? stripAttachmentPayload(message.attachments) : message.attachments
      }))
    : [];

  return {
    ...session,
    messages
  };
}

async function readChatState(userId) {
  if (!userId) return null;
  const store = getStore(STORE_NAME);
  const index = await store.get(indexKey(userId), { type: 'json' }).catch(() => null);
  if (!index) {
    return {
      sessions: [],
      currentSessionId: null,
      updatedAt: null
    };
  }

  const sessionIds = Array.isArray(index.sessionIds) ? index.sessionIds : [];
  const sessions = await Promise.all(sessionIds.map(async (sessionId) => {
    return store.get(sessionKey(userId, sessionId), { type: 'json' }).catch(() => null);
  }));

  return {
    sessions: sessions.filter(Boolean).map((session) => serializeSession(session)),
    currentSessionId: index.currentSessionId || null,
    updatedAt: index.updatedAt || null
  };
}

async function writeChatState(userId, sessions = [], currentSessionId = null) {
  if (!userId) throw new Error('MISSING_USER_ID');
  const store = getStore(STORE_NAME);
  const safeSessions = Array.isArray(sessions) ? sessions.map((session) => serializeSession(session)) : [];
  const existingIndex = await store.get(indexKey(userId), { type: 'json' }).catch(() => null);
  const existingSessionIds = Array.isArray(existingIndex?.sessionIds) ? existingIndex.sessionIds : [];
  const nextSessionIds = safeSessions.map((session) => session.id);

  await Promise.all(safeSessions.map((session) => store.setJSON(sessionKey(userId, session.id), session)));
  await Promise.all(existingSessionIds.filter((sessionId) => !nextSessionIds.includes(sessionId)).map((sessionId) => store.delete(sessionKey(userId, sessionId)).catch(() => {})));

  await store.setJSON(indexKey(userId), {
    sessionIds: nextSessionIds,
    currentSessionId: currentSessionId || null,
    updatedAt: new Date().toISOString()
  });

  return {
    sessions: safeSessions,
    currentSessionId: currentSessionId || null
  };
}

export {
  indexKey,
  readChatState,
  serializeSession,
  sessionKey,
  writeChatState
};
