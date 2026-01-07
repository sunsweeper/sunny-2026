function cors(options = {}) {
  const { origin = '*', credentials = false } = options;
  return (req, res, next) => {
    const requestOrigin = req.headers.origin;
    const allowedOrigin = origin === true ? requestOrigin || '*' : origin;
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin === '*' ? '*' : allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (credentials && allowedOrigin !== '*') {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}

module.exports = cors;
