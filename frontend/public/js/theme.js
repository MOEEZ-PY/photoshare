// Apply theme immediately to prevent flash
(function () {
  const t = localStorage.getItem('ps_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ps_theme', next);
  _syncThemeBtns();
}

function _syncThemeBtns() {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  document.querySelectorAll('.theme-toggle-btn').forEach(b => {
    b.textContent = light ? '🌙' : '☀️';
    b.title = light ? 'Dark mode' : 'Light mode';
  });
}

document.addEventListener('DOMContentLoaded', _syncThemeBtns);
