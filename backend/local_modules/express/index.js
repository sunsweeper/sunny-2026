const http = require('http');
const url = require('url');

function enhanceRes(res) {
  if (res._enhanced) return res;
  res._enhanced = true;

  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };

  res.set = function set(field, value) {
    res.setHeader(field, value);
    return res;
  };

  res.json = function json(payload) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  };

  res.send = function send(payload) {
    if (typeof payload === 'object') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    } else {
      res.end(payload);
    }
  };

  res.cookie = function cookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.secure) parts.push('Secure');
    if (options.path) parts.push(`Path=${options.path}`);
    const cookieValue = parts.join('; ');
    const existing = res.getHeader('Set-Cookie');
    if (existing) {
      res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, cookieValue] : [existing, cookieValue]);
    } else {
      res.setHeader('Set-Cookie', cookieValue);
    }
    return res;
  };

  return res;
}

function matchPath(targetPath, routePath) {
  if (routePath === '/' || routePath === '') return targetPath.startsWith('/') ? true : false;
  return targetPath === routePath || targetPath.startsWith(routePath + '/');
}

function createRouter() {
  const stack = [];

  const router = (req, res, out) => handle(router, req, res, out);

  router.use = (path, ...handlers) => {
    if (typeof path === 'function' || (path && path.handle)) {
      handlers = [path, ...handlers];
      path = '/';
    }
    stack.push({ type: 'use', path, handlers });
    return router;
  };

  ['get', 'post'].forEach((method) => {
    router[method] = (path, ...handlers) => {
      stack.push({ type: 'route', method: method.toUpperCase(), path, handlers });
      return router;
    };
  });

  router.handle = (req, res, out) => handle(router, req, res, out);

  router.listen = (port, cb) => {
    const server = http.createServer((req, res) => handle(router, req, res));
    return server.listen(port, cb);
  };

  function handle(routerInstance, req, res, out) {
    enhanceRes(res);
    const parsed = url.parse(req.url, true);
    req.path = parsed.pathname || '/';
    req.query = parsed.query || {};

    let idx = 0;
    let error = null;

    const next = (err) => {
      error = err || null;
      const layer = stack[idx++];
      if (!layer) {
        if (out) return out(error);
        if (error) {
          res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
        } else {
          res.status(404).json({ error: 'Not Found' });
        }
        return;
      }

      if (layer.type === 'use') {
        if (!matchPath(req.path, layer.path)) return next(error);
        runHandlers(layer.handlers, req, res, next, layer.path);
        return;
      }

      if (layer.type === 'route') {
        if (layer.method !== req.method) return next(error);
        if (req.path !== layer.path) return next(error);
        runHandlers(layer.handlers, req, res, next);
        return;
      }

      next(error);
    };

    next();
  }

  function runHandlers(handlers, req, res, next, basePath = null) {
    let i = 0;
    const originalUrl = req.url;
    const originalPath = req.path;

    if (basePath && matchPath(originalPath, basePath)) {
      req.url = originalUrl.slice(basePath.length) || '/';
      req.path = originalPath.slice(basePath.length) || '/';
    }

    const step = (err) => {
      const handler = handlers[i++];
      if (!handler) {
        req.url = originalUrl;
        req.path = originalPath;
        return next(err);
      }

      try {
        if (err) {
          if (handler.length === 4) {
            handler(err, req, res, step);
          } else {
            step(err);
          }
          return;
        }

        if (handler.handle) {
          handler.handle(req, res, step);
        } else if (handler.length === 4) {
          step();
        } else if (handler.length === 3) {
          handler(req, res, step);
        } else {
          handler(req, res);
          step();
        }
      } catch (e) {
        step(e);
      }
    };

    step();
  }

  return router;
}

function json() {
  return (req, res, next) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        next();
      } catch (err) {
        err.status = 400;
        err.message = 'Invalid JSON body';
        next(err);
      }
    });
  };
}

module.exports = Object.assign(createRouter, { Router: createRouter, json });
