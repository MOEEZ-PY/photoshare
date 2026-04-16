requireConsumerGuard();

const user = authHelpers.getUser();

// ── State ─────────────────────────────────────────────────────────────────────
let feedLastAt = null, feedLoading = false, feedHasMore = true;
let reelsLastAt = null, reelsLoading = false, reelsHasMore = true;
let searchLastAt = null, searchLoading = false, searchHasMore = true;
let nvLastAt = null, nvLoading = false, nvHasMore = true;
let storiesRendered = false;
let suggestedRendered = false;

const likedPosts = new Set(JSON.parse(localStorage.getItem('ps_liked') || '[]'));
const savedPosts = new Set(JSON.parse(localStorage.getItem('ps_saved') || '[]'));

const initial = n => (n || '?')[0].toUpperCase();
function saveLikes() { localStorage.setItem('ps_liked', JSON.stringify([...likedPosts])); }
function saveSaved() { localStorage.setItem('ps_saved', JSON.stringify([...savedPosts])); }

function fmtTimeAgo(ts) {
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function avatarColor(id) {
  const p = ['#E1306C','#833AB4','#F77737','#405DE6','#FCAF45','#FD1D1D','#12B886','#56CCF2','#F2994A','#6FCF97'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return p[Math.abs(h) % p.length];
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
const heartSvg = f => `<svg width="26" height="26" viewBox="0 0 24 24"
  fill="${f?'#E1306C':'none'}" stroke="${f?'#E1306C':'currentColor'}" stroke-width="2">
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
</svg>`;
const commentSvg = () => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const sendSvg    = () => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const bookmarkSvg = f => `<svg width="26" height="26" viewBox="0 0 24 24" fill="${f?'#fff':'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

// ── Sidebar / right-panel user info ──────────────────────────────────────────
(function initUserInfo() {
  const name   = user?.display_name || user?.username || '';
  const handle = '@' + (user?.username || '');
  const col    = user?.id ? avatarColor(user.id) : '#833AB4';

  // Sidebar bottom user
  const sbAv = document.getElementById('ps-sidebar-av');
  if (sbAv) { sbAv.textContent = initial(name); sbAv.style.background = col; }
  const sbName = document.getElementById('ps-sidebar-name');
  if (sbName) sbName.textContent = name;
  const sbHandle = document.getElementById('ps-sidebar-handle');
  if (sbHandle) sbHandle.textContent = handle;

  // Right panel user
  const rpAv = document.getElementById('ps-right-av');
  if (rpAv) { rpAv.textContent = initial(name); rpAv.style.background = col; }
  const rpName = document.getElementById('ps-right-name');
  if (rpName) rpName.textContent = name;
  const rpHandle = document.getElementById('ps-right-handle');
  if (rpHandle) rpHandle.textContent = handle;

  // Profile view
  const pvAv = document.getElementById('pv-av');
  if (pvAv) { pvAv.textContent = initial(name); pvAv.style.background = col; }
  const pvName = document.getElementById('pv-name');
  if (pvName) pvName.textContent = name;
  const pvHandle = document.getElementById('pv-handle');
  if (pvHandle) pvHandle.textContent = handle;

  // Pre-fill edit fields
  const editName = document.getElementById('pv-edit-name');
  if (editName) editName.value = user?.display_name || '';
  const editBio  = document.getElementById('pv-edit-bio');
  if (editBio)  editBio.value = user?.bio || '';
  const editLoc  = document.getElementById('pv-edit-location');
  if (editLoc)  editLoc.value = user?.location || '';
})();

// ── Profile edit ──────────────────────────────────────────────────────────────
async function saveProfile() {
  const btn     = document.getElementById('pv-save-btn');
  const alertEl = document.getElementById('pv-alert');
  const succEl  = document.getElementById('pv-success');
  alertEl.style.display = succEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const updated = await api.put('/auth/me', {
      display_name: document.getElementById('pv-edit-name').value.trim(),
      bio:          document.getElementById('pv-edit-bio').value.trim(),
      location:     document.getElementById('pv-edit-location').value.trim(),
    });
    // Update stored user + UI
    const stored = authHelpers.getUser();
    Object.assign(stored, updated);
    localStorage.setItem('ps_user', JSON.stringify(stored));
    document.getElementById('pv-name').textContent       = updated.display_name || updated.username;
    document.getElementById('ps-sidebar-name').textContent = updated.display_name || updated.username;
    document.getElementById('ps-right-name').textContent   = updated.display_name || updated.username;
    succEl.style.display = 'block';
    setTimeout(() => succEl.style.display = 'none', 2500);
  } catch (err) {
    alertEl.textContent   = err.message || 'Update failed.';
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}
window.saveProfile = saveProfile;

// ── Stories ───────────────────────────────────────────────────────────────────
function renderStories(items) {
  if (storiesRendered) return;
  storiesRendered = true;
  const seen = new Map();
  items.forEach(item => { if (!seen.has(item.creator_id)) seen.set(item.creator_id, item); });
  const creators = [...seen.values()].slice(0, 12);
  const me = user?.display_name || user?.username || 'You';
  const row = document.getElementById('stories-row');
  row.innerHTML = `
    <div class="story-item">
      <div class="story-self-ring">
        <div class="story-av" style="background:linear-gradient(45deg,#833AB4,#E1306C)">${escapeHtml(initial(me))}</div>
      </div>
      <span class="story-label">${escapeHtml(me.split(' ')[0])}</span>
    </div>
    ${creators.map(c => {
      const name = c.creator_display_name || c.creator_username;
      return `<div class="story-item" onclick="window.location='/profile.html?id=${escapeHtml(c.creator_id)}'">
        <div class="story-ring">
          <div class="story-av" style="background:${avatarColor(c.creator_id)}">${escapeHtml(initial(name))}</div>
        </div>
        <span class="story-label">${escapeHtml(c.creator_username)}</span>
      </div>`;
    }).join('')}`;
}

// ── Suggested creators (right panel) ─────────────────────────────────────────
function renderSuggested(items) {
  if (suggestedRendered) return;
  suggestedRendered = true;
  const seen = new Map();
  items.forEach(item => { if (!seen.has(item.creator_id)) seen.set(item.creator_id, item); });
  const creators = [...seen.values()].slice(0, 5);
  const el = document.getElementById('ps-suggested');
  if (!el || !creators.length) return;
  el.innerHTML = creators.map(c => {
    const name = c.creator_display_name || c.creator_username;
    const col  = avatarColor(c.creator_id);
    return `
      <div class="ps-suggested-row">
        <a href="/profile.html?id=${escapeHtml(c.creator_id)}" class="ps-sugg-av-link">
          <div class="ps-sugg-av" style="background:${col}">${escapeHtml(initial(name))}</div>
        </a>
        <div class="ps-sugg-info">
          <a href="/profile.html?id=${escapeHtml(c.creator_id)}" class="ps-sugg-name">${escapeHtml(name)}</a>
          <div class="ps-sugg-sub">Creator</div>
        </div>
        <a href="/profile.html?id=${escapeHtml(c.creator_id)}" class="ps-follow-btn">View</a>
      </div>`;
  }).join('');
}

// ── Post card ─────────────────────────────────────────────────────────────────
function renderPost(post) {
  const isVid   = post.type === 'video';
  const src     = `/uploads/${escapeHtml(post.filename)}`;
  const creator = post.creator_display_name || post.creator_username;
  const col     = avatarColor(post.creator_id);
  const isLiked = likedPosts.has(post.id);
  const isSaved = savedPosts.has(post.id);
  const pid     = escapeHtml(post.id);
  const cid     = escapeHtml(post.creator_id);

  const div = document.createElement('div');
  div.className = 'ps-post';
  div.id = `post-${post.id}`;
  div.innerHTML = `
    <div class="ps-post-header">
      <a href="/profile.html?id=${cid}" class="insta-av-link" onclick="event.stopPropagation()">
        <div class="insta-av-ring">
          <div class="insta-av" style="background:${col};width:40px;height:40px;font-size:14px">${escapeHtml(initial(creator))}</div>
        </div>
      </a>
      <div class="insta-post-info">
        <a href="/profile.html?id=${cid}" class="insta-username" onclick="event.stopPropagation()">${escapeHtml(creator)}</a>
        ${post.location ? `<div class="insta-location">${escapeHtml(post.location)}</div>` : ''}
      </div>
      <button class="insta-more-btn" onclick="event.stopPropagation()">⋯</button>
    </div>
    <div class="ps-post-media" onclick="window.location='/media.html?id=${pid}'">
      ${isVid
        ? `<video src="${src}" muted preload="metadata"></video>`
        : `<img src="${src}" alt="${escapeHtml(post.title)}" loading="lazy"/>`}
    </div>
    <div class="ps-post-body">
      <div class="insta-actions-row" style="padding:0 0 10px">
        <div style="display:flex;gap:16px;align-items:center">
          <button class="insta-btn" id="like-btn-${pid}" onclick="toggleLike('${pid}')">${heartSvg(isLiked)}</button>
          <button class="insta-btn" onclick="window.location='/media.html?id=${pid}'">${commentSvg()}</button>
          <button class="insta-btn" onclick="navigator.share&&navigator.share({url:location.origin+'/media.html?id=${pid}'})">${sendSvg()}</button>
        </div>
        <button class="insta-btn" id="save-btn-${pid}" onclick="toggleSave('${pid}')">${bookmarkSvg(isSaved)}</button>
        ${!isVid ? `<button class="insta-btn ai-btn" onclick="analyzePost('${pid}')" title="AI describe">✨</button>` : ''}
      </div>
      ${post.avg_rating
        ? `<div class="ps-likes">★ <strong>${post.avg_rating}</strong> avg · ${post.comment_count||0} comment${post.comment_count!==1?'s':''}</div>`
        : (post.comment_count ? `<div class="ps-likes">${post.comment_count} comment${post.comment_count!==1?'s':''}</div>` : '')}
      <div class="ps-caption">
        <a href="/profile.html?id=${cid}" class="insta-cap-user" onclick="event.stopPropagation()">${escapeHtml(creator)}</a>
        ${escapeHtml(post.title)}${post.caption?' '+escapeHtml(post.caption):''}
      </div>
      ${post.comment_count
        ? `<div class="insta-view-comments" onclick="window.location='/media.html?id=${pid}'">View all ${post.comment_count} comment${post.comment_count!==1?'s':''}</div>`
        : ''}
      <div class="insta-time">${fmtTimeAgo(post.created_at)}</div>
    </div>`;
  return div;
}

// ── Like / Save ───────────────────────────────────────────────────────────────
async function toggleLike(id) {
  const btn = document.getElementById(`like-btn-${id}`);
  if (!btn) return;
  const was = likedPosts.has(id);
  was ? likedPosts.delete(id) : likedPosts.add(id);
  saveLikes();
  btn.innerHTML = heartSvg(!was);
  try {
    if (!was) await api.post(`/media/${id}/ratings`, { value: 5 });
    else      await api.delete(`/media/${id}/ratings`);
  } catch {
    was ? likedPosts.add(id) : likedPosts.delete(id);
    saveLikes();
    btn.innerHTML = heartSvg(was);
  }
}
window.toggleLike = toggleLike;

function toggleSave(id) {
  const btn = document.getElementById(`save-btn-${id}`);
  if (!btn) return;
  savedPosts.has(id) ? savedPosts.delete(id) : savedPosts.add(id);
  saveSaved();
  btn.innerHTML = bookmarkSvg(savedPosts.has(id));
}
window.toggleSave = toggleSave;

// ── AI Image Analysis ─────────────────────────────────────────────────────────
async function analyzePost(id) {
  const modal   = document.getElementById('ai-modal');
  const spinner = document.getElementById('ai-spinner');
  const body    = document.getElementById('ai-body');
  const errEl   = document.getElementById('ai-error');

  spinner.style.display = 'flex';
  body.textContent      = '';
  errEl.style.display   = 'none';
  modal.classList.add('open');

  try {
    const data = await api.post(`/media/${id}/analyze`, {});
    body.textContent = data.description;
  } catch (err) {
    errEl.textContent   = err.message || 'Analysis failed.';
    errEl.style.display = 'block';
  } finally {
    spinner.style.display = 'none';
  }
}
window.analyzePost = analyzePost;

// ── Feed ──────────────────────────────────────────────────────────────────────
const postsList    = document.getElementById('posts-list');
const feedLoadEl   = document.getElementById('feed-loading');
const emptyEl      = document.getElementById('empty-state');

async function loadFeed() {
  if (feedLoading || !feedHasMore) return;
  feedLoading = true; feedLoadEl.style.display = 'block';
  try {
    const p = new URLSearchParams({ limit: '12' });
    if (feedLastAt) p.set('before', feedLastAt);
    const items = await api.get(`/media?${p}`);
    if (!items.length) {
      feedHasMore = false;
      if (!postsList.children.length) emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      if (!storiesRendered) renderStories(items);
      if (!suggestedRendered) renderSuggested(items);
      items.forEach(item => postsList.appendChild(renderPost(item)));
      feedLastAt = items[items.length - 1].created_at;
    }
  } catch (e) { console.error(e); }
  finally { feedLoading = false; feedLoadEl.style.display = 'none'; }
}

// ── Reels (videos only) ───────────────────────────────────────────────────────
const reelsList   = document.getElementById('reels-list');
const reelsLoadEl = document.getElementById('reels-loading');
const reelsEmpty  = document.getElementById('reels-empty');

async function loadReels() {
  if (reelsLoading || !reelsHasMore) return;
  reelsLoading = true; reelsLoadEl.style.display = 'block';
  try {
    const p = new URLSearchParams({ limit: '12', type: 'video' });
    if (reelsLastAt) p.set('before', reelsLastAt);
    const items = await api.get(`/media?${p}`);
    if (!items.length) {
      reelsHasMore = false;
      if (!reelsList.children.length) reelsEmpty.style.display = 'block';
    } else {
      reelsEmpty.style.display = 'none';
      items.forEach(item => reelsList.appendChild(renderPost(item)));
      reelsLastAt = items[items.length - 1].created_at;
    }
  } catch (e) { console.error(e); }
  finally { reelsLoading = false; reelsLoadEl.style.display = 'none'; }
}

// ── Search ────────────────────────────────────────────────────────────────────
const searchResultsEl = document.getElementById('search-results');
const searchLoadEl    = document.getElementById('search-loading');

async function runSearch() {
  searchResultsEl.innerHTML = ''; searchLastAt = null; searchHasMore = true;
  await loadSearchMore();
}
async function loadSearchMore() {
  if (searchLoading || !searchHasMore) return;
  searchLoading = true; searchLoadEl.style.display = 'block';
  try {
    const q  = document.getElementById('search-q').value.trim();
    const lo = document.getElementById('search-location').value.trim();
    const pe = document.getElementById('search-person').value.trim();
    const p  = new URLSearchParams({ limit: '12' });
    if (searchLastAt) p.set('before', searchLastAt);
    if (q)  p.set('q', q);
    if (lo) p.set('location', lo);
    if (pe) p.set('person', pe);
    const items = await api.get(`/media/search?${p}`);
    if (!items.length) {
      searchHasMore = false;
      if (!searchResultsEl.children.length)
        searchResultsEl.innerHTML = '<div style="text-align:center;padding:2rem;color:#555;font-size:.88rem">No results found.</div>';
    } else {
      items.forEach(item => searchResultsEl.appendChild(renderPost(item)));
      searchLastAt = items[items.length - 1].created_at;
    }
  } catch (e) { console.error(e); }
  finally { searchLoading = false; searchLoadEl.style.display = 'none'; }
}

// ── Notifications view ────────────────────────────────────────────────────────
const nvList    = document.getElementById('nv-list');
const nvLoadEl  = document.getElementById('nv-loading');
const nvEmpty   = document.getElementById('nv-empty');
const nvLoadMore = document.getElementById('nv-load-more');

function notifTimeAgo(ts) { return fmtTimeAgo(ts); }

function renderNvItem(n) {
  const actor = n.actor_display_name || n.actor_username;
  const msg   = n.type === 'like'
    ? `<strong>${escapeHtml(actor)}</strong> liked your post`
    : `<strong>${escapeHtml(actor)}</strong> commented on your post`;
  const thumb = n.media_type === 'video'
    ? `<video src="/uploads/${escapeHtml(n.media_filename)}" muted preload="metadata" class="notif-thumb"></video>`
    : `<img src="/uploads/${escapeHtml(n.media_filename)}" class="notif-thumb" alt=""/>`;
  const div = document.createElement('div');
  div.className = 'notif-item' + (n.read_at ? '' : ' unread');
  div.onclick = () => window.location.href = `/media.html?id=${escapeHtml(n.media_id)}`;
  div.innerHTML = `
    <div class="notif-av">${escapeHtml((actor||'?')[0].toUpperCase())}</div>
    <div class="notif-body">
      <div class="notif-msg">${msg} <span class="notif-title">"${escapeHtml(n.media_title)}"</span></div>
      <div class="notif-time">${notifTimeAgo(n.created_at)}</div>
    </div>
    <div class="notif-thumb-wrap">${thumb}</div>
    ${n.read_at ? '' : '<div class="notif-dot"></div>'}`;
  return div;
}

async function loadNv(reset = false) {
  if (nvLoading || (!nvHasMore && !reset)) return;
  if (reset) { nvLastAt = null; nvHasMore = true; nvList.querySelectorAll('.notif-item').forEach(e => e.remove()); }
  nvLoading = true; nvLoadEl.style.display = 'block'; nvLoadMore.style.display = 'none';
  try {
    const p = new URLSearchParams({ limit: '20' });
    if (nvLastAt) p.set('before', nvLastAt);
    const items = await api.get(`/notifications?${p}`);
    if (!items.length) {
      nvHasMore = false;
      if (!nvList.querySelectorAll('.notif-item').length) nvEmpty.style.display = 'block';
    } else {
      nvEmpty.style.display = 'none';
      items.forEach(n => nvList.appendChild(renderNvItem(n)));
      nvLastAt = items[items.length - 1].created_at;
      if (items.length === 20) nvLoadMore.style.display = 'block';
    }
    // Mark all read after opening
    setTimeout(async () => {
      try {
        await api.put('/notifications/read');
        updateBadge(0);
        nvList.querySelectorAll('.notif-item.unread').forEach(el => {
          el.classList.remove('unread');
          el.querySelector('.notif-dot')?.remove();
        });
      } catch {}
    }, 1000);
  } catch (e) { console.error(e); }
  finally { nvLoading = false; nvLoadEl.style.display = 'none'; }
}
nvLoadMore?.addEventListener('click', () => loadNv());

// ── Badge ─────────────────────────────────────────────────────────────────────
function updateBadge(count) {
  const badge = document.getElementById('ps-notif-badge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.style.display = 'flex'; }
  else           { badge.style.display = 'none'; }
}

async function refreshBadge() {
  try {
    const { count } = await api.get('/notifications/unread-count');
    updateBadge(count);
  } catch {}
}

// ── Tab switching ─────────────────────────────────────────────────────────────
const viewMap = {
  home:    'feed-view',
  search:  'search-view',
  reels:   'reels-view',
  notif:   'notif-view',
  profile: 'profile-view',
};

function switchTab(tab) {
  Object.values(viewMap).forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = 'none';
  });
  const view = document.getElementById(viewMap[tab]);
  if (view) view.style.display = 'block';

  // Sync sidebar + mobile nav active state
  document.querySelectorAll('.ps-nav-item, .insta-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  if (tab === 'home'   && !postsList.children.length)  loadFeed();
  if (tab === 'reels'  && !reelsList.children.length)   loadReels();
  if (tab === 'notif')                                   loadNv(true);
}

// Sidebar nav
document.querySelectorAll('.ps-nav-item').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// Mobile bottom nav
document.querySelectorAll('.insta-nav-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// Search
document.getElementById('search-btn').addEventListener('click', runSearch);
document.getElementById('search-q').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
document.getElementById('clear-btn').addEventListener('click', () => {
  ['search-q','search-location','search-person'].forEach(id => document.getElementById(id).value = '');
  searchResultsEl.innerHTML = '';
});

// Infinite scroll — feed
new IntersectionObserver(e => { if (e[0].isIntersecting) loadFeed(); }, { rootMargin: '400px' })
  .observe(document.getElementById('scroll-sentinel'));

// Infinite scroll — reels
new IntersectionObserver(e => { if (e[0].isIntersecting) loadReels(); }, { rootMargin: '400px' })
  .observe(document.getElementById('reels-sentinel'));

// Init
loadFeed();
refreshBadge();
setInterval(refreshBadge, 30000);
