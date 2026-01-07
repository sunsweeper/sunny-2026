const crypto = require('crypto');

const SESSION_COOKIE = 'sunny_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours
const sessionStore = new Map();

function createSession() {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const data = { id, createdAt, history: [] };
  sessionStore.set(id, data);
  return data;
}

function getSession(id) {
  const session = sessionStore.get(id);
  if (!session) return null;
  const expired = session.createdAt + SESSION_TTL_MS < Date.now();
  if (expired) {
    sessionStore.delete(id);
    return null;
  }
  return session;
}

function sessionMiddleware(req, res, next) {
  let sessionId = req.cookies[SESSION_COOKIE];
  let session = sessionId ? getSession(sessionId) : null;

  if (!session) {
    session = createSession();
    sessionId = session.id;
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
  }

  req.session = session;
  next();
}

module.exports = { sessionMiddleware, sessionStore };
