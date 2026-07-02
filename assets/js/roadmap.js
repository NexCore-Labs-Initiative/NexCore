"use strict";

(() => {
  const roadmapLocale = document.documentElement.lang.toLowerCase().startsWith("ar") ? "ar" : "en";
  const roadmapText = (english, arabic) => roadmapLocale === "ar" ? arabic : english;

function getAnonFingerprint() {
  const KEY = 'nexcore_anon_fp';
  let fp = localStorage.getItem(KEY);
  if (!fp || fp.length < 8) {
    fp = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(KEY, fp);
  }
  return fp;
}

const state = {
  currentTab:      'roadmap',
  statusFilter:    'all',
  user:            null,
  isAdmin:         false,
  features:        [],
  pendingFeatures: [],
  userVotes:       new Set(),
  anonFingerprint: getAnonFingerprint(),
  anonVotes:       new Set(),
  commentsByFeature: {},
  activeFeatureId: null,
  expandedFeatureId: null,
  editingFeatureId: null,
  pendingConfirmAction: null,
  pendingConfirmLabel: roadmapText("Delete", "حذف"),
};

// ── HELPERS ────────────────────────────────────────────────
const db = window.supabaseClient;
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

function isMobileCommentsFallback() {
  return window.matchMedia('(max-width: 639px)').matches;
}

function normalizeStatusLabel(status) {
  const labels = { planned: roadmapText("Planned", "مخطط"), in_progress: roadmapText("In Progress", "قيد التنفيذ"), completed: roadmapText("Completed", "مكتمل") };
  return labels[status] || status;
}

// ── ADMIN STATUS MANAGEMENT ───────────────────────────────
async function checkAdminStatus() {
  if (!state.user) return false;
  try {
    const { data, error } = await db.rpc('get_my_admin_status');
    if (error) {
      console.warn('Admin check failed:', error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn('Admin check exception:', e);
    return false;
  }
}

// ── INIT ───────────────────────────────────────────────────
async function init() {
  if (!db) {
    console.error('Supabase client is unavailable. Check script loading order.');
    showToast(roadmapText("Roadmap is temporarily unavailable.", "تم تعطيل خريطة الطريق مؤقتاً."), '<i class="fa-solid fa-triangle-exclamation"></i>');
    return;
  }

  // Footer year
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  // Auth session
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    state.user = session.user;
    await loadUserVotes();
    state.isAdmin = await checkAdminStatus();
  }
  renderAuthNav();

  db.auth.onAuthStateChange(async (event, session) => {
    state.user = session?.user ?? null;
    if (state.user) {
      await loadUserVotes();
      state.isAdmin = await checkAdminStatus();
    } else {
      state.userVotes.clear();
      state.isAdmin = false;
    }
    renderAuthNav();
    await loadFeatures();
  });

  // Bind everything
  bindTabs();
  bindFilters();
  bindFAB();
  bindModalClosers();
  bindAuthModal();
  bindSuggestModal();
  bindCommentsModal();
  bindCommentActions();
  bindConfirmModal();
  bindReveal();
  window.addEventListener('resize', () => {
    if (isMobileCommentsFallback() && state.expandedFeatureId) {
      state.expandedFeatureId = null;
      renderFeatures();
    }
  });

  // Load data
  loadAnonVotes();
  await loadFeatures();
}

// ── REVEAL OBSERVER ────────────────────────────────────────
function bindReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  $$('.reveal').forEach(el => obs.observe(el));
}

// ── NAV DROPDOWN (core-menu dots) ──────────────────────────
function bindNavDropdown() {
  const menu = $('#coreMenu');
  const drop = $('#myDropdown');
  if (!menu || !drop) return;

  menu.addEventListener('click', () => {
    menu.classList.toggle('active');
    const isOpen = menu.classList.contains('active');
    drop.style.visibility = isOpen ? 'visible' : 'hidden';
    drop.style.opacity    = isOpen ? '1' : '0';
    drop.style.transform  = isOpen ? 'translateY(10px)' : 'translateY(0)';
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !drop.contains(e.target)) {
      menu.classList.remove('active');
      drop.style.visibility = 'hidden';
      drop.style.opacity    = '0';
      drop.style.transform  = 'translateY(0)';
    }
  });
}

// ── AUTH NAV ───────────────────────────────────────────────
function renderAuthNav() {
  const suggestBtn = $('#fab-suggest');
  const pendingTabBtn = $('#pending-tab-btn');
  if (!suggestBtn) return;
  suggestBtn.title = state.user
    ? roadmapText("Suggest a feature", "اقترح ميزة")
    : roadmapText("Suggest anonymously", "اقترح بشكل مجهول");
  if (pendingTabBtn) {
    pendingTabBtn.classList.toggle('hidden', !state.isAdmin);
    if (!state.isAdmin && state.currentTab === 'pending') {
      state.currentTab = 'roadmap';
      $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'roadmap'));
    }
  }
}

async function handleSignOut() {
  await db.auth.signOut();
  showToast(roadmapText("Signed out successfully.", "تم تسجيل الخروج بنجاح."), '<i class="fa-solid fa-right-from-bracket"></i>');
}

// ── AUTH MODAL ─────────────────────────────────────────────
function openAuthModal() {
  openModal('auth-modal');
}

function bindAuthModal() {
  $('#google-signin-btn')?.addEventListener('click', async () => {
    const btn = $('#google-signin-btn');
    const txt = $('#google-btn-text');
    const errEl = $('#auth-error');
    errEl?.classList.add('hidden');
    btn.disabled = true;
    if (txt) txt.textContent = roadmapText("Redirecting…", "يتم التحويل…");

    try {
      sessionStorage.setItem('auth_mode', 'login');
      const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${roadmapText("/dashboard.html", "/ar/dashboard.html")}`
        }
      });
      if (error) throw error;
    } catch (error) {
      showFormError(errEl, error?.message || roadmapText("Failed to sign in with Google.", "فشل تسجيل الدخول مع Google."));
      btn.disabled = false;
      if (txt) txt.textContent = roadmapText("Continue with Google", "المتابعة بواسطة جوجل");
    }
  });
}

// ── FEATURES ──────────────────────────────────────────────
async function loadFeatures() {
  showSkeleton(true);

  if (state.currentTab === 'pending') {
    showSkeleton(false);
    state.pendingFeatures = await loadPendingFeatures();
    state.features = [];
    renderFeatures();
    updateStats();
    return;
  }

  let query = db.from('features').select(`
    id, title, description, status, votes_count, created_at, created_by,
    feature_comments(count)
  `);

  if (state.currentTab === 'roadmap') {
    query = query.neq('status', 'completed');
  } else {
    query = query.eq('status', 'completed');
  }

  if (state.currentTab === 'roadmap' && state.statusFilter !== 'all') {
    query = query.eq('status', state.statusFilter);
  }

  const orderCol = state.currentTab === 'implemented' ? 'created_at' : 'votes_count';
  query = query.order(orderCol, { ascending: false });

  const { data, error } = await query;

  showSkeleton(false);

  if (error) {
    console.error('Error loading features:', error);
    showToast(roadmapText("Failed to load features.", "فشل تحميل الميزات."), '<i class="fa-solid fa-triangle-exclamation"></i>');
    return;
  }

  state.features = data || [];
  updateStats();
  renderFeatures();
}

async function loadPendingFeatures() {
  if (!state.isAdmin) return [];
  const { data, error } = await db.rpc('get_pending_suggestions');
  if (error) {
    console.warn('Pending suggestions fetch failed:', error.message);
    return [];
  }
  return data || [];
}

async function loadUserVotes() {
  if (!state.user) return;
  const { data } = await db
    .from('feature_votes')
    .select('feature_id')
    .eq('user_id', state.user.id);
  state.userVotes = new Set((data || []).map(v => v.feature_id));
}

function loadAnonVotes() {
  const raw = localStorage.getItem('nexcore_anon_votes');
  state.anonVotes = new Set(raw ? JSON.parse(raw) : []);
}

function saveAnonVotes() {
  localStorage.setItem('nexcore_anon_votes', JSON.stringify([...state.anonVotes]));
}

function renderFeatures() {
  const list  = $('#features-list');
  const empty = $('#empty-state');
  // Clear everything except skeleton (already hidden)
  $$('.feature-card', list).forEach(c => c.remove());

  if (state.currentTab === 'pending') {
    const pending = state.pendingFeatures || [];
    if (!pending.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    pending.forEach((feature, i) => {
      const card = buildPendingCard(feature, i);
      list.appendChild(card);
    });
    bindReveal();
    return;
  }

  if (state.expandedFeatureId && !state.features.some(f => f.id === state.expandedFeatureId)) {
    state.expandedFeatureId = null;
  }

  if (!state.features.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  state.features.forEach((feature, i) => {
    const card = buildCard(feature, i);
    list.appendChild(card);
  });

  // Re-observe new cards for reveal
  bindReveal();
}

function buildCard(feature, index) {
  const voted        = state.user ? state.userVotes.has(feature.id) : state.anonVotes.has(feature.id);
  const commentCount = Number(feature.feature_comments?.[0]?.count ?? 0);
  const statusLabel  = normalizeStatusLabel(feature.status);
  const date         = new Date(feature.created_at).toLocaleDateString(roadmapText("en-US", "ar-OM"), { month: 'short', day: 'numeric', year: 'numeric' });
  const isExpanded   = !isMobileCommentsFallback() && state.expandedFeatureId === feature.id;
  const isOwner      = !!state.user && feature.created_by === state.user.id;

  const card = document.createElement('div');
  card.className = `feature-card reveal${isExpanded ? ' expanded' : ''}`;
  card.dataset.id = feature.id;
  card.style.animationDelay = `${index * 45}ms`;

  card.innerHTML = `
    <div class="card-vote">
      <button
        class="vote-btn${voted ? ' voted' : ''}"
        data-id="${feature.id}"
        aria-label="${voted ? roadmapText("Remove vote", "إزالة التصويت") : roadmapText("Upvote this feature", "صوّت لهذه الميزة")}"
        title="${state.user ? (voted ? roadmapText("Remove vote", "إزالة التصويت") : roadmapText("Upvote this feature", "صوّت لهذه الميزة")) : roadmapText("Vote as guest", "صوّت كضيف")}"
      >
        <i class="fa-solid fa-chevron-up"></i>
      </button>
      <span class="vote-count" id="vc-${feature.id}">${feature.votes_count}</span>
      ${!state.user ? roadmapText("<span class=\"guest-vote-label\">guest vote</span>", "<span class=\"guest-vote-label\">تصويت ضيف</span>") : ''}
    </div>
    <div class="card-body">
      <h3 class="card-title">${escHtml(feature.title)}</h3>
      <p class="card-desc">${escHtml(feature.description || '')}</p>
      <div class="card-footer">
        <div class="card-meta">
          <span class="badge badge--${feature.status}">${statusLabel}</span>
          ${isOwner ? `
          <div class="owner-actions">
            <button class="owner-action-btn" data-owner-edit="${feature.id}${roadmapText("\" title=\"Edit your suggestion\">\n              <i class=\"fa-regular fa-pen-to-square\"></i> Edit\n            </button>\n            <button class=\"owner-action-btn\" data-owner-delete=\"", "\" title=\"عدّل اقتراحك\">\n              <i class=\"fa-regular fa-pen-to-square\"></i> تعديل\n            </button>\n            <button class=\"owner-action-btn\" data-owner-delete=\"")}${feature.id}${roadmapText("\" title=\"Delete your suggestion\">\n              <i class=\"fa-regular fa-trash-can\"></i> Delete\n            </button>\n          </div>", "\" title=\"احذف اقتراحك\">\n              <i class=\"fa-regular fa-trash-can\"></i> حذف\n            </button>\n          </div>")}` : ''}
        </div>
        <div class="card-actions">
          <button class="comment-chip" data-id="${feature.id}${roadmapText("\" title=\"View comments\">\n            <i class=\"fa-regular fa-comment\"></i> <span class=\"comment-count\" id=\"cc-", "\" title=\"عرض التعليقات\">\n            <i class=\"fa-regular fa-comment\"></i> <span class=\"comment-count\" id=\"cc-")}${feature.id}">${commentCount}</span>
          </button>
          <button class="expand-btn" data-id="${feature.id}${roadmapText("\" aria-label=\"Expand feature details\">\n            <i class=\"fa-solid fa-chevron-down\"></i>\n          </button>\n          <span class=\"card-date\">", "\" aria-label=\"توسيع تفاصيل الميزة\">\n            <i class=\"fa-solid fa-chevron-down\"></i>\n          </button>\n          <span class=\"card-date\">")}${date}</span>
        </div>
      </div>
      ${state.isAdmin ? `${roadmapText("\n      <div class=\"admin-controls\">\n        <i class=\"fa-solid fa-crown\" style=\"color:#f5a623;font-size:11px;\"></i>\n        <span class=\"admin-label\">Set status:</span>\n        <div class=\"admin-status-btns\">\n          <button class=\"status-pick ", "\n      <div class=\"admin-controls\">\n        <i class=\"fa-solid fa-crown\" style=\"color:#f5a623;font-size:11px;\"></i>\n        <span class=\"admin-label\">تعيين الحالة:</span>\n        <div class=\"admin-status-btns\">\n          <button class=\"status-pick ")}${feature.status === 'planned' ? 'active' : ''}" data-id="${feature.id}${roadmapText("\" data-status=\"planned\">Planned</button>\n          <button class=\"status-pick ", "\" data-status=\"planned\">مخطط</button>\n          <button class=\"status-pick ")}${feature.status === 'in_progress' ? 'active' : ''}" data-id="${feature.id}${roadmapText("\" data-status=\"in_progress\">In Progress</button>\n          <button class=\"status-pick ", "\" data-status=\"in_progress\">قيد التنفيذ</button>\n          <button class=\"status-pick ")}${feature.status === 'completed' ? 'active' : ''}" data-id="${feature.id}${roadmapText("\" data-status=\"completed\">Completed</button>\n        </div>\n      </div>", "\" data-status=\"completed\">مكتمل</button>\n        </div>\n      </div>")}` : ''}
    </div>
    <div class="feature-details" id="details-${feature.id}">
      <div class="feature-details-inner">
        <p class="feature-full-desc">${escHtml(feature.description || roadmapText("No extra details provided yet.", "لا توجد تفاصيل إضافية بعد."))}${roadmapText("</p>\n        <div class=\"feature-meta-row\">\n          <span class=\"meta-pill\"><i class=\"fa-regular fa-calendar\"></i> Suggested on ", "</p>\n        <div class=\"feature-meta-row\">\n          <span class=\"meta-pill\"><i class=\"fa-regular fa-calendar\"></i> اقتُرحت في ")}${date}</span>
          <span class="meta-pill" id="meta-votes-${feature.id}"><i class="fa-solid fa-chevron-up"></i> ${feature.votes_count}${roadmapText(" votes</span>\n          <span class=\"badge badge--", " تصويت</span>\n          <span class=\"badge badge--")}${feature.status}" id="detail-status-${feature.id}">${statusLabel}${roadmapText("</span>\n        </div>\n        <div class=\"inline-comments\">\n          <div class=\"inline-comments-head\">\n            <span><i class=\"fa-solid fa-comments text-accent\"></i> Comments</span>\n            <span class=\"badge-pill\" id=\"inline-count-", "</span>\n        </div>\n        <div class=\"inline-comments\">\n          <div class=\"inline-comments-head\">\n            <span><i class=\"fa-solid fa-comments text-accent\"></i> التعليقات</span>\n            <span class=\"badge-pill\" id=\"inline-count-")}${feature.id}">${commentCount}</span>
          </div>
          <div class="inline-comments-list" id="inline-comments-${feature.id}${roadmapText("\">\n            <div class=\"comments-loading\"><i class=\"fa-solid fa-circle-notch fa-spin\"></i> Loading comments…</div>\n          </div>\n          ", "\">\n            <div class=\"comments-loading\"><i class=\"fa-solid fa-circle-notch fa-spin\"></i> جار تحميل التعليقات...</div>\n          </div>\n          ")}${state.user ? `
          <div class="inline-comments-compose">
            <textarea class="form-input form-textarea" id="inline-comment-input-${feature.id}${roadmapText("\" placeholder=\"Write a comment… (Ctrl+Enter to post)\" rows=\"2\"></textarea>\n            <button class=\"btn primary\" id=\"inline-comment-btn-", "\" placeholder=\"اكتب تعليقًا... (Ctrl+Enter للنشر)\" rows=\"2\"></textarea>\n            <button class=\"btn primary\" id=\"inline-comment-btn-")}${feature.id}" data-id="${feature.id}${roadmapText("\" style=\"padding:10px 16px;white-space:nowrap;\">Post</button>\n          </div>", "\" style=\"padding:10px 16px;white-space:nowrap;\">إرسال</button>\n          </div>")}` : `${roadmapText("\n          <div class=\"inline-auth-nudge anon-comment-block\">\n            <i class=\"fa-solid fa-lock text-accent\"></i>\n            <span>Sign in to comment</span>\n            <button class=\"btn ghost inline-signin-btn\" data-id=\"", "\n          <div class=\"inline-auth-nudge anon-comment-block\">\n            <i class=\"fa-solid fa-lock text-accent\"></i>\n            <span>سجّل الدخول للتعليق</span>\n            <button class=\"btn ghost inline-signin-btn\" data-id=\"")}${feature.id}${roadmapText("\" style=\"padding:6px 14px;font-size:13px;\">Sign In</button>\n          </div>", "\" style=\"padding:6px 14px;font-size:13px;\">تسجيل الدخول</button>\n          </div>")}`}
        </div>
      </div>
    </div>
  `;

  card.querySelector('.vote-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    handleVote(feature.id);
  });

  card.querySelector('.comment-chip').addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMobileCommentsFallback()) {
      openComments(feature.id, feature.title);
      return;
    }
    toggleFeatureExpand(feature.id, true);
  });

  card.querySelector('.expand-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMobileCommentsFallback()) {
      openComments(feature.id, feature.title);
      return;
    }
    toggleFeatureExpand(feature.id);
  });

  card.querySelector('.card-body').addEventListener('click', (e) => {
    if (e.target.closest('button, select, textarea, input, a, label')) return;
    if (isMobileCommentsFallback()) {
      openComments(feature.id, feature.title);
      return;
    }
    toggleFeatureExpand(feature.id);
  });

  if (state.isAdmin) {
    card.querySelectorAll('.status-pick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateFeatureStatus(feature.id, btn.dataset.status);
      });
    });
  }

  card.querySelector(`[data-owner-edit="${feature.id}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    openSuggestModalForEdit(feature.id);
  });
  card.querySelector(`[data-owner-delete="${feature.id}"]`)?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteOwnFeature(feature.id);
  });

  card.querySelector('.inline-signin-btn')?.addEventListener('click', () => openAuthModal());
  card.querySelector(`#inline-comment-btn-${feature.id}`)?.addEventListener('click', () => submitInlineComment(feature.id));
  card.querySelector(`#inline-comment-input-${feature.id}`)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitInlineComment(feature.id);
  });

  if (isExpanded) {
    requestAnimationFrame(() => {
      setExpandedState(card, true, false);
      loadInlineComments(feature.id);
    });
  }

  return card;
}

function buildPendingCard(feature, index) {
  const card = document.createElement('div');
  card.className = 'feature-card pending-card reveal';
  card.dataset.id = feature.id;
  card.style.animationDelay = `${index * 45}ms`;
  const submitterName = escHtml(feature.submitter_name || '');
  const submitterEmail = escHtml(feature.submitter_email || '');

  card.innerHTML = `
    <div class="card-body" style="grid-column:1 / -1;">
      <div class="card-footer">
        <h3 class="card-title">${escHtml(feature.title)}${roadmapText("</h3>\n        <span class=\"badge badge--pending\">Pending</span>\n      </div>\n      <p class=\"card-desc\" style=\"-webkit-line-clamp: unset;\">", "</h3>\n        <span class=\"badge badge--pending\">قيد المراجعة</span>\n      </div>\n      <p class=\"card-desc\" style=\"-webkit-line-clamp: unset;\">")}${escHtml(feature.description || '')}</p>
      ${feature.submitter_name || feature.submitter_email ? `
      <p class="submitter-info">
        <i class="fa-solid fa-user"></i>
        ${submitterName} ${feature.submitter_email ? `&lt;${submitterEmail}&gt;` : ''}
      </p>` : roadmapText("<p class=\"submitter-info\">Anonymous submission</p>", "<p class=\"submitter-info\">إرسال مجهول</p>")}
      <div class="pending-actions">
        <button class="btn primary" data-approve="${feature.id}${roadmapText("\">\n          <i class=\"fa-solid fa-check\"></i> Approve\n        </button>\n        <button class=\"btn ghost\" data-reject=\"", "\">\n          <i class=\"fa-solid fa-check\"></i> قبول\n        </button>\n        <button class=\"btn ghost\" data-reject=\"")}${feature.id}${roadmapText("\" style=\"border-color:rgba(255,120,120,0.35);color:#ff9a9a;\">\n          <i class=\"fa-solid fa-xmark\"></i> Reject\n        </button>\n      </div>\n    </div>\n  ", "\" style=\"border-color:rgba(255,120,120,0.35);color:#ff9a9a;\">\n          <i class=\"fa-solid fa-xmark\"></i> رفض\n        </button>\n      </div>\n    </div>\n  ")}`;

  card.querySelector(`[data-approve="${feature.id}"]`)?.addEventListener('click', () => moderateSuggestion(feature.id, true));
  card.querySelector(`[data-reject="${feature.id}"]`)?.addEventListener('click', () => moderateSuggestion(feature.id, false));
  return card;
}

// ── EXPANDABLE CARDS ──────────────────────────────────────
function setExpandedState(card, expanded, animate = true) {
  const details = $('.feature-details', card);
  if (!details) return;

  card.classList.toggle('expanded', expanded);
  if (!expanded) {
    details.style.maxHeight = '0px';
    return;
  }

  if (!animate) {
    details.style.maxHeight = 'none';
    return;
  }

  details.style.maxHeight = `${details.scrollHeight}px`;
}

function refreshExpandedHeight(featureId) {
  const card = $(`.feature-card[data-id="${featureId}"]`);
  if (!card || !card.classList.contains('expanded')) return;
  const details = $('.feature-details', card);
  if (!details) return;
  details.style.maxHeight = `${details.scrollHeight}px`;
}

function toggleFeatureExpand(featureId, forceOpen = false) {
  if (isMobileCommentsFallback()) return;
  const card = $(`.feature-card[data-id="${featureId}"]`);
  if (!card) return;
  const shouldOpen = forceOpen || state.expandedFeatureId !== featureId;

  if (!shouldOpen) {
    setExpandedState(card, false);
    state.expandedFeatureId = null;
    return;
  }

  if (state.expandedFeatureId && state.expandedFeatureId !== featureId) {
    const prev = $(`.feature-card[data-id="${state.expandedFeatureId}"]`);
    if (prev) setExpandedState(prev, false);
  }

  state.expandedFeatureId = featureId;
  setExpandedState(card, true);
  loadInlineComments(featureId);
}

// ── ADMIN STATUS MANAGEMENT ───────────────────────────────
function removeFeatureFromCurrentView(featureId) {
  const idx = state.features.findIndex(f => f.id === featureId);
  if (idx === -1) return;
  state.features.splice(idx, 1);
  if (state.expandedFeatureId === featureId) state.expandedFeatureId = null;
  const card = $(`.feature-card[data-id="${featureId}"]`);
  if (!card) {
    renderFeatures();
    updateStats();
    return;
  }
  card.classList.add('removing');
  setTimeout(() => {
    card.remove();
    if (!state.features.length) $('#empty-state')?.classList.remove('hidden');
    updateStats();
  }, 250);
}

async function updateFeatureStatus(featureId, newStatus) {
  if (!state.isAdmin) return;
  const statusLabels = { planned: roadmapText("Planned", "مخطط"), in_progress: roadmapText("In Progress", "قيد التنفيذ"), completed: roadmapText("Completed", "مكتمل") };

  const feature = state.features.find(f => f.id === featureId);
  if (!feature) return;
  const prevStatus = feature.status;

  // Optimistic: update badge immediately
  const badge = document.querySelector(`.feature-card[data-id="${featureId}"] .badge`);
  if (badge) {
    badge.className = `badge badge--${newStatus}`;
    badge.textContent = statusLabels[newStatus];
  }
  const detailBadge = document.querySelector(`#detail-status-${featureId}`);
  if (detailBadge) {
    detailBadge.className = `badge badge--${newStatus}`;
    detailBadge.textContent = statusLabels[newStatus];
  }

  // Highlight active button
  document.querySelectorAll(`.status-pick[data-id="${featureId}"]`).forEach(b => {
    b.classList.toggle('active', b.dataset.status === newStatus);
  });

  const { error } = await db
    .from('features')
    .update({ status: newStatus })
    .eq('id', featureId);

  if (error) {
    feature.status = prevStatus;
    showToast(roadmapText("Failed to update status.", "فشل تحديث الحالة."), '<i class="fa-solid fa-xmark"></i>');
    await loadFeatures();
    return;
  }

  // Update local state
  feature.status = newStatus;

  const shouldRemove =
    (state.currentTab === 'roadmap' && newStatus === 'completed') ||
    (state.currentTab === 'implemented' && newStatus !== 'completed') ||
    (state.currentTab === 'roadmap' && state.statusFilter !== 'all' && newStatus !== state.statusFilter);

  if (shouldRemove) {
    const card = document.querySelector(`.feature-card[data-id="${featureId}"]`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.97)';
      card.style.transition = 'all 0.4s ease';
      setTimeout(() => {
        card.remove();
        state.features = state.features.filter(f => f.id !== featureId);
        if (!state.features.length) $('#empty-state')?.classList.remove('hidden');
        updateStats();
      }, 420);
    }
  }

  showToast(`${roadmapText("Status updated to ", "تم تحديث الحالة إلى ")}${statusLabels[newStatus]}`, '<i class="fa-solid fa-crown" style="color:#f5a623"></i>');
  updateStats();
}

async function moderateSuggestion(featureId, approve) {
  const { error } = await db.rpc('moderate_suggestion', {
    p_feature_id: featureId,
    p_approve: approve
  });
  if (error) {
    showToast(roadmapText("Action failed.", "فشل الإجراء."), '<i class="fa-solid fa-xmark"></i>');
    return;
  }
  showToast(
    approve ? roadmapText("Suggestion approved and now live!", "تم قبول الاقتراح وأصبح ظاهرًا الآن!") : roadmapText("Suggestion rejected.", "تم رفض الاقتراح."),
    approve ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-trash-can"></i>'
  );

  const card = document.querySelector(`.feature-card[data-id="${featureId}"]`);
  if (card) {
    card.style.opacity = '0';
    card.style.transition = 'opacity 0.3s ease';
    setTimeout(() => card.remove(), 320);
  }
  state.pendingFeatures = state.pendingFeatures.filter((f) => f.id !== featureId);
  if (!state.pendingFeatures.length && state.currentTab === 'pending') {
    $('#empty-state')?.classList.remove('hidden');
  }
  if (approve) {
    await loadFeatures();
  }
  updateStats();
}

async function updateStats() {
  const { data } = await db.from('features').select('status,votes_count');
  if (!data) return;
  const total = data.length;
  const votes = data.reduce((s, f) => s + Number(f.votes_count || 0), 0);
  const counts = { planned: 0, in_progress: 0, completed: 0 };
  data.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

  const animateStat = (selector, value) => {
    const element = $(selector);
    if (!element) return;
    window.CountUp.animate(element, {
      end: value,
      format: (current) => window.CountUp.formatInteger(current, roadmapText("en", "ar-OM"))
    });
  };
  animateStat('#stat-total', total);
  animateStat('#stat-votes', votes);
  animateStat('#count-planned', counts.planned);
  animateStat('#count-inprog', counts.in_progress);
  animateStat('#count-done', counts.completed);
  animateStat('#stat-done', counts.completed);
}

// ── VOTING ─────────────────────────────────────────────────
async function handleVote(featureId) {
  const card = document.querySelector(`.feature-card[data-id="${featureId}"]`);
  const countEl = card?.querySelector('.vote-count');
  const btn = card?.querySelector('.vote-btn');
  const votesMeta = $(`#meta-votes-${featureId}`);

  if (state.user) {
    const alreadyVoted = state.userVotes.has(featureId);
    const delta = alreadyVoted ? -1 : 1;
    if (countEl) countEl.textContent = parseInt(countEl.textContent, 10) + delta;
    if (btn) btn.classList.toggle('voted', !alreadyVoted);

    const { data, error } = await db.rpc('toggle_feature_vote', {
      p_feature_id: featureId,
      p_user_id: state.user.id
    });
    if (error) { renderFeatures(); return; }

    data.voted ? state.userVotes.add(featureId) : state.userVotes.delete(featureId);
    if (countEl) countEl.textContent = data.votes_count;
    if (votesMeta) votesMeta.innerHTML = `<i class="fa-solid fa-chevron-up"></i> ${data.votes_count}${roadmapText(" votes", " تصويت")}`;
    const feat = state.features.find(f => f.id === featureId);
    if (feat) feat.votes_count = data.votes_count;
  } else {
    const alreadyVoted = state.anonVotes.has(featureId);
    const delta = alreadyVoted ? -1 : 1;
    if (countEl) countEl.textContent = parseInt(countEl.textContent, 10) + delta;
    if (btn) btn.classList.toggle('voted', !alreadyVoted);

    const { data, error } = await db.rpc('toggle_anon_vote', {
      p_feature_id: featureId,
      p_fingerprint: state.anonFingerprint
    });
    if (error) { renderFeatures(); return; }

    data.voted ? state.anonVotes.add(featureId) : state.anonVotes.delete(featureId);
    saveAnonVotes();
    if (countEl) countEl.textContent = data.votes_count;
    if (votesMeta) votesMeta.innerHTML = `<i class="fa-solid fa-chevron-up"></i> ${data.votes_count}${roadmapText(" votes", " تصويت")}`;
    const feat = state.features.find(f => f.id === featureId);
    if (feat) feat.votes_count = data.votes_count;
  }

  updateStats();
}

// ── SUGGEST FEATURE ────────────────────────────────────────
function bindFAB() {
  $('#fab-suggest')?.addEventListener('click', openSuggestModal);
}

function bindSuggestModal() {
  $('#feature-title')?.addEventListener('input', function() {
    $('#title-count').textContent = `${this.value.length} / 100`;
  });
  $('#feature-desc')?.addEventListener('input', function() {
    $('#desc-count').textContent = `${this.value.length} / 500`;
  });
  $('#submit-feature')?.addEventListener('click', submitFeature);
}

function openSuggestModal() {
  state.editingFeatureId = null;
  $('#submit-feature .btn-text') && ($('#submit-feature .btn-text').textContent = roadmapText("Submit Feature", "إرسال الميزة"));
  const header = $('#suggest-modal .modal-header h2');
  if (header) header.innerHTML = roadmapText("<i class=\"fa-solid fa-lightbulb text-accent\"></i> Suggest a Feature", "<i class=\"fa-solid fa-lightbulb text-accent\"></i> اقترح ميزة");
  $('#feature-title').value = '';
  $('#feature-desc').value  = '';
  $('#anonName') && ($('#anonName').value = '');
  $('#anonEmail') && ($('#anonEmail').value = '');
  $('#title-count').textContent = '0 / 100';
  $('#desc-count').textContent  = '0 / 500';
  $('#suggest-error')?.classList.add('hidden');
  $('#anonFields')?.classList.toggle('hidden', !!state.user);
  openModal('suggest-modal');
}

function openSuggestModalForEdit(featureId) {
  const feature = state.features.find(f => f.id === featureId);
  if (!feature || !state.user || feature.created_by !== state.user.id) return;

  state.editingFeatureId = featureId;
  $('#feature-title').value = feature.title || '';
  $('#feature-desc').value = feature.description || '';
  $('#title-count').textContent = `${(feature.title || '').length} / 100`;
  $('#desc-count').textContent = `${(feature.description || '').length} / 500`;
  $('#suggest-error')?.classList.add('hidden');
  const header = $('#suggest-modal .modal-header h2');
  if (header) header.innerHTML = roadmapText("<i class=\"fa-regular fa-pen-to-square text-accent\"></i> Edit Your Suggestion", "<i class=\"fa-regular fa-pen-to-square text-accent\"></i> عدّل اقتراحك");
  $('#submit-feature .btn-text') && ($('#submit-feature .btn-text').textContent = roadmapText("Save Changes", "حفظ التغييرات"));
  $('#anonFields')?.classList.add('hidden');
  openModal('suggest-modal');
}

async function deleteOwnFeature(featureId) {
  const feature = state.features.find(f => f.id === featureId);
  if (!feature || !state.user || feature.created_by !== state.user.id) return;
  openConfirmModal({
    title: roadmapText("Delete Suggestion", "حذف الاقتراح"),
    message: roadmapText("This will permanently remove your feature suggestion.", "سيؤدي هذا إلى حذف اقتراح الميزة نهائيًا."),
    confirmText: roadmapText("Delete Suggestion", "حذف الاقتراح"),
    onConfirm: async () => {
      const { error, count } = await db
        .from('features')
        .delete({ count: 'exact' })
        .eq('id', featureId)
        .eq('created_by', state.user.id);

      if (error) {
        showToast(roadmapText("Failed to delete suggestion.", "فشل حذف الاقتراح."), '<i class="fa-solid fa-circle-exclamation"></i>');
        throw error;
      }
      if (count === 0) {
        // Soft delete happened, row not actually removed but state changes
      }

      if (state.activeFeatureId === featureId) {
        closeModal('comments-modal');
        state.activeFeatureId = null;
      }

      removeFeatureFromCurrentView(featureId);
      showToast(roadmapText("Suggestion deleted.", "تم حذف الاقتراح."), '<i class="fa-regular fa-trash-can"></i>');
    }
  });
}

async function submitFeature() {
  const title   = $('#feature-title')?.value.trim();
  const desc    = $('#feature-desc')?.value.trim();
  const errEl   = $('#suggest-error');
  const wasEditing = Boolean(state.editingFeatureId);

  if (!title || title.length < 3) { showFormError(errEl, roadmapText("Title must be at least 3 characters.", "العنوان يجب أن يكون 3 أحرف على الأقل.")); return; }
  if (!desc)                      { showFormError(errEl, roadmapText("Description is required.", "الوصف مطلوب.")); return; }

  const btn    = $('#submit-feature');
  const txtEl  = btn.querySelector('.btn-text');
  const spinEl = btn.querySelector('.btn-spinner');
  btn.disabled = true;
  txtEl?.classList.add('hidden');
  spinEl?.classList.remove('hidden');

  let data;
  let error;
  if (state.editingFeatureId) {
    ({ data, error } = await db
      .from('features')
      .update({ title, description: desc })
      .eq('id', state.editingFeatureId)
      .eq('created_by', state.user.id)
      .select()
      .single());
  } else if (state.user) {
    ({ data, error } = await db
      .from('features')
      .insert({
        title,
        description: desc,
        status: 'planned',
        created_by: state.user.id,
        is_approved: true,
        is_anonymous: false,
      })
      .select()
      .single());
  } else {
    const name = $('#anonName')?.value.trim() || null;
    const email = $('#anonEmail')?.value.trim() || null;
    ({ error } = await db.rpc('submit_anon_suggestion', {
      p_title: title,
      p_description: desc,
      p_submitter_name: name,
      p_submitter_email: email
    }));
  }

  btn.disabled = false;
  txtEl?.classList.remove('hidden');
  spinEl?.classList.add('hidden');

  if (error) {
    showFormError(errEl, roadmapText("Submission failed. Please try again.", "فشل الإرسال. حاول مرة أخرى."));
    return;
  }

  $('#feature-title').value = '';
  $('#feature-desc').value  = '';
  $('#title-count').textContent = '0 / 100';
  $('#desc-count').textContent  = '0 / 500';
  errEl?.classList.add('hidden');
  state.editingFeatureId = null;
  $('#submit-feature .btn-text') && ($('#submit-feature .btn-text').textContent = roadmapText("Submit Feature", "إرسال الميزة"));
  const header = $('#suggest-modal .modal-header h2');
  if (header) header.innerHTML = roadmapText("<i class=\"fa-solid fa-lightbulb text-accent\"></i> Suggest a Feature", "<i class=\"fa-solid fa-lightbulb text-accent\"></i> اقترح ميزة");

  closeModal('suggest-modal');
  if (!state.user && !wasEditing) {
    showToast(roadmapText("Suggestion submitted! It will appear after review.", "تم إرسال الاقتراح! سيظهر بعد المراجعة."), '<i class="fa-solid fa-clock"></i>');
  } else {
    showToast(wasEditing ? roadmapText("Suggestion updated.", "تم تحديث الاقتراح.") : roadmapText("Feature added to the roadmap!", "تمت إضافة الميزة إلى خريطة الطريق!"), '<i class="fa-solid fa-lightbulb text-accent"></i>');
  }

  if (data && state.user) {
    if (state.features.some(f => f.id === data.id)) {
      const idx = state.features.findIndex(f => f.id === data.id);
      state.features[idx] = { ...state.features[idx], ...data };
    } else if (state.currentTab === 'roadmap') {
      state.features.unshift({ ...data, feature_comments: [{ count: 0 }] });
    }
    renderFeatures();
    updateStats();
  }
}

// ── COMMENTS ───────────────────────────────────────────────
function bindCommentsModal() {
  $('#submit-comment')?.addEventListener('click', submitComment);
  $('#comment-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitComment();
  });
}

function bindCommentActions() {
  document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.comment-delete-btn');
    if (deleteBtn) {
      await deleteOwnComment(deleteBtn.dataset.feature, deleteBtn.dataset.comment);
    }
  });
}

async function deleteOwnComment(featureId, commentId) {
  if (!state.user || !featureId || !commentId) return;
  const comments = state.commentsByFeature[featureId] || [];
  const comment = comments.find(c => c.id === commentId && c.user_id === state.user.id);
  if (!comment) {
    showToast(roadmapText("You can only delete your own comment.", "يمكنك فقط حذف تعليقاتك الخاصة."), '<i class="fa-solid fa-lock"></i>');
    return;
  }
  openConfirmModal({
    title: roadmapText("Delete Comment", "حذف التعليق"),
    message: roadmapText("This comment will be permanently deleted.", "سيتم حذف هذا التعليق بشكل دائم."),
    confirmText: roadmapText("Delete Comment", "حذف التعليق"),
    onConfirm: async () => {
      const { error, count } = await db
        .from('feature_comments')
        .delete({ count: 'exact' })
        .eq('id', commentId)
        .eq('user_id', state.user.id);

      if (error) {
        showToast(roadmapText("Failed to delete comment.", "فشل حذف التعليق."), '<i class="fa-solid fa-circle-exclamation"></i>');
        throw error;
      }
      if (count === 0) {
        // Soft delete happened, row not actually removed but state changes
      }

      state.commentsByFeature[featureId] = comments.filter(c => c.id !== commentId);
      refreshCommentViews(featureId);
      showToast(roadmapText("Comment deleted.", "تم حذف التعليق."), '<i class="fa-regular fa-trash-can"></i>');
    }
  });
}

function bindConfirmModal() {
  $('#confirm-modal-btn')?.addEventListener('click', async () => {
    if (!state.pendingConfirmAction) return;
    const btn = $('#confirm-modal-btn');
    if (btn.dataset.processing === '1') return;
    const txt = $('#confirm-modal-btn-text');
    const err = $('#confirm-modal-error');
    btn.disabled = true;
    btn.dataset.processing = '1';
    if (txt) txt.textContent = roadmapText("Processing...", "جاري المعالجة...");
    err?.classList.add('hidden');

    try {
      await Promise.resolve(state.pendingConfirmAction());
      state.pendingConfirmAction = null;
      btn.dataset.processing = '0';
      btn.disabled = false;
      if (txt) txt.textContent = state.pendingConfirmLabel || roadmapText("Delete", "حذف");
      closeModal('confirm-modal');
    } catch (e) {
      if (err) {
        err.textContent = e?.message || roadmapText("Failed to complete action.", "فشل إكمال الإجراء.");
        err.classList.remove('hidden');
      }
    } finally {
      if (btn.dataset.processing !== '0') {
        btn.disabled = false;
        btn.dataset.processing = '0';
        if (txt) txt.textContent = state.pendingConfirmLabel || roadmapText("Delete", "حذف");
      }
    }
  });
}

function openConfirmModal({ title, message, confirmText = roadmapText("Delete", "حذف"), onConfirm }) {
  state.pendingConfirmAction = onConfirm;
  state.pendingConfirmLabel = confirmText;
  const titleEl = $('#confirm-modal-title');
  const msgEl = $('#confirm-modal-message');
  const btn = $('#confirm-modal-btn');
  const txt = $('#confirm-modal-btn-text');
  const err = $('#confirm-modal-error');
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ff7878;"></i> ${escHtml(title || roadmapText("Confirm Action", "تأكيد الإجراء"))}`;
  if (msgEl) msgEl.textContent = message || roadmapText("Are you sure you want to continue?", "هل أنت متأكد أنك تريد المتابعة؟");
  if (txt) txt.textContent = confirmText;
  if (btn) {
    btn.disabled = false;
    btn.dataset.processing = '0';
  }
  err?.classList.add('hidden');
  openModal('confirm-modal');
}

function refreshCommentViews(featureId) {
  const comments = state.commentsByFeature[featureId] || [];
  const inlineList = $(`#inline-comments-${featureId}`);
  if (inlineList) {
    inlineList.innerHTML = renderCommentCollection(comments, featureId);
    inlineList.scrollTop = inlineList.scrollHeight;
  }

  if (state.activeFeatureId === featureId) {
    const modalList = $('#comments-list');
    if (modalList) {
      modalList.innerHTML = renderCommentCollection(comments, featureId);
      modalList.scrollTop = modalList.scrollHeight;
    }
  }

  updateCommentCountUI(featureId, comments.length);
  refreshExpandedHeight(featureId);
}

async function fetchComments(featureId, force = false) {
  if (!force && Array.isArray(state.commentsByFeature[featureId])) {
    return { comments: state.commentsByFeature[featureId], error: null };
  }

  const { data, error } = await db
    .from('feature_comments')
    .select('id, content, created_at, user_id')
    .eq('feature_id', featureId)
    .order('created_at', { ascending: true });

  if (!error) state.commentsByFeature[featureId] = data || [];
  return { comments: data || [], error };
}

function renderCommentCollection(comments = [], featureId) {
  if (!comments.length) {
    return roadmapText("<div class=\"comments-empty\"><i class=\"fa-regular fa-comment-dots\"></i><br>No comments yet — be the first!</div>", "<div class=\"comments-empty\"><i class=\"fa-regular fa-comment-dots\"></i><br>لا توجد تعليقات بعد. كن أول من يعلّق!</div>");
  }
  return comments.map(c => buildCommentEl(c, featureId).outerHTML).join('');
}

function updateCommentCountUI(featureId, nextCount) {
  const count = Number(nextCount || 0);
  const chip = $(`#cc-${featureId}`);
  if (chip) chip.textContent = count;
  const inlineBadge = $(`#inline-count-${featureId}`);
  if (inlineBadge) inlineBadge.textContent = count;
  const modalBadge = $('#comments-count-badge');
  if (state.activeFeatureId === featureId && modalBadge) modalBadge.textContent = count;

  const feature = state.features.find(f => f.id === featureId);
  if (feature) {
    if (!feature.feature_comments?.[0]) feature.feature_comments = [{ count: 0 }];
    feature.feature_comments[0].count = count;
  }
}

async function loadInlineComments(featureId) {
  const list = $(`#inline-comments-${featureId}`);
  if (!list) return;

  list.innerHTML = roadmapText("<div class=\"comments-loading\"><i class=\"fa-solid fa-circle-notch fa-spin\"></i> Loading comments…</div>", "<div class=\"comments-loading\"><i class=\"fa-solid fa-circle-notch fa-spin\"></i> جار تحميل التعليقات...</div>");
  const { comments, error } = await fetchComments(featureId);
  if (error) {
    list.innerHTML = roadmapText("<div class=\"comments-empty\">Failed to load comments.</div>", "<div class=\"comments-empty\">فشل تحميل التعليقات.</div>");
    return;
  }

  list.innerHTML = renderCommentCollection(comments, featureId);
  updateCommentCountUI(featureId, comments.length);
  list.scrollTop = list.scrollHeight;
  refreshExpandedHeight(featureId);
}

async function openComments(featureId, title) {
  state.activeFeatureId = featureId;
  const titleEl = $('#comments-feature-title');
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-comments text-accent"></i> ${escHtml(title)}`;

  openModal('comments-modal');

  const compose = $('#comments-compose');
  const nudge   = $('#comments-auth-nudge');

  if (state.user) {
    compose?.classList.remove('hidden');
    nudge?.classList.add('hidden');
  } else {
    compose?.classList.add('hidden');
    nudge?.classList.remove('hidden');
    // Re-bind sign-in inside nudge
    const siBtn = $('#comments-sign-in-btn');
    if (siBtn) {
      siBtn.onclick = () => { closeModal('comments-modal'); openAuthModal(); };
    }
  }

  await loadComments(featureId);
}

async function loadComments(featureId) {
  const list = $('#comments-list');
  list.innerHTML = roadmapText("<div class=\"comments-loading\"><i class=\"fa-solid fa-circle-notch fa-spin\"></i> Loading comments…</div>", "<div class=\"comments-loading\"><i class=\"fa-solid fa-circle-notch fa-spin\"></i> جار تحميل التعليقات...</div>");
  const { comments, error } = await fetchComments(featureId);
  if (error) {
    list.innerHTML = roadmapText("<div class=\"comments-empty\">Failed to load comments.</div>", "<div class=\"comments-empty\">فشل تحميل التعليقات.</div>");
    return;
  }

  list.innerHTML = renderCommentCollection(comments, featureId);
  updateCommentCountUI(featureId, comments.length);
  list.scrollTop = list.scrollHeight;
}

function buildCommentEl(comment, featureId) {
  const el      = document.createElement('div');
  el.className  = 'comment-item';
  const uid     = comment.user_id?.slice(0, 6) || '??????';
  const initial = uid[0]?.toUpperCase() || 'U';
  const date    = new Date(comment.created_at).toLocaleDateString(roadmapText("en-US", "ar-OM"), { month: 'short', day: 'numeric' });
  const canManage = state.user && comment.user_id === state.user.id;

  el.innerHTML = `
    <div class="comment-avatar">${initial}${roadmapText("</div>\n    <div class=\"comment-body\">\n      <div class=\"comment-meta\">\n        <span class=\"comment-author\">User #", "</div>\n    <div class=\"comment-body\">\n      <div class=\"comment-meta\">\n        <span class=\"comment-author\">مستخدم #")}${uid}</span>
        <span>${date}</span>
        ${canManage ? `
        <span class="comment-actions">
          <button class="comment-action-btn comment-delete-btn" data-comment="${comment.id}" data-feature="${featureId}${roadmapText("\" title=\"Delete comment\"><i class=\"fa-regular fa-trash-can\"></i></button>\n        </span>", "\" title=\"حذف التعليق\"><i class=\"fa-regular fa-trash-can\"></i></button>\n        </span>")}` : ''}
      </div>
      <p class="comment-text">${escHtml(comment.content)}</p>
    </div>
  `;
  return el;
}

async function submitComment() {
  if (!state.user || !state.activeFeatureId) return;
  const input   = $('#comment-input');
  const content = input?.value.trim();
  if (!content) return;

  const btn     = $('#submit-comment');
  btn.disabled  = true;
  btn.textContent = '…';

  const { data, error } = await db.from('feature_comments').insert({
    feature_id: state.activeFeatureId,
    user_id: state.user.id,
    content,
  }).select().single();

  btn.disabled    = false;
  btn.textContent = roadmapText("Post", "إرسال");

  if (error) {
    showToast(roadmapText("Failed to post comment.", "فشل نشر التعليق."), '<i class="fa-solid fa-circle-exclamation"></i>');
    return;
  }

  input.value = '';
  const cached = state.commentsByFeature[state.activeFeatureId] || [];
  cached.push(data);
  state.commentsByFeature[state.activeFeatureId] = cached;
  await loadComments(state.activeFeatureId);
  const inlineList = $(`#inline-comments-${state.activeFeatureId}`);
  if (inlineList) inlineList.innerHTML = renderCommentCollection(cached, state.activeFeatureId);
  updateCommentCountUI(state.activeFeatureId, cached.length);
  showToast(roadmapText("Comment posted!", "تم نشر التعليق!"), '<i class="fa-solid fa-check"></i>');
}

async function submitInlineComment(featureId) {
  if (!state.user) {
    openAuthModal();
    return;
  }
  const input = $(`#inline-comment-input-${featureId}`);
  const btn = $(`#inline-comment-btn-${featureId}`);
  const content = input?.value.trim();
  if (!content || !btn) return;

  btn.disabled = true;
  btn.textContent = '…';

  const { data, error } = await db.from('feature_comments').insert({
    feature_id: featureId,
    user_id: state.user.id,
    content,
  }).select().single();

  btn.disabled = false;
  btn.textContent = roadmapText("Post", "إرسال");

  if (error) {
    showToast(roadmapText("Failed to post comment.", "فشل نشر التعليق."), '<i class="fa-solid fa-circle-exclamation"></i>');
    return;
  }

  input.value = '';
  const cached = state.commentsByFeature[featureId] || [];
  cached.push(data);
  state.commentsByFeature[featureId] = cached;

  const list = $(`#inline-comments-${featureId}`);
  if (list) {
    list.innerHTML = renderCommentCollection(cached, featureId);
    list.scrollTop = list.scrollHeight;
  }

  if (state.activeFeatureId === featureId) {
    const modalList = $('#comments-list');
    if (modalList && !$('#comments-modal')?.classList.contains('hidden')) {
      modalList.innerHTML = renderCommentCollection(cached, featureId);
      modalList.scrollTop = modalList.scrollHeight;
    }
  }

  updateCommentCountUI(featureId, cached.length);
  refreshExpandedHeight(featureId);
  showToast(roadmapText("Comment posted!", "تم نشر التعليق!"), '<i class="fa-solid fa-check"></i>');
}

// ── TABS & FILTERS ─────────────────────────────────────────
function bindTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === state.currentTab) return;
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTab = btn.dataset.tab;

      const filterBar = $('#status-filter');
      if (filterBar) {
        filterBar.style.display = state.currentTab === 'roadmap' ? 'flex' : 'none';
      }

      if (state.currentTab !== 'roadmap') {
        state.statusFilter = 'all';
        $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
      }
      loadFeatures();
    });
  });
}

function bindFilters() {
  $$('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.dataset.filter === state.statusFilter) return;
      $$('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.statusFilter = chip.dataset.filter;
      loadFeatures();
    });
  });
}

// ── MODAL UTILITIES ────────────────────────────────────────
function openModal(id) {
  const modal = $(`#${id}`);
  if (!modal) return;
  modal.classList.remove('hidden', 'is-closing');
  requestAnimationFrame(() => modal.classList.add('is-open'));
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = $(`#${id}`);
  if (!modal || modal.classList.contains('hidden')) return;
  if (id === 'confirm-modal') {
    const confirmBtn = $('#confirm-modal-btn');
    if (confirmBtn?.dataset.processing === '1') return;
  }
  if (id === 'confirm-modal') state.pendingConfirmAction = null;
  modal.classList.remove('is-open');
  modal.classList.add('is-closing');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('is-closing');
    if (!$$('.modal-overlay.is-open').length) {
      document.body.style.overflow = '';
    }
  }, 240);
}

function bindModalClosers() {
  $$('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal-overlay:not(.hidden)').forEach(o => closeModal(o.id));
    }
  });
}

// ── SKELETON ───────────────────────────────────────────────
function showSkeleton(visible) {
  const skel = $('#skeleton-wrap');
  if (!skel) return;
  if (visible) {
    skel.style.display = 'flex';
    skel.style.flexDirection = 'column';
    skel.style.gap = '10px';
  } else {
    skel.style.display = 'none';
  }
  $$('.feature-card').forEach(c => {
    if (visible) c.remove();
  });
}

// ── TOAST ──────────────────────────────────────────────────
let toastTimer;
function showToast(message, iconHtml = '<i class="fa-solid fa-check text-accent"></i>') {
  const toast = $('#toast');
  const iconEl = $('#toast-icon');
  const msgEl  = $('#toast-msg');
  if (!toast) return;

  iconEl.innerHTML = iconHtml;
  msgEl.textContent = message;
  toast.classList.remove('hidden');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

// ── FORM ERROR ─────────────────────────────────────────────
function showFormError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── BOOT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
})();
