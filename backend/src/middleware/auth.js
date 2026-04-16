'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Attaches req.user if a valid token is present; does NOT reject on missing token. */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
  } catch {
    // Ignore invalid / expired tokens for optional routes
  }
  next();
}

/** Rejects unauthenticated requests with 401. */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
  }
  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: { code: 'TOKEN_INVALID', message: 'Token invalid or expired.' } });
  }
}

/** Must follow requireAuth. Rejects non-creators. */
function requireCreator(req, res, next) {
  if (req.user?.role !== 'creator') {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Creator role required.' } });
  }
  next();
}

/** Must follow requireAuth. Rejects non-consumers. */
function requireConsumer(req, res, next) {
  if (req.user?.role !== 'consumer') {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Consumer role required.' } });
  }
  next();
}

module.exports = { optionalAuth, requireAuth, requireCreator, requireConsumer };
