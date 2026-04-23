/**
 * auth.js — Auth helpers + page guards
 */

function getUser() {
  try { return JSON.parse(localStorage.getItem('ps_user')); } catch { return null; }
}

function getToken() {
  return localStorage.getItem('ps_token');
}

function setSession(token, user) {
  localStorage.setItem('ps_token', token);
  localStorage.setItem('ps_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('ps_token');
  localStorage.removeItem('ps_user');
}

async function login(username, password) {
  const data = await api.post('/auth/login', { username, password });
  setSession(data.token, data.user);
  return data.user;
}

async function register(username, email, password, displayName, role) {
  const data = await api.post('/auth/register', {
    username, email, password, display_name: displayName, role,
  });
  setSession(data.token, data.user);
  return data.user;
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

/** Guard: redirect to login if not authenticated */
function requireAuthGuard() {
  if (!getToken()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/** Guard: redirect if authenticated (for login/register pages) */
function redirectIfLoggedIn() {
  const user = getUser();
  if (!user) return;
  if (user.role === 'creator') window.location.href = '/creator.html';
  else window.location.href = '/consumer.html';
}

/** Guard: creator pages only */
function requireCreatorGuard() {
  const user = getUser();
  if (!user) { window.location.href = '/index.html'; return false; }
  if (user.role !== 'creator') { window.location.href = '/consumer.html'; return false; }
  return true;
}

/** Guard: consumer pages only */
function requireConsumerGuard() {
  const user = getUser();
  if (!user) { window.location.href = '/index.html'; return false; }
  if (user.role !== 'consumer') { window.location.href = '/creator.html'; return false; }
  return true;
}

// Expose globally
window.authHelpers = { login, register, logout, getUser, getToken, setSession, clearSession };
window.requireAuthGuard = requireAuthGuard;
window.redirectIfLoggedIn = redirectIfLoggedIn;
window.requireCreatorGuard = requireCreatorGuard;
window.requireConsumerGuard = requireConsumerGuard;
