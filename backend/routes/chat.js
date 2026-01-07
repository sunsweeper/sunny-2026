const express = require('express');
const { createCompletion, streamCompletion } = require('../openaiClient');
const { sendEvent, initSSE, close } = require('../utils/sse');

const router = express.Router();
const SYSTEM_PROMPT = `You are Sunny, a concise, friendly web assistant. Answer clearly without fluff. If asked about business information, say: "I can connect you with the SunSweeper team" and show a placeholder contact line. If you are unsure, say so.`;
const MAX_HISTORY_TURNS = 10;

router.post('/', async (req, res, next) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'A non-empty message field is required.' });
    }

    const session = req.session;
    if (!session) {
      return res.status(500).json({ error: 'Session unavailable.' });
    }

    const history = session.history || [];
    const trimmedHistory = history.slice(-MAX_HISTORY_TURNS * 2);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...trimmedHistory.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: message.trim() },
    ];

    const useStream = req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream');

    if (useStream) {
      initSSE(res);
      let fullReply = '';
      try {
        for await (const token of streamCompletion(messages)) {
          fullReply += token;
          sendEvent(res, { token });
        }
        sendEvent(res, { done: true });
        close(res);
        session.history = [...trimmedHistory, { role: 'user', content: message.trim() }, { role: 'assistant', content: fullReply }];
      } catch (err) {
        sendEvent(res, { error: 'Failed to stream response.' });
        close(res);
        throw err;
      }
      return;
    }

    const reply = await createCompletion(messages);
    session.history = [...trimmedHistory, { role: 'user', content: message.trim() }, { role: 'assistant', content: reply }];

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
