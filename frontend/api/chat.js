const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const { calculateQuote } = require('./quote');

const SYSTEM_PROMPT = `You are Sunny, the assistant for SunSweeper. Be helpful, concise, and professional. Never invent prices, policies, licensing, insurance, or guarantees. If asked about solar panel cleaning pricing or booking, always ask for panel count and city first (do not ask for address initially). Use only provided quote data when it is available. Booking availability is Mon–Sat 8am–5pm, excluding major holidays. Collect booking details in this order: name, phone, email (optional), then address, then preferred date + 2-hour window. Confirm scope, window, quoted price, and customer info before booking. If a quote requires specialist handling, collect commercial vs residential, city, and access notes, and offer a follow-up from Aaron. Never ask for payment info. Do not claim rain cleans panels adequately. You must accurately answer: "Tell me about SunSweeper" with: Services include solar panel washing, roof washing, and pressure washing. Service area covers San Luis Obispo County and Santa Barbara County. Discounts are available for veterans, seniors, teachers, and first responders (no specific percentage). Encourage booking a quote or contacting the team.`;

const BOOKING_WINDOW_TEXT =
  'Mon–Sat 8am–5pm (excluding major holidays).';

function extractPanelCount(message) {
  const match = message.match(/(\\d+)\\s*(?:panel|panels)\\b/i);
  if (!match) {
    return null;
  }
  const count = Number.parseInt(match[1], 10);
  return Number.isInteger(count) ? count : null;
}

function extractCity(message) {
  const match = message.match(
    /(?:\\bin\\b|\\bcity\\b\\s*(?:is|:))\\s*([A-Za-z][A-Za-z\\s.'-]+)/i,
  );
  if (!match) {
    return null;
  }
  const cleaned = match[1].replace(/[,.!?].*$/, '').trim();
  return cleaned || null;
}

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

    const intent = isSolarPricingIntent(message);
    if (intent.isRelevant) {
      const panelCount = extractPanelCount(message);
      const city = extractCity(message);

      if (!panelCount || !city) {
        return res.status(200).json({
          reply:
            'I can help with solar panel cleaning pricing. How many panels do you have, and what city are you in?',
        });
      }

      const quote = calculateQuote(panelCount);

      if (!quote.ok && quote.needs?.includes('details')) {
        return res.status(200).json({
          reply:
            'For systems over 60 panels, pricing is handled by a specialist after collecting a few details. Is the property residential or commercial, what city are you in, and are there any access notes? I can have Aaron follow up once I have those.',
        });
      }

      if (intent.bookingIntent) {
        return res.status(200).json({
          reply: `Great—your total for ${panelCount} panels in ${city} is ${quote.priceText}. We book ${BOOKING_WINDOW_TEXT} To reserve a spot, please share your name, phone number, email (optional), service address, and a preferred date with a 2-hour window.`,
        });
      }

      return res.status(200).json({
        reply: `For ${panelCount} panels in ${city}, the total is ${quote.priceText}. We book ${BOOKING_WINDOW_TEXT} Would you like to schedule a visit?`,
      });
    }

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
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
};
