const SYSTEM_PROMPT = `You are Sunny, the friendly virtual assistant for SunSweeper. Be helpful, accurate, and concise. Never invent prices, availability, policies, or guarantees. If details are missing, ask a clarifying question. If asked “Tell me about SunSweeper”, provide a clean overview: services (solar panel washing, roof washing, pressure washing), service area (San Luis Obispo and Santa Barbara counties), and discounts (veterans, seniors, teachers, first responders) without claiming specific percentages. Maintain a professional, warm tone.`;

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
  const directMatch = message.match(/panel\s*count\s*[:=]\s*(\d+)/i) || message.match(/panelcount\s*[:=]\s*(\d+)/i);
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

function getQuoteUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = req.headers.host;
  if (!host) {
    return '/api/quote';
  }
  return `${protocol || 'http'}://${host}/api/quote`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = await parseBody(req);
  const { message } = body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OpenAI API key' });
  }

  try {
    const panelCount = extractPanelCount(message, body);
    const city = extractCity(message, body);

    if (panelCount !== null && city) {
      let quoteResponse = null;
      try {
        const quoteFetch = await fetch(getQuoteUrl(req), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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

      console.log('[CHAT→QUOTE]', { panelCount, city, quoteResponse });

      if (quoteResponse?.ok === true) {
        return res.status(200).json({ reply: quoteResponse.priceText });
      }

      return res.status(200).json({
        reply: 'Thanks for the details. Please contact our team so we can finalize pricing for this request.',
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || 'OpenAI request failed' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({ error: 'Empty response from OpenAI' });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: 'Unexpected server error' });
  }
};
