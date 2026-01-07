const SYSTEM_PROMPT = `You are Sunny, the friendly virtual assistant for SunSweeper. Be helpful, accurate, and concise. Never invent prices, availability, policies, or guarantees. If details are missing, ask a clarifying question. If asked “Tell me about SunSweeper”, provide a clean overview: services (solar panel washing, roof washing, pressure washing), service area (San Luis Obispo and Santa Barbara counties), and discounts (veterans, seniors, teachers, first responders) without claiming specific percentages. Maintain a professional, warm tone.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OpenAI API key' });
  }

  try {
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
