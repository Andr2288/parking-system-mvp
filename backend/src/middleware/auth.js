const jwt = require('jsonwebtoken');

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    return null;
  }
  return token.trim();
}

function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = {
      id: payload.sub,
      login: payload.login,
      role: payload.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth, getBearerToken };
