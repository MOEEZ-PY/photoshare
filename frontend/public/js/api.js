/**
 * api.js — Fetch wrapper
 * Auto-attaches Bearer token, normalises response envelope, redirects on 401.
 */

const BASE = '/api';

function getToken() {
  return localStorage.getItem('ps_token');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('ps_token');
    localStorage.removeItem('ps_user');
    window.location.href = '/index.html';
    return;
  }

  const data = await res.json().catch(() => ({ ok: false, error: { code: 'PARSE_ERROR', message: 'Invalid JSON response.' } }));

  if (!data.ok) {
    const err = new Error(data.error?.message || 'API error');
    err.code = data.error?.code;
    err.status = res.status;
    throw err;
  }

  return data.data;
}

const api = {
  get:    (path, opts = {})         => apiFetch(path, { method: 'GET', ...opts }),
  post:   (path, body, opts = {})   => apiFetch(path, { method: 'POST',   body: body instanceof FormData ? body : JSON.stringify(body), ...opts }),
  put:    (path, body, opts = {})   => apiFetch(path, { method: 'PUT',    body: JSON.stringify(body), ...opts }),
  delete: (path, opts = {})         => apiFetch(path, { method: 'DELETE', ...opts }),
};

// Expose globally
window.api = api;
window.escapeHtml = escapeHtml;
