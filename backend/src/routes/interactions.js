'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { optionalAuth, requireAuth, requireConsumer } = require('../middleware/auth');

// ── Comments router  (mounted at /api/media) ─────────────────────────────────
// Routes: GET/POST /api/media/:id/comments
const commentsRouter = express.Router({ mergeParams: true });

commentsRouter.get('/:id/comments', optionalAuth, (req, res) => {
  const { before, limit = '20' } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const beforeTs = before ? parseInt(before, 10) : Date.now() + 1;

  const exists = db.prepare('SELECT id FROM media WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!exists) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });

  const comments = db.prepare(`
    SELECT c.*, u.username, u.display_name
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.media_id = ? AND c.created_at < ?
    ORDER BY c.created_at DESC
    LIMIT ?
  `).all(req.params.id, beforeTs, lim);

  res.json({ ok: true, data: comments });
});

commentsRouter.post('/:id/comments', requireAuth, requireConsumer, (req, res) => {
  const { body } = req.body || {};
  if (!body || body.length < 1 || body.length > 2000) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Comment body must be 1–2000 characters.' } });
  }

  const media = db.prepare('SELECT id FROM media WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!media) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });

  const comment = {
    id: uuidv4(),
    media_id: req.params.id,
    user_id: req.user.sub,
    body,
    created_at: Date.now(),
  };

  db.prepare(`
    INSERT INTO comments (id, media_id, user_id, body, created_at)
    VALUES (@id, @media_id, @user_id, @body, @created_at)
  `).run(comment);

  // Notify creator (skip if creator commented on own post)
  const mediaRow = db.prepare('SELECT creator_id FROM media WHERE id = ?').get(req.params.id);
  if (mediaRow && mediaRow.creator_id !== req.user.sub) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, actor_id, media_id, created_at)
      VALUES (?, ?, 'comment', ?, ?, ?)
    `).run(uuidv4(), mediaRow.creator_id, req.user.sub, req.params.id, Date.now());
  }

  const row = db.prepare(`
    SELECT c.*, u.username, u.display_name
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(comment.id);

  res.status(201).json({ ok: true, data: row });
});

// ── Single comment router  (mounted at /api/comments) ────────────────────────
// Route: DELETE /api/comments/:commentId
const singleCommentRouter = express.Router();

singleCommentRouter.delete('/:commentId', requireAuth, requireConsumer, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.commentId);
  if (!comment) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Comment not found.' } });
  if (comment.user_id !== req.user.sub) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not your comment.' } });
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  res.json({ ok: true, data: { deleted: true } });
});

// ── Ratings router  (mounted at /api/media) ──────────────────────────────────
// Routes: GET/POST/DELETE /api/media/:id/ratings
const ratingsRouter = express.Router({ mergeParams: true });

ratingsRouter.get('/:id/ratings', optionalAuth, (req, res) => {
  const media = db.prepare('SELECT id FROM media WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!media) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });

  const agg = db.prepare(`
    SELECT ROUND(AVG(value), 1) AS avg, COUNT(*) AS count
    FROM ratings WHERE media_id = ?
  `).get(req.params.id);

  let userRating = null;
  if (req.user) {
    const r = db.prepare('SELECT value FROM ratings WHERE media_id = ? AND user_id = ?').get(req.params.id, req.user.sub);
    userRating = r?.value ?? null;
  }

  res.json({ ok: true, data: { avg: agg.avg, count: agg.count, userRating } });
});

ratingsRouter.post('/:id/ratings', requireAuth, requireConsumer, (req, res) => {
  const value = parseInt(req.body?.value, 10);
  if (!value || value < 1 || value > 5) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Rating value must be 1–5.' } });
  }

  const media = db.prepare('SELECT id FROM media WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!media) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });

  const existing = db.prepare('SELECT id FROM ratings WHERE media_id = ? AND user_id = ?').get(req.params.id, req.user.sub);

  if (existing) {
    db.prepare('UPDATE ratings SET value = ?, created_at = ? WHERE id = ?').run(value, Date.now(), existing.id);
  } else {
    db.prepare(`
      INSERT INTO ratings (id, media_id, user_id, value, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), req.params.id, req.user.sub, value, Date.now());

    // Notify creator on first-time like only (skip self-like)
    const mediaRow = db.prepare('SELECT creator_id FROM media WHERE id = ?').get(req.params.id);
    if (mediaRow && mediaRow.creator_id !== req.user.sub) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, actor_id, media_id, created_at)
        VALUES (?, ?, 'like', ?, ?, ?)
      `).run(uuidv4(), mediaRow.creator_id, req.user.sub, req.params.id, Date.now());
    }
  }

  const agg = db.prepare('SELECT ROUND(AVG(value),1) AS avg, COUNT(*) AS count FROM ratings WHERE media_id = ?').get(req.params.id);
  res.json({ ok: true, data: { avg: agg.avg, count: agg.count, userRating: value } });
});

ratingsRouter.delete('/:id/ratings', requireAuth, requireConsumer, (req, res) => {
  const r = db.prepare('SELECT id FROM ratings WHERE media_id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!r) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Rating not found.' } });
  db.prepare('DELETE FROM ratings WHERE id = ?').run(r.id);
  res.json({ ok: true, data: { deleted: true } });
});

module.exports = { commentsRouter, singleCommentRouter, ratingsRouter };
