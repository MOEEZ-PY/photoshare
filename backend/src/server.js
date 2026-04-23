'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');

// Init DB (side-effects: schema creation + seeding)
require('./db/database');

const authRoutes          = require('./routes/auth');
const mediaRoutes         = require('./routes/media');
const notificationsRoutes = require('./routes/notifications');
const analyzeRoutes        = require('./routes/analyze');
const { commentsRouter, singleCommentRouter, ratingsRouter } = require('./routes/interactions');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);   // exposes GET /api/users/:id
app.use('/api/media', mediaRoutes);

// Comments: GET/POST /api/media/:id/comments
app.use('/api/media', commentsRouter);

// Single comment: DELETE /api/comments/:commentId
app.use('/api/comments', singleCommentRouter);

// Ratings: GET/POST/DELETE /api/media/:id/ratings
app.use('/api/media', ratingsRouter);

// Notifications: GET/PUT /api/notifications
app.use('/api/notifications', notificationsRoutes);

// AI image analysis: POST /api/media/:id/analyze
app.use('/api/media', analyzeRoutes);

// Serve uploaded files (dev mode only — nginx handles /uploads in production)
app.use('/uploads', express.static(config.UPLOAD_DIR, {
  maxAge: '30d',
  immutable: true,
}));

// ─── Error handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(config.PORT, () => {
  console.log(`[server] PhotoBazaar backend listening on port ${config.PORT} (${config.NODE_ENV})`);
});

module.exports = app;
