const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'onboarding@resend.dev';

function parseBody(req) {
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

function formatPriceQuoted(priceQuoted) {
  if (!priceQuoted) {
    return 'Price: Not quoted yet';
  }
  if (typeof priceQuoted === 'string') {
    return `Price: ${priceQuoted}`;
  }
  if (typeof priceQuoted === 'object') {
    const text = priceQuoted.priceText;
    if (text) {
      return `Price: ${text}`;
    }
    if (typeof priceQuoted.price === 'number') {
      return `Price: $${priceQuoted.price.toFixed(2)}`;
    }
  }
  return 'Price: Not quoted yet';
}

function formatValue(label, value) {
  return `${label}: ${value || 'Not provided'}`;
}

async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error: ${response.status} ${errorText}`);
  }

  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed.' });
  }

  try {
    const body = parseBody(req);
    const bookingTo = process.env.BOOKING_TO_EMAIL || 'aaron@sunsweeper.com';

    const panelCount = Number.isFinite(body.panelCount)
      ? body.panelCount
      : null;

    const textLines = [
      'New SunSweeper booking request',
      '',
      formatValue('Name', body.name),
      formatValue('Phone', body.phone),
      formatValue('Email', body.email),
      formatValue('Address', body.address),
      formatValue('Preferred date', body.preferredDate),
      formatValue('Preferred window', body.preferredWindow),
      formatValue('Service', body.serviceType || 'Solar panel cleaning'),
      formatValue(
        'Panel count',
        panelCount,
      ),
      formatPriceQuoted(body.priceQuoted),
      formatValue('Access notes', body.accessNotes),
      formatValue('Property type', body.propertyType),
      formatValue('City', body.city),
      formatValue('Additional details', body.notes),
    ];

    await sendEmail({
      to: bookingTo,
      subject: 'New SunSweeper booking request',
      text: textLines.join('\n'),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
};
