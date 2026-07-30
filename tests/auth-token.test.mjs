import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createToken as createNetlifyToken,
  getAuthenticatedUser,
  ownsUserId,
  verifyToken as verifyNetlifyToken
} from '../netlify/functions/_shared/auth-store.mjs';
import {
  createToken as createLocalToken,
  verifyToken as verifyLocalToken
} from '../server/db.js';
import chatSessionsHandler from '../netlify/functions/chat-sessions.mjs';
import userAssessmentsHandler from '../netlify/functions/user-assessments.mjs';
import userDataHandler from '../netlify/functions/user-data.mjs';
import authRegisterHandler from '../netlify/functions/auth-register.mjs';
import extractTextHandler, { MAX_FILE_BYTES } from '../netlify/functions/extract-text.mjs';

process.env.AUTH_SECRET = 'test-only-auth-secret-for-token-boundary';

const user = { id: 'user-a' };

function requestWithToken(token) {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null;
      }
    }
  };
}

test('Netlify token authenticates its owner and rejects other user IDs', () => {
  const token = createNetlifyToken(user);

  assert.deepEqual(getAuthenticatedUser(requestWithToken(token)), user);
  assert.equal(ownsUserId(user, 'user-a'), true);
  assert.equal(ownsUserId(user, 'user-b'), false);
});

test('Netlify token rejects missing, tampered, and expired credentials', () => {
  const token = createNetlifyToken(user);
  const expired = createNetlifyToken(user, Date.now() - 8 * 24 * 60 * 60 * 1000);
  const tampered = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;

  assert.equal(getAuthenticatedUser(requestWithToken('')), null);
  assert.equal(verifyNetlifyToken(tampered), null);
  assert.equal(verifyNetlifyToken(expired), null);
});

test('local development token follows the same validity rules', () => {
  const token = createLocalToken(user);
  const expired = createLocalToken(user, Date.now() - 8 * 24 * 60 * 60 * 1000);

  assert.deepEqual(verifyLocalToken(token), user);
  assert.equal(verifyLocalToken(expired), null);
});

test('cloud data handlers reject unauthenticated and cross-user requests before storage access', async () => {
  const token = createNetlifyToken(user);
  const requests = [
    [userDataHandler, new Request('https://example.test/user-data?userId=user-b', { headers: { Authorization: `Bearer ${token}` } })],
    [userAssessmentsHandler, new Request('https://example.test/user-assessments?userId=user-b', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'assessment-1' }) })],
    [chatSessionsHandler, new Request('https://example.test/chat-sessions?userId=user-b', { headers: { Authorization: `Bearer ${token}` } })]
  ];

  for (const [handler, request] of requests) {
    const response = await handler(request);
    assert.equal(response.status, 403);
  }

  const unauthorized = await userDataHandler(new Request('https://example.test/user-data?userId=user-a'));
  assert.equal(unauthorized.status, 401);
});

test('registration rejects malformed email and unsafe password lengths before persistence', async () => {
  const invalidEmail = await authRegisterHandler(new Request('https://example.test/auth-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'password123' })
  }));
  const oversizedPassword = await authRegisterHandler(new Request('https://example.test/auth-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.test', password: 'a'.repeat(129) })
  }));

  assert.equal(invalidEmail.status, 400);
  assert.equal(oversizedPassword.status, 400);
});

test('file extraction rejects unsupported and oversized uploads before parsing', async () => {
  const unsupported = await extractTextHandler(new Request('https://example.test/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: 'resume.exe', mimeType: 'application/octet-stream', dataBase64: 'aGVsbG8=' })
  }));
  const oversized = await extractTextHandler(new Request('https://example.test/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: 'resume.txt', mimeType: 'text/plain', dataBase64: 'A'.repeat(Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8) })
  }));

  assert.equal(unsupported.status, 415);
  assert.equal(oversized.status, 413);
});
