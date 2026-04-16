'use strict';

const express = require('express');
const db      = require('../db/database');
const { requireAuth, requireCreator } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — paginated list for the logged-in creator
router.get('/', requireAuth, requireCreator, (req, res) => {
  const { before, limit = '20' } = req.query;
  const lim      = Math.min(parseInt(limit, 10) || 20, 50);
  const beforeTs = before ? parseInt(before, 10) : Date.now() + 1;

  const rows = db.prepare(`
    SELECT n.*,
           a.username      AS actor_username,
           a.display_name  AS actor_display_name,
           m.title         AS media_title,
           m.filename      AS media_filename,
           m.type          AS media_type
    FROM notifications n
    JOIN users u  ON u.id  = n.user_id
    JOIN users a  ON a.id  = n.actor_id
    JOIN media m  ON m.id  = n.media_id
    WHERE n.user_id = ? AND n.created_at < ?
    ORDER BY n.created_at DESC
    LIMIT ?
  `).all(req.user.sub, beforeTs, lim);

  res.json({ ok: true, data: rows });
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, requireCreator, (req, res) => {
  const row = db.prepare(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL'
  ).get(req.user.sub);
  res.json({ ok: true, data: { count: row.count } });
});

// PUT /api/notifications/read — mark all unread as read
router.put('/read', requireAuth, requireCreator, (req, res) => {
  db.prepare(
    'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL'
  ).run(Date.now(), req.user.sub);
  res.json({ ok: true, data: { marked: true } });
});

module.exports = router;
