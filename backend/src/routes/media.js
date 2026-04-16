'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { optionalAuth, requireAuth, requireCreator } = require('../middleware/auth');
const { mediaUpload } = require('../utils/upload');
const config = require('../config');

const router = express.Router();

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function mediaType(mime) {
  return IMAGE_MIMES.has(mime) ? 'photo' : 'video';
}

function enrichMedia(row) {
  if (!row) return null;
  return {
    ...row,
    people: (() => { try { return JSON.parse(row.people); } catch { return []; } })(),
  };
}

function getMediaWithStats(id) {
  const row = db.prepare(`
    SELECT m.*,
           u.username AS creator_username,
           u.display_name AS creator_display_name,
           ROUND(AVG(r.value), 1) AS avg_rating,
           COUNT(DISTINCT r.id)  AS rating_count,
           COUNT(DISTINCT c.id)  AS comment_count
    FROM media m
    JOIN users u ON u.id = m.creator_id
    LEFT JOIN ratings r ON r.media_id = m.id
    LEFT JOIN comments c ON c.media_id = m.id
    WHERE m.id = ? AND m.deleted_at IS NULL
    GROUP BY m.id
  `).get(id);
  return enrichMedia(row);
}

// GET /api/media/search  (must be before /:id)
router.get('/search', optionalAuth, (req, res) => {
  const { q = '', location = '', person = '', before, limit = '12' } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 12, 50);
  const beforeTs = before ? parseInt(before, 10) : Date.now() + 1;

  // FTS match query
  const ftsQuery = [q, location ? `location:${location}` : ''].filter(Boolean).join(' ');

  let rows;
  if (ftsQuery || person) {
    // Use FTS — person filter done via JSON search in people column
    const ftsFilter = ftsQuery || '*';
    if (person) {
      rows = db.prepare(`
        SELECT m.*,
               u.username AS creator_username,
               u.display_name AS creator_display_name,
               ROUND(AVG(r.value), 1) AS avg_rating,
               COUNT(DISTINCT r.id)   AS rating_count,
               COUNT(DISTINCT c.id)   AS comment_count
        FROM media_fts f
        JOIN media m ON m.id = f.media_id
        JOIN users u ON u.id = m.creator_id
        LEFT JOIN ratings r ON r.media_id = m.id
        LEFT JOIN comments c ON c.media_id = m.id,
        json_each(m.people)
        WHERE media_fts MATCH ?
          AND m.deleted_at IS NULL
          AND m.created_at < ?
          AND json_each.value = ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(ftsFilter, beforeTs, person, lim);
    } else {
      rows = db.prepare(`
        SELECT m.*,
               u.username AS creator_username,
               u.display_name AS creator_display_name,
               ROUND(AVG(r.value), 1) AS avg_rating,
               COUNT(DISTINCT r.id)   AS rating_count,
               COUNT(DISTINCT c.id)   AS comment_count
        FROM media_fts f
        JOIN media m ON m.id = f.media_id
        JOIN users u ON u.id = m.creator_id
        LEFT JOIN ratings r ON r.media_id = m.id
        LEFT JOIN comments c ON c.media_id = m.id
        WHERE media_fts MATCH ?
          AND m.deleted_at IS NULL
          AND m.created_at < ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(ftsFilter, beforeTs, lim);
    }
  } else {
    rows = db.prepare(`
      SELECT m.*,
             u.username AS creator_username,
             u.display_name AS creator_display_name,
             ROUND(AVG(r.value), 1) AS avg_rating,
             COUNT(DISTINCT r.id)   AS rating_count,
             COUNT(DISTINCT c.id)   AS comment_count
      FROM media m
      JOIN users u ON u.id = m.creator_id
      LEFT JOIN ratings r ON r.media_id = m.id
      LEFT JOIN comments c ON c.media_id = m.id
      WHERE m.deleted_at IS NULL AND m.created_at < ?
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(beforeTs, lim);
  }

  res.json({ ok: true, data: rows.map(enrichMedia) });
});

// GET /api/media
router.get('/', optionalAuth, (req, res) => {
  const { before, limit = '12', type, creator_id } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 12, 50);
  const beforeTs = before ? parseInt(before, 10) : Date.now() + 1;

  const typeFilter      = type === 'photo' || type === 'video' ? type : null;
  const creatorFilter   = creator_id || null;

  const args = [beforeTs];
  if (typeFilter)    args.push(typeFilter);
  if (creatorFilter) args.push(creatorFilter);
  args.push(lim);

  const rows = db.prepare(`
    SELECT m.*,
           u.username AS creator_username,
           u.display_name AS creator_display_name,
           ROUND(AVG(r.value), 1) AS avg_rating,
           COUNT(DISTINCT r.id)   AS rating_count,
           COUNT(DISTINCT c.id)   AS comment_count
    FROM media m
    JOIN users u ON u.id = m.creator_id
    LEFT JOIN ratings r ON r.media_id = m.id
    LEFT JOIN comments c ON c.media_id = m.id
    WHERE m.deleted_at IS NULL
      AND m.created_at < ?
      ${typeFilter    ? 'AND m.type = ?'       : ''}
      ${creatorFilter ? 'AND m.creator_id = ?' : ''}
    GROUP BY m.id
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(...args);

  res.json({ ok: true, data: rows.map(enrichMedia) });
});

// GET /api/media/:id
router.get('/:id', optionalAuth, (req, res) => {
  const item = getMediaWithStats(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });
  res.json({ ok: true, data: item });
});

// POST /api/media  (creator only)
router.post('/', requireAuth, requireCreator, (req, res, next) => {
  mediaUpload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ ok: false, error: { code: 'FILE_TOO_LARGE', message: 'File exceeds size limit.' } });
      }
      if (err.code === 'UNSUPPORTED_FILE_TYPE') {
        return res.status(415).json({ ok: false, error: { code: 'UNSUPPORTED_FILE_TYPE', message: err.message } });
      }
      return next(err);
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'file is required.' } });
    }

    const { title, caption = '', location = '', people = '[]' } = req.body || {};
    if (!title) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'title is required.' } });
    }

    // Validate photo size
    const type = mediaType(req.file.mimetype);
    if (type === 'photo' && req.file.size > config.MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return res.status(413).json({ ok: false, error: { code: 'FILE_TOO_LARGE', message: `Photos must be under ${config.MAX_PHOTO_SIZE_MB} MB.` } });
    }

    let parsedPeople;
    try {
      parsedPeople = JSON.stringify(JSON.parse(people));
    } catch {
      parsedPeople = '[]';
    }

    // Build relative filename from absolute path
    const relFilename = path.relative(config.UPLOAD_DIR, req.file.path).replace(/\\/g, '/');

    const now = Date.now();
    const item = {
      id: uuidv4(),
      creator_id: req.user.sub,
      type,
      filename: relFilename,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      title,
      caption,
      location,
      people: parsedPeople,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };

    db.prepare(`
      INSERT INTO media (id, creator_id, type, filename, original_name, mime_type, file_size,
                         title, caption, location, people, deleted_at, created_at, updated_at)
      VALUES (@id, @creator_id, @type, @filename, @original_name, @mime_type, @file_size,
              @title, @caption, @location, @people, @deleted_at, @created_at, @updated_at)
    `).run(item);

    res.status(201).json({ ok: true, data: enrichMedia(getMediaWithStats(item.id)) });
  });
});

// PUT /api/media/:id  (creator, own items)
router.put('/:id', requireAuth, requireCreator, (req, res) => {
  const item = db.prepare('SELECT * FROM media WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });
  if (item.creator_id !== req.user.sub) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not your media.' } });
  }

  const { title, caption, location, people } = req.body || {};
  let parsedPeople = item.people;
  if (people !== undefined) {
    try { parsedPeople = JSON.stringify(JSON.parse(people)); } catch { parsedPeople = '[]'; }
  }

  db.prepare(`
    UPDATE media SET
      title    = ?,
      caption  = ?,
      location = ?,
      people   = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    title ?? item.title,
    caption ?? item.caption,
    location ?? item.location,
    parsedPeople,
    Date.now(),
    item.id
  );

  res.json({ ok: true, data: enrichMedia(getMediaWithStats(item.id)) });
});

// DELETE /api/media/:id  (creator, own items — soft delete)
router.delete('/:id', requireAuth, requireCreator, (req, res) => {
  const item = db.prepare('SELECT * FROM media WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });
  if (item.creator_id !== req.user.sub) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Not your media.' } });
  }

  db.prepare('UPDATE media SET deleted_at = ? WHERE id = ?').run(Date.now(), item.id);

  // Best-effort physical delete
  try {
    fs.unlink(path.join(config.UPLOAD_DIR, item.filename), () => {});
  } catch {}

  res.json({ ok: true, data: { deleted: true } });
});

module.exports = router;
