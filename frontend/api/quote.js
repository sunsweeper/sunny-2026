const fs = require('fs');
const path = require('path');

const PRICING_PATH = path.join(__dirname, '..', 'pricing.json');

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

function loadPricing() {
  const raw = fs.readFileSync(PRICING_PATH, 'utf8');
  return JSON.parse(raw);
}

function formatPrice(value) {
  const rounded = Number(value.toFixed(2));
  return { amount: rounded, text: `$${rounded.toFixed(2)}` };
}

function calculateQuote(panelCount) {
  const pricing = loadPricing();
  const service = pricing?.pricing?.solarPanelCleaning;
  if (!service) {
    throw new Error('Solar panel pricing is not configured.');
  }

  if (panelCount > service.overMaxPanels) {
    return {
      ok: false,
      needs: ['details'],
      message:
        'For systems over 60 panels, pricing is handled by a specialist after collecting a few details.',
    };
  }

  const tier = service.tiers.find(
    (entry) => panelCount >= entry.min && panelCount <= entry.max,
  );

  if (!tier) {
    throw new Error('No pricing tier matched the panel count.');
  }

  const priceValue = tier.type === 'flat' ? tier.amount : panelCount * tier.rate;
  const price = formatPrice(priceValue);

  return {
    ok: true,
    price: price.amount,
    priceText: price.text,
    panelCount,
    tierMatched: tier,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed.' });
  }

  try {
    const body = parseBody(req);
    const panelCount = body?.panelCount;

    if (!Number.isInteger(panelCount) || panelCount <= 0) {
      return res
        .status(400)
        .json({ error: 'panelCount must be a positive integer.' });
    }

    const result = calculateQuote(panelCount);
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
};

module.exports.calculateQuote = calculateQuote;
