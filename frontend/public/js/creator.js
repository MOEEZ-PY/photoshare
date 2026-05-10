requireCreatorGuard();

const user = authHelpers.getUser();
const initial = n => (n||'?')[0].toUpperCase();

// Profile header
document.getElementById('user-name-nav').textContent = user?.display_name || user?.username || '';
document.getElementById('profile-name').textContent = user?.display_name || user?.username || '';
document.getElementById('profile-handle').textContent = '@' + (user?.username || '');
document.getElementById('profile-av').textContent = initial(user?.display_name || user?.username);

let allMedia = [];

function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

// ── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  const comments = allMedia.reduce((s,m) => s+(m.comment_count||0), 0);
  const ratings  = allMedia.filter(m => m.avg_rating);
  const avgAll   = ratings.length ? (ratings.reduce((s,m) => s+parseFloat(m.avg_rating),0)/ratings.length).toFixed(1) : '—';
  document.getElementById('stat-total').textContent    = allMedia.length;
  document.getElementById('stat-comments').textContent = comments;
  document.getElementById('stat-avg').textContent      = avgAll;
}

// ── Instagram grid render ────────────────────────────────────────────────────
function renderGrid() {
  const grid  = document.getElementById('ig-grid');
  const empty = document.getElementById('table-empty');
  grid.innerHTML = '';

  if (!allMedia.length) {
    empty.style.display = 'block';
    grid.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  grid.style.display  = 'grid';

  allMedia.forEach(item => {
    const post = document.createElement('div');
    post.className = 'ig-post';
    post.id = `post-${item.id}`;

    const isVid = item.type === 'video';
    const src   = escapeHtml(item.url);
    const thumb = isVid
      ? `<video src="${src}" muted preload="metadata"></video>`
      : `<img src="${src}" alt="${escapeHtml(item.title)}" loading="lazy"/>`;

    post.innerHTML = `
      ${thumb}
      <span class="ig-type-badge">${isVid ? '🎬' : '📷'}</span>
      <div class="ig-post-overlay">
        <div class="ig-overlay-stats">
          <span class="ig-stat">★ ${item.avg_rating || '—'}</span>
          <span class="ig-stat">💬 ${item.comment_count||0}</span>
        </div>
        <div style="font-size:.78rem;color:rgba(255,255,255,.7);margin-bottom:.5rem;text-align:center;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.title)}</div>
        <div class="ig-post-actions">
          <a href="/media.html?id=${escapeHtml(item.id)}" class="btn btn-ghost btn-sm" target="_blank" onclick="event.stopPropagation()">View</a>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openEdit('${escapeHtml(item.id)}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteMedia('${escapeHtml(item.id)}')">Delete</button>
        </div>
      </div>
    `;
    grid.appendChild(post);
  });
}

async function loadMedia() {
  document.getElementById('table-loading').style.display = 'block';
  try {
    let before = null;
    allMedia = [];
    while (true) {
      const p = new URLSearchParams({limit:'50'});
      if (before) p.set('before', before);
      const items = await api.get(`/media?${p}`);
      allMedia.push(...items.filter(m => m.creator_id === user.id));
      if (items.length < 50) break;
      before = items[items.length-1].created_at;
    }
    renderGrid();
    updateStats();
  } catch(err) {
    console.error('Load error', err);
  } finally {
    document.getElementById('table-loading').style.display = 'none';
  }
}

// ── Upload modal ─────────────────────────────────────────────────────────────
const uploadModal  = document.getElementById('upload-modal');
const dropZone     = document.getElementById('drop-zone');
const fileInput    = document.getElementById('file-input');
const previewCont  = document.getElementById('preview-container');
const previewImg   = document.getElementById('preview-img');
const previewVideo = document.getElementById('preview-video');

document.getElementById('show-upload-btn').addEventListener('click', () => uploadModal.classList.add('open'));
document.getElementById('close-upload-modal').addEventListener('click', closeUpload);
document.getElementById('cancel-upload-btn').addEventListener('click', closeUpload);

function closeUpload() {
  uploadModal.classList.remove('open');
  document.getElementById('upload-form').reset();
  previewCont.style.display = 'none';
  previewImg.style.display  = 'none';
  previewVideo.style.display = 'none';
  document.getElementById('alert-upload').style.display  = 'none';
  document.getElementById('alert-success').style.display = 'none';
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) showPreview(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) showPreview(fileInput.files[0]); });

function showPreview(file) {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('image/')) {
    previewImg.src = url; previewImg.style.display = 'block';
    previewVideo.style.display = 'none';
  } else {
    previewVideo.src = url; previewVideo.style.display = 'block';
    previewImg.style.display = 'none';
  }
  previewCont.style.display = 'block';
  const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files;
}

document.getElementById('upload-form').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl   = document.getElementById('alert-upload');
  const successEl = document.getElementById('alert-success');
  alertEl.style.display = successEl.style.display = 'none';

  const file = fileInput.files[0];
  if (!file) {
    document.getElementById('alert-upload-msg').textContent = 'Please select a file.';
    alertEl.style.display = 'flex'; return;
  }
  const title = document.getElementById('up-title').value.trim();
  if (!title) {
    document.getElementById('alert-upload-msg').textContent = 'Title is required.';
    alertEl.style.display = 'flex'; return;
  }

  const peopleRaw = document.getElementById('up-people').value.trim();
  const peopleArr = peopleRaw ? peopleRaw.split(',').map(p=>p.trim()).filter(Boolean) : [];

  const fd = new FormData();
  fd.append('file', file);
  fd.append('title', title);
  fd.append('caption', document.getElementById('up-caption').value.trim());
  fd.append('location', document.getElementById('up-location').value.trim());
  fd.append('people', JSON.stringify(peopleArr));

  const btn = document.getElementById('upload-btn');
  btn.disabled = true; btn.textContent = 'Uploading…';

  try {
    await api.post('/media', fd);
    document.getElementById('alert-success-msg').textContent = 'Post shared successfully!';
    successEl.style.display = 'flex';
    document.getElementById('upload-form').reset();
    previewCont.style.display = previewImg.style.display = previewVideo.style.display = 'none';
    await loadMedia();
    setTimeout(closeUpload, 1200);
  } catch(err) {
    document.getElementById('alert-upload-msg').textContent = err.message || 'Upload failed.';
    alertEl.style.display = 'flex';
  } finally {
    btn.disabled = false; btn.textContent = 'Share Post';
  }
});

// ── Edit modal ────────────────────────────────────────────────────────────────
const editModal = document.getElementById('edit-modal');
document.getElementById('close-edit-modal').addEventListener('click', () => editModal.classList.remove('open'));
document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.classList.remove('open'));

function openEdit(id) {
  const item = allMedia.find(m => m.id === id);
  if (!item) return;
  document.getElementById('edit-id').value      = item.id;
  document.getElementById('edit-title').value   = item.title;
  document.getElementById('edit-caption').value = item.caption || '';
  document.getElementById('edit-location').value= item.location || '';
  document.getElementById('edit-people').value  = Array.isArray(item.people) ? item.people.join(', ') : '';
  document.getElementById('alert-edit').style.display = 'none';
  editModal.classList.add('open');
}
window.openEdit = openEdit;

document.getElementById('edit-form').addEventListener('submit', async e => {
  e.preventDefault();
  const alertEl = document.getElementById('alert-edit');
  alertEl.style.display = 'none';
  const id = document.getElementById('edit-id').value;
  const peopleRaw = document.getElementById('edit-people').value.trim();
  const peopleArr = peopleRaw ? peopleRaw.split(',').map(p=>p.trim()).filter(Boolean) : [];
  try {
    await api.put(`/media/${id}`, {
      title:    document.getElementById('edit-title').value.trim(),
      caption:  document.getElementById('edit-caption').value.trim(),
      location: document.getElementById('edit-location').value.trim(),
      people:   JSON.stringify(peopleArr),
    });
    editModal.classList.remove('open');
    await loadMedia();
  } catch(err) {
    document.getElementById('alert-edit-msg').textContent = err.message || 'Update failed.';
    alertEl.style.display = 'flex';
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteMedia(id) {
  if (!confirm('Delete this post permanently?')) return;
  try {
    await api.delete(`/media/${id}`);
    // Remove from DOM immediately
    const el = document.getElementById(`post-${id}`);
    if (el) el.remove();
    // Update local state
    allMedia = allMedia.filter(m => m.id !== id);
    updateStats();
    if (!allMedia.length) {
      document.getElementById('ig-grid').style.display = 'none';
      document.getElementById('table-empty').style.display = 'block';
    }
  } catch(err) {
    alert(err.message);
  }
}
window.deleteMedia = deleteMedia;

loadMedia();

// ── Notifications ─────────────────────────────────────────────────────────────
const notifBell     = document.getElementById('notif-bell');
const notifBadge    = document.getElementById('notif-badge');
const notifPanel    = document.getElementById('notif-panel');
const notifBackdrop = document.getElementById('notif-backdrop');
const notifList     = document.getElementById('notif-list');
const notifEmpty    = document.getElementById('notif-empty');
const notifLoading  = document.getElementById('notif-loading');
const notifLoadMore = document.getElementById('notif-load-more');

let notifLastAt = null, notifHasMore = true, notifFetching = false;

function notifTimeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function renderNotif(n) {
  const actor = n.actor_display_name || n.actor_username;
  const msg   = n.type === 'like'
    ? `<strong>${escapeHtml(actor)}</strong> liked your post`
    : `<strong>${escapeHtml(actor)}</strong> commented on your post`;
  const thumb = n.media_type === 'video'
    ? `<video src="${escapeHtml(n.media_url)}" muted preload="metadata" class="notif-thumb"></video>`
    : `<img src="${escapeHtml(n.media_url)}" class="notif-thumb" alt=""/>`;

  const div = document.createElement('div');
  div.className = 'notif-item' + (n.read_at ? '' : ' unread');
  div.onclick = () => window.open(`/media.html?id=${escapeHtml(n.media_id)}`, '_blank');
  div.innerHTML = `
    <div class="notif-av">${escapeHtml((actor||'?')[0].toUpperCase())}</div>
    <div class="notif-body">
      <div class="notif-msg">${msg} <span class="notif-title">"${escapeHtml(n.media_title)}"</span></div>
      <div class="notif-time">${notifTimeAgo(n.created_at)}</div>
    </div>
    <div class="notif-thumb-wrap">${thumb}</div>
    ${n.read_at ? '' : '<div class="notif-dot"></div>'}
  `;
  return div;
}

async function fetchNotifications(reset = false) {
  if (notifFetching || (!notifHasMore && !reset)) return;
  if (reset) {
    notifLastAt = null; notifHasMore = true;
    notifList.querySelectorAll('.notif-item').forEach(el => el.remove());
  }
  notifFetching = true;
  notifLoading.style.display = 'block';
  notifLoadMore.style.display = 'none';
  try {
    const p = new URLSearchParams({ limit: '15' });
    if (notifLastAt) p.set('before', notifLastAt);
    const items = await api.get(`/notifications?${p}`);
    if (!items.length) {
      notifHasMore = false;
      if (!notifList.querySelectorAll('.notif-item').length) notifEmpty.style.display = 'block';
    } else {
      notifEmpty.style.display = 'none';
      items.forEach(n => notifList.appendChild(renderNotif(n)));
      notifLastAt = items[items.length - 1].created_at;
      if (items.length === 15) notifLoadMore.style.display = 'block';
    }
  } catch (err) { console.error(err); }
  finally { notifFetching = false; notifLoading.style.display = 'none'; }
}

async function refreshBadge() {
  try {
    const { count } = await api.get('/notifications/unread-count');
    if (count > 0) {
      notifBadge.textContent = count > 99 ? '99+' : count;
      notifBadge.style.display = 'flex';
    } else {
      notifBadge.style.display = 'none';
    }
  } catch { /* silent */ }
}

function openPanel() {
  notifPanel.classList.add('open');
  notifBackdrop.classList.add('open');
  fetchNotifications(true);
  setTimeout(async () => {
    try {
      await api.put('/notifications/read');
      notifBadge.style.display = 'none';
      notifPanel.querySelectorAll('.notif-item.unread').forEach(el => {
        el.classList.remove('unread');
        el.querySelector('.notif-dot')?.remove();
      });
    } catch { /* silent */ }
  }, 1200);
}

function closePanel() {
  notifPanel.classList.remove('open');
  notifBackdrop.classList.remove('open');
}

notifBell.addEventListener('click', () =>
  notifPanel.classList.contains('open') ? closePanel() : openPanel());
notifBackdrop.addEventListener('click', closePanel);

document.getElementById('notif-mark-read').addEventListener('click', async () => {
  try {
    await api.put('/notifications/read');
    notifBadge.style.display = 'none';
    notifPanel.querySelectorAll('.notif-item.unread').forEach(el => {
      el.classList.remove('unread');
      el.querySelector('.notif-dot')?.remove();
    });
  } catch { /* silent */ }
});

notifLoadMore.addEventListener('click', () => fetchNotifications());

refreshBadge();
setInterval(refreshBadge, 30000);
