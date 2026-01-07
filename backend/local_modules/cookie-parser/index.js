function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    list[key] = decodeURIComponent(val);
  }
  return list;
}

function cookieParser() {
  return (req, res, next) => {
    req.cookies = parseCookies(req.headers.cookie || '');
    next();
  };
}

module.exports = cookieParser;
