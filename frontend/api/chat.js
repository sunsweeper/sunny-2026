/**
 * chat.js
 * Serverless handler for Sunny chat (clean, conflict-free).
 * - Uses ONE quoting path: calls /api/quote (source of truth)
 * - No duplicate helper functions
 * - Falls back to OpenAI for general Q&A
 *
 * Note: Booking “felt booked” hours-only confirmation can be added next.
 */

const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are Sunny, the assistant for SunSweeper. Be helpful, concise, and professional. Never invent prices, policies, licensing, insurance, or guarantees. Never ask for payment info. If asked for solar panel cleaning pricing, collect panel count and city before providing a quote. You must accurately answer: "Tell me about SunSweeper" with: Services include solar panel washing, roof washing, and pressure washing. Service area covers San Luis Obispo County and Santa Barbara County. Discounts are available for veterans, seniors, teachers, and first responders (no specific percentage).`;

// -------------------- Helpers: env / body parsing --------------------
function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return apiKey;
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (!req.body) {
    return {};
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  return {};
}

// -------------------- Helpers: panel count / city extraction --------------------
function normalizePanelCount(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  const parsed = Number.parseInt(String(rawValue), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractPanelCount(message, body) {
  if (body?.panelCount !== undefined) {
    return normalizePanelCount(body.panelCount);
  }

  const directMatch =
    message.match(/panel\s*count\s*[:=]\s*(\d+)/i) ||
    message.match(/panelcount\s*[:=]\s*(\d+)/i);

  if (directMatch) {
    return normalizePanelCount(directMatch[1]);
  }

  const panelMatch = message.match(/(\d+)\s*panels?\b/i);
  if (panelMatch) {
    return normalizePanelCount(panelMatch[1]);
  }

  return null;
}

function sanitizeCity(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/[\s,]+$/u, '').replace(/\s+/g, ' ');
}

function extractCity(message, body) {
  const bodyCity = sanitizeCity(body?.city || body?.address || body?.location);
  if (bodyCity) {
    return bodyCity;
  }

  const labeledMatch = message.match(/(?:city|address)\s*[:=]\s*([a-zA-Z .'-]+)/i);
  if (labeledMatch) {
    return sanitizeCity(labeledMatch[1]);
  }

  const inMatch = message.match(/\bin\s+([a-zA-Z.'-]+(?:\s+[a-zA-Z.'-]+)*)/i);
  if (inMatch) {
    return sanitizeCity(inMatch[1]);
  }

  return null;
}

// -------------------- Helpers: intent detection --------------------
function isSolarPricingIntent(message) {
  const lower = message.toLowerCase();
  const solarIntent = lower.includes('solar') || lower.includes('panel');
  const pricingIntent =
    lower.includes('price') ||
    lower.includes('quote') ||
    lower.includes('cost') ||
    lower.includes('estimate') ||
    lower.includes('how much');
  const bookingIntent =
    lower.includes('book') ||
    lower.includes('schedule') ||
    lower.includes('appointment');

  return {
    solarIntent,
    pricingIntent,
    bookingIntent,
    isRelevant: solarIntent && (pricingIntent || bookingIntent),
  };
}

// -------------------- Helpers: quote endpoint URL --------------------
function getQuoteUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = req.headers.host;
  if (!host) {
    return '/api/quote';
  }
  return `${protocol || 'http'}://${host}/api/quote`;
}

// -------------------- Handler --------------------
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed.' });
  }

  try {
    const body = await parseBody(req);
    const message = body?.message;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'A non-empty message field is required.' });
    }

    // 1) Solar pricing / booking-related questions: use /api/quote as source of truth
    const intent = isSolarPricingIntent(message);

    if (intent.isRelevant) {
      const panelCount = extractPanelCount(message, body);
      const city = extractCity(message, body);

      if (panelCount === null || !city) {
        return res.status(200).json({
          reply:
            'I can help with solar panel cleaning pricing. How many panels do you have, and what city are you in?',
        });
      }

      let quoteResponse = null;
      try {
        const quoteFetch = await fetch(getQuoteUrl(req), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceType: 'solar',
            panelCount,
            city,
          }),
        });
        quoteResponse = await quoteFetch.json();
      } catch (quoteError) {
        quoteResponse = { ok: false, error: 'Quote request failed' };
      }

      console.log('[CHAT→QUOTE]', {
        panelCount,
        city,
        ok: quoteResponse?.ok,
      });

      if (quoteResponse?.ok === true) {
        // If the user is also trying to book, nudge into booking flow.
        if (intent.bookingIntent) {
          return res.status(200).json({
            reply: `${quoteResponse.priceText} Want to get this scheduled? What day and time works best for you?`,
          });
        }

        return res.status(200).json({ reply: quoteResponse.priceText });
      }

      return res.status(200).json({
        reply:
          "Thanks — I have what I need, but I couldn't generate an instant quote for this one. Call or text 805-938-1515 and we'll finalize pricing quickly.",
      });
    }

    // 2) Everything else: send to OpenAI for general Q&A
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    return res.status(200).json({ reply });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: msg });
  }
};
