const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const SYSTEM_PROMPT = `You are Sunny, the assistant for SunSweeper. Be helpful, concise, and professional. Never invent prices, policies, licensing, insurance, or guarantees. If asked for pricing, ask for panel count and address/city, then provide a range if possible or say you need more details. You must accurately answer: "Tell me about SunSweeper" with: Services include solar panel washing, roof washing, and pressure washing. Service area covers San Luis Obispo County and Santa Barbara County. Discounts are available for veterans, seniors, teachers, and first responders (no specific percentage). Encourage booking a quote or contacting the team.`;

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
