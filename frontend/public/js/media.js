requireAuthGuard();

const user       = authHelpers.getUser();
const isConsumer = user?.role === 'consumer';
document.getElementById('user-name').textContent = user?.display_name || user?.username || '';

const params  = new URLSearchParams(window.location.search);
const mediaId = params.get('id');
if (!mediaId) window.location.href = '/consumer.html';

const detail = document.getElementById('media-detail');

let cLastAt = null, cHasMore = true, cLoading = false;

const initial = n => (n||'?')[0].toUpperCase();

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});
}
function fmtDateShort(ts) {
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

// ── Star widget ───────────────────────────────────────────────────────────────
function renderStarWidget(cur) {
  const c = document.getElementById('star-widget');
  if (!c) return;
  c.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement('span');
    s.className = 'star' + (i <= (cur||0) ? ' filled' : '');
    s.textContent = '★'; s.dataset.value = i;
    s.addEventListener('mouseenter', () => c.querySelectorAll('.star').forEach((x,idx) => x.classList.toggle('hover', idx < i)));
    s.addEventListener('mouseleave', () => c.querySelectorAll('.star').forEach(x => x.classList.remove('hover')));
    s.addEventListener('click', async () => {
      if (!isConsumer) return;
      try {
        const d = await api.post(`/media/${mediaId}/ratings`, {value:i});
        document.getElementById('avg-val').textContent = d.avg || '—';
        document.getElementById('rating-count').textContent = d.count ? `(${d.count} ratings)` : '';
        renderStarWidget(d.userRating);
      } catch(err) { alert(err.message); }
    });
    c.appendChild(s);
  }
}

// ── Comment render ────────────────────────────────────────────────────────────
function renderComment(c) {
  const div = document.createElement('div');
  div.className = 'comment fade-up';
  div.id = `comment-${c.id}`;
  const name  = c.display_name || c.username;
  const isOwn = user && c.user_id === user.id;
  div.innerHTML = `
    <div class="c-header">
      <div class="c-author-row">
        <div class="c-av">${escapeHtml(initial(name))}</div>
        <div>
          <div class="c-name">${escapeHtml(name)}</div>
          <div class="c-time">${fmtDate(c.created_at)}</div>
        </div>
      </div>
      ${isOwn ? `<button class="btn btn-ghost btn-sm" onclick="deleteComment('${escapeHtml(c.id)}')">✕ Delete</button>` : ''}
    </div>
    <div class="c-body">${escapeHtml(c.body)}</div>
  `;
  return div;
}

async function deleteComment(commentId) {
  if (!confirm('Delete this comment?')) return;
  try {
    await api.delete(`/comments/${commentId}`);
    document.getElementById(`comment-${commentId}`)?.remove();
  } catch(err) { alert(err.message); }
}
window.deleteComment = deleteComment;

async function loadComments() {
  if (cLoading || !cHasMore) return;
  cLoading = true;
  const list = document.getElementById('comments-list');
  const btn  = document.getElementById('load-more-comments');
  try {
    const qp = new URLSearchParams({limit:'10'});
    if (cLastAt) qp.set('before', cLastAt);
    const comments = await api.get(`/media/${mediaId}/comments?${qp}`);
    if (!comments.length) {
      cHasMore = false;
      if (btn) btn.style.display = 'none';
      if (!list.children.length) list.innerHTML = '<p style="color:var(--text-2);font-size:.88rem;padding:.5rem 0">No comments yet. Be the first!</p>';
    } else {
      comments.forEach(c => list.appendChild(renderComment(c)));
      cLastAt = comments[comments.length-1].created_at;
      if (comments.length < 10) { cHasMore = false; if (btn) btn.style.display = 'none'; }
    }
  } catch(err) { console.error(err); }
  finally { cLoading = false; }
}

// ── Main render ───────────────────────────────────────────────────────────────
async function loadPage() {
  try {
    const [item, ratingData] = await Promise.all([
      api.get(`/media/${mediaId}`),
      api.get(`/media/${mediaId}/ratings`),
    ]);
    document.title = `PhotoBazaar — ${item.title}`;
    const isVid    = item.type === 'video';
    const creator  = item.creator_display_name || item.creator_username;
    const mediaEl  = isVid
      ? `<video controls src="${escapeHtml(item.url || `/uploads/${item.filename}`)}"></video>`
      : `<img src="${escapeHtml(item.url || `/uploads/${item.filename}`)}" alt="${escapeHtml(item.title)}"/>`;

    const peopleTags = Array.isArray(item.people) && item.people.length
      ? item.people.map(p => `<span class="tag">👤 ${escapeHtml(p)}</span>`).join('')
      : '';
    const locTag = item.location ? `<span class="tag tag-loc">📍 ${escapeHtml(item.location)}</span>` : '';

    detail.innerHTML = `
      <div class="detail-media">${mediaEl}</div>
      <div class="detail-body">
        <div class="detail-main">
          <h1 class="detail-title">${escapeHtml(item.title)}</h1>
          <div class="detail-creator">
            <div class="detail-av">${escapeHtml(initial(creator))}</div>
            <div>
              <div class="detail-creator-name">${escapeHtml(creator)}</div>
              <div class="detail-creator-date">${fmtDateShort(item.created_at)} · ${item.type}</div>
            </div>
          </div>
          ${item.caption ? `<div class="detail-caption">${escapeHtml(item.caption)}</div>` : ''}
          ${(locTag||peopleTags) ? `<div class="tags-row">${locTag}${peopleTags}</div>` : ''}

          <div class="comments-wrap">
            <div class="comments-head">
              <h2>Comments</h2>
              <span class="c-count">${item.comment_count}</span>
            </div>
            ${isConsumer ? `
            <div class="c-form">
              <textarea class="form-control" id="comment-body" placeholder="Add a comment…" rows="3"></textarea>
              <div class="c-form-foot">
                <button class="btn btn-primary btn-sm" id="submit-comment">Post</button>
              </div>
            </div>` : ''}
            <div id="comments-list"></div>
            <button class="btn btn-ghost btn-sm" id="load-more-comments" style="width:100%;margin-top:.6rem">Load more comments</button>
          </div>
        </div>

        <div class="detail-sidebar">
          <div class="rating-box">
            <div class="rating-box-label">Average Rating</div>
            <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem">
              <span class="avg-badge">★ <span id="avg-val">${ratingData.avg||'—'}</span></span>
              <span style="font-size:.76rem;color:var(--text-3)" id="rating-count">${ratingData.count ? `(${ratingData.count} ratings)` : ''}</span>
            </div>
            ${isConsumer ? `
            <div class="rating-box-label" style="margin-bottom:.45rem">Your Rating</div>
            <div class="stars" id="star-widget"></div>
            ${ratingData.userRating ? `<button class="btn btn-ghost btn-sm" id="remove-rating-btn" style="margin-top:.65rem;width:100%">Remove my rating</button>` : ''}
            ` : `<div class="stars stars-display" id="star-widget"></div>`}
          </div>
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-2);margin-bottom:.5rem">About this post</div>
          <div style="font-size:.83rem;color:var(--text-2);line-height:1.8">
            <div>📅 ${fmtDateShort(item.created_at)}</div>
            <div>${isVid ? '🎬 Video' : '📷 Photo'}</div>
            ${item.location ? `<div>📍 ${escapeHtml(item.location)}</div>` : ''}
            <div>💬 ${item.comment_count} comments</div>
          </div>
        </div>
      </div>
    `;

    renderStarWidget(ratingData.userRating);

    document.getElementById('remove-rating-btn')?.addEventListener('click', async () => {
      try {
        await api.delete(`/media/${mediaId}/ratings`);
        const d = await api.get(`/media/${mediaId}/ratings`);
        document.getElementById('avg-val').textContent = d.avg || '—';
        document.getElementById('rating-count').textContent = d.count ? `(${d.count} ratings)` : '';
        renderStarWidget(null);
        document.getElementById('remove-rating-btn')?.remove();
      } catch(err) { alert(err.message); }
    });

    document.getElementById('submit-comment')?.addEventListener('click', async () => {
      const body = document.getElementById('comment-body').value.trim();
      if (!body) return;
      try {
        const c = await api.post(`/media/${mediaId}/comments`, {body});
        document.getElementById('comment-body').value = '';
        const list = document.getElementById('comments-list');
        if (list.querySelector('p')) list.innerHTML = '';
        list.prepend(renderComment(c));
        const cc = document.querySelector('.c-count');
        if (cc) cc.textContent = parseInt(cc.textContent||0) + 1;
      } catch(err) { alert(err.message); }
    });

    document.getElementById('load-more-comments').addEventListener('click', loadComments);
    await loadComments();

  } catch(err) {
    detail.innerHTML = `<div class="empty"><div class="empty-icon">😕</div><h3>Post not found</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

loadPage();
