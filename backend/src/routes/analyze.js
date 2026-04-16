'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const MIME_MAP = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

// POST /api/media/:id/analyze
router.post('/:id/analyze', requireAuth, async (req, res) => {
  if (!config.ANTHROPIC_API_KEY || config.ANTHROPIC_API_KEY === 'your_api_key_here') {
    return res.status(503).json({ ok: false, error: { code: 'NO_API_KEY', message: 'ANTHROPIC_API_KEY is not configured.' } });
  }

  const row = db.prepare(
    'SELECT filename, type FROM media WHERE id = ? AND deleted_at IS NULL'
  ).get(req.params.id);

  if (!row) {
    return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Media not found.' } });
  }

  if (row.type === 'video') {
    return res.status(422).json({ ok: false, error: { code: 'NOT_IMAGE', message: 'AI analysis is only available for images.' } });
  }

  const filePath = path.join(config.UPLOAD_DIR, row.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: { code: 'FILE_NOT_FOUND', message: 'Image file not found on disk.' } });
  }

  const ext = path.extname(row.filename).toLowerCase();
  const mediaType = MIME_MAP[ext] || 'image/jpeg';
  const base64 = fs.readFileSync(filePath).toString('base64');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: 'Describe this image in 2-3 sentences. Mention the subject, mood, and any notable details. Be concise and engaging.',
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || `Claude API error ${response.status}`;
      return res.status(502).json({ ok: false, error: { code: 'CLAUDE_ERROR', message: msg } });
    }

    const data = await response.json();
    const description = data.content?.[0]?.text || '';
    res.json({ ok: true, data: { description } });

  } catch (err) {
    console.error('[analyze]', err);
    res.status(502).json({ ok: false, error: { code: 'NETWORK_ERROR', message: 'Failed to reach Claude API.' } });
  }
});

module.exports = router;
