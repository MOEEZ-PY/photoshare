'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

function safeUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'username and password required.' } });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } });
  }

  res.json({ ok: true, data: { token: makeToken(user), user: safeUser(user) } });
});

// POST /api/auth/register  (consumers only)
router.post('/register', (req, res) => {
  const { username, email, password, display_name } = req.body || {};
  if (!username || !email || !password || !display_name) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'username, email, password, display_name required.' } });
  }

  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' } });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'Username or email already taken.' } });
  }

  const user = {
    id: uuidv4(),
    username,
    email,
    password_hash: bcrypt.hashSync(password, 12),
    role: 'consumer', // hardcoded; creators cannot self-register
    display_name,
    created_at: Date.now(),
  };

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, display_name, created_at)
    VALUES (@id, @username, @email, @password_hash, @role, @display_name, @created_at)
  `).run(user);

  res.status(201).json({ ok: true, data: { token: makeToken(user), user: safeUser(user) } });
});

// GET /api/users/:id  (public profile info)
router.get('/users/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, display_name, role, bio, location, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
  res.json({ ok: true, data: user });
});

// PUT /api/auth/me  (update own profile)
router.put('/me', requireAuth, (req, res) => {
  const { bio, location, display_name } = req.body || {};
  const fields = [];
  const vals   = [];
  if (display_name !== undefined) { fields.push('display_name = ?'); vals.push(display_name.trim().slice(0, 60)); }
  if (bio          !== undefined) { fields.push('bio = ?');          vals.push(bio.trim().slice(0, 200)); }
  if (location     !== undefined) { fields.push('location = ?');     vals.push(location.trim().slice(0, 80)); }
  if (!fields.length) return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Nothing to update.' } });
  vals.push(req.user.sub);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  const updated = db.prepare('SELECT id, username, display_name, role, bio, location, created_at FROM users WHERE id = ?').get(req.user.sub);
  res.json({ ok: true, data: updated });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user) {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
  }
  res.json({ ok: true, data: safeUser(user) });
});

module.exports = router;
