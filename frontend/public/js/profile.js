requireAuthGuard();

const user   = authHelpers.getUser();
const params = new URLSearchParams(window.location.search);
const creatorId = params.get('id');
if (!creatorId) window.location.href = '/consumer.html';

document.getElementById('user-name-nav').textContent = user?.display_name || user?.username || '';

const initial = n => (n || '?')[0].toUpperCase();

let allMedia = [];

function updateStats() {
  const comments = allMedia.reduce((s, m) => s + (m.comment_count || 0), 0);
  const rated    = allMedia.filter(m => m.avg_rating);
  const avgAll   = rated.length
    ? (rated.reduce((s, m) => s + parseFloat(m.avg_rating), 0) / rated.length).toFixed(1)
    : '—';
  document.getElementById('stat-total').textContent    = allMedia.length;
  document.getElementById('stat-comments').textContent = comments;
  document.getElementById('stat-avg').textContent      = avgAll;
}

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
    const post  = document.createElement('div');
    post.className = 'ig-post';
    post.onclick = () => window.location.href = `/media.html?id=${item.id}`;

    const isVid = item.type === 'video';
    const src   = `/uploads/${escapeHtml(item.filename)}`;
    const thumb = isVid
      ? `<video src="${src}" muted preload="metadata"></video>`
      : `<img src="${src}" alt="${escapeHtml(item.title)}" loading="lazy"/>`;

    post.innerHTML = `
      ${thumb}
      <span class="ig-type-badge">${isVid ? '🎬' : '📷'}</span>
      <div class="ig-post-overlay">
        <div class="ig-overlay-stats">
          <span class="ig-stat">★ ${item.avg_rating || '—'}</span>
          <span class="ig-stat">💬 ${item.comment_count || 0}</span>
        </div>
        <div style="font-size:.78rem;color:rgba(255,255,255,.7);margin-bottom:.5rem;text-align:center;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.title)}</div>
        <a href="/media.html?id=${escapeHtml(item.id)}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation()">View</a>
      </div>
    `;
    grid.appendChild(post);
  });
}

async function loadProfile() {
  try {
    const [creator, mediaItems] = await Promise.all([
      api.get(`/users/${creatorId}`),
      (async () => {
        let before = null, all = [];
        while (true) {
          const p = new URLSearchParams({ limit: '50', creator_id: creatorId });
          if (before) p.set('before', before);
          const items = await api.get(`/media?${p}`);
          all.push(...items);
          if (items.length < 50) break;
          before = items[items.length - 1].created_at;
        }
        return all;
      })(),
    ]);

    document.title = `PhotoShare — ${creator.display_name || creator.username}`;
    document.getElementById('profile-av').textContent     = initial(creator.display_name || creator.username);
    document.getElementById('profile-name').textContent   = creator.display_name || creator.username;
    document.getElementById('profile-handle').textContent = '@' + creator.username;
    document.getElementById('profile-section').style.display = 'block';

    allMedia = mediaItems;
    renderGrid();
    updateStats();
  } catch (err) {
    document.getElementById('ig-grid').innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">😕</div><h3>Profile not found</h3></div>`;
  } finally {
    document.getElementById('table-loading').style.display = 'none';
  }
}

loadProfile();
