(function () {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const lang = (root.lang || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const isArabic = lang === 'ar';
  const dataUrl = body.dataset.releaseDataUrl || (isArabic ? '../assets/data/releases.json' : 'assets/data/releases.json');
  const changelogUrl = body.dataset.changelogUrl || (isArabic ? '../CHANGELOG.ar.md' : 'CHANGELOG.md');
  const copy = isArabic ? {
    current: 'الحالي',
    updated: 'آخر تحديث',
    releases: 'إصداراً',
    latest: 'الأحدث',
    major: 'إصدار رئيسي',
    why: 'لماذا يهم هذا الإصدار',
    userUpdates: 'تحديثات المستخدم',
    developerNotes: 'ملاحظات المطور',
    all: 'الكل',
    features: 'ميزات',
    improvements: 'تحسينات',
    fixes: 'إصلاحات',
    technical_changes: 'تقني',
    database_changes: 'قاعدة البيانات',
    api_updates: 'API',
    internal_improvements: 'داخلي',
    versions: 'الإصدارات',
    empty: 'لا توجد إصدارات مطابقة لهذا الفلتر.',
    loading: 'جارٍ تحميل الإصدارات...',
    loadError: 'تعذر تحميل بيانات الإصدارات.',
    changelogLoading: 'جارٍ تحميل سجل التغييرات...',
    changelogError: 'تعذر تحميل سجل التغييرات الآن.',
    openRaw: 'فتح سجل التغييرات الخام',
    newSince: 'جديد منذ زيارتك الأخيرة',
    jump: 'الانتقال إلى التغييرات'
  } : {
    current: 'Current',
    updated: 'Updated',
    releases: 'releases',
    latest: 'Latest',
    major: 'Major Release',
    why: 'Why this matters',
    userUpdates: 'User Updates',
    developerNotes: 'Developer Notes',
    all: 'All',
    features: 'Features',
    improvements: 'Improvements',
    fixes: 'Fixes',
    technical_changes: 'Technical',
    database_changes: 'Database',
    api_updates: 'API',
    internal_improvements: 'Internal',
    versions: 'Versions',
    empty: 'No releases match this filter.',
    loading: 'Loading releases...',
    loadError: 'Could not load release data.',
    changelogLoading: 'Loading changelog...',
    changelogError: 'Could not load the changelog right now.',
    openRaw: 'Open raw changelog',
    newSince: 'New since your last visit',
    jump: 'Jump to changes'
  };

  const userGroups = [
    ['features', 'c-new', 'fa-wand-magic-sparkles'],
    ['improvements', 'c-impr', 'fa-arrow-trend-up'],
    ['fixes', 'c-fix', 'fa-wrench']
  ];
  const developerGroups = [
    ['technical_changes', 'c-tech', 'fa-code'],
    ['database_changes', 'c-db', 'fa-database'],
    ['api_updates', 'c-api', 'fa-plug'],
    ['internal_improvements', 'c-int', 'fa-gear']
  ];

  let releaseData = null;
  let currentMode = 'user';
  let currentFilter = 'all';
  let changelogLoaded = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, '<span class="ct">$1</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function versionId(version) {
    return `v${version.replace(/^v/, '').replace(/\./g, '')}`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(isArabic ? 'ar-OM' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00Z`));
  }

  function itemList(items) {
    if (!items?.length) return '';
    return `<ul class="rl-ul">${items.map((item) => `<li>${inlineMarkdown(item.text[lang])}</li>`).join('')}</ul>`;
  }

  function groupsMarkup(groups, source) {
    return groups.map(([key, className, icon]) => {
      const items = source?.[key] || [];
      if (!items.length) return '';
      return `
        <div class="rl-blk">
          <div class="rl-blk-ttl ${className}"><i class="fa-solid ${icon}"></i> ${copy[key]}</div>
          ${itemList(items)}
        </div>`;
    }).join('');
  }

  function tagMarkup(tag) {
    if (tag === 'feature') {
      return `<span class="rl-tag feat"><i class="fa-solid fa-wand-magic-sparkles fa-mini"></i> ${copy.features}</span>`;
    }
    if (tag === 'improvement') return `<span class="rl-tag impr">↑ ${copy.improvements}</span>`;
    return `<span class="rl-tag fix"><i class="fa-solid fa-wrench fa-mini"></i> ${copy.fixes}</span>`;
  }

  function releaseCard(release, index) {
    const id = versionId(release.version);
    const suffix = id.slice(1);
    const major = release.is_major_release;
    const latest = index === 0;
    const open = index < 4 ? ' open' : '';
    const majorClass = major ? ' major' : '';
    const majorNote = major ? `
      <div class="rl-major-note">
        <strong>${copy.why}:</strong> ${escapeHtml(release.major_details[lang].why_it_matters)}
      </div>` : '';

    return `
      <article class="rl-card${open}${majorClass}" id="${id}" data-version="${release.version}" data-tags="${release.tags.join(',')}">
        <div class="rl-box">
          <button class="rl-head" type="button" aria-expanded="${index < 4}" aria-controls="body-${suffix}">
            <span class="rl-head-body">
              <span class="rl-head-top">
                <span class="rl-ver">${release.version}</span>
                ${latest ? `<span class="rl-badge-latest"><i class="fa-solid fa-bolt fa-mini"></i> ${copy.latest}</span>` : ''}
                ${major ? `<span class="rl-badge-major"><i class="fa-solid fa-crown fa-mini"></i> ${copy.major}</span>` : ''}
              </span>
              <span class="rl-date"><i class="fa-regular fa-calendar"></i>${formatDate(release.date)}</span>
              <span class="rl-summary">${escapeHtml(release.summary[lang])}</span>
              <span class="rl-tags">${release.tags.map(tagMarkup).join('')}</span>
            </span>
            <i class="fa-solid fa-chevron-down rl-chev" aria-hidden="true"></i>
          </button>
          <div class="rl-body" id="body-${suffix}">
            ${majorNote}
            <div class="rl-tabs${major ? ' rl-major-divider' : ''}">
              <button class="rl-tab-btn tab-u active" type="button" data-tab="u${suffix}">${copy.userUpdates}</button>
              <button class="rl-tab-btn tab-d" type="button" data-tab="d${suffix}">${copy.developerNotes}</button>
            </div>
            <div class="rl-pane active" id="u${suffix}">${groupsMarkup(userGroups, release.user_updates)}</div>
            <div class="rl-pane" id="d${suffix}">${groupsMarkup(developerGroups, release.developer_notes)}</div>
          </div>
        </div>
      </article>`;
  }

  function render(data) {
    releaseData = data;
    const latest = data.releases[0];
    byId('releaseCurrent').textContent = latest.version;
    byId('releaseUpdated').textContent = formatDate(latest.date);
    byId('releaseCount').textContent = new Intl.NumberFormat(isArabic ? 'ar-OM' : 'en-US')
      .format(data.releases.length);
    byId('releaseCountLabel').textContent = copy.releases;
    byId('rlNavLabel').textContent = copy.versions;

    byId('releaseNavPanel').innerHTML = data.releases.map((release) => `
      <a class="rl-nav-item" href="#${versionId(release.version)}" data-version="${release.version}">
        <span class="${release.is_major_release ? 'rl-dot-maj' : 'rl-dot-min'}"></span>${release.version}
      </a>`).join('');

    byId('rlTl').innerHTML = data.releases.map(releaseCard).join('');
    bindRenderedInteractions();
    applyMode();
    applyFilter();
    syncOpenCardHeights();
    updateNavSpy();
    showNewSinceLastVisit();
  }

  function toggleCard(card) {
    const bodyElement = card.querySelector('.rl-body');
    const head = card.querySelector('.rl-head');
    const opening = !card.classList.contains('open');
    card.classList.toggle('open', opening);
    head.setAttribute('aria-expanded', String(opening));
    bodyElement.style.maxHeight = opening ? `${bodyElement.scrollHeight}px` : '0px';
  }

  function syncOpenCardHeights() {
    document.querySelectorAll('.rl-card').forEach((card) => {
      const cardBody = card.querySelector('.rl-body');
      if (cardBody) cardBody.style.maxHeight = card.classList.contains('open') ? `${cardBody.scrollHeight}px` : '0px';
    });
  }

  function switchTab(button) {
    const card = button.closest('.rl-card');
    card.querySelectorAll('.rl-tab-btn').forEach((tab) => tab.classList.remove('active'));
    card.querySelectorAll('.rl-pane').forEach((pane) => pane.classList.remove('active'));
    button.classList.add('active');
    byId(button.dataset.tab)?.classList.add('active');
    requestAnimationFrame(syncOpenCardHeights);
  }

  function applyMode() {
    body.classList.remove('mode-user', 'mode-dev');
    body.classList.add(currentMode === 'developer' ? 'mode-dev' : 'mode-user');
    document.querySelectorAll('.rl-mode-btn').forEach((button) => {
      const active = button.dataset.mode === currentMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.rl-card').forEach((card) => {
      const target = card.querySelector(currentMode === 'developer' ? '.tab-d' : '.tab-u');
      if (target) switchTab(target);
    });
  }

  function applyFilter() {
    let visible = 0;
    document.querySelectorAll('.rl-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.filter === currentFilter);
    });
    document.querySelectorAll('.rl-card[data-version]').forEach((card) => {
      const show = currentFilter === 'all' || (card.dataset.tags || '').split(',').includes(currentFilter);
      card.classList.toggle('hidden', !show);
      if (show) visible += 1;
      document.querySelector(`.rl-nav-item[data-version="${card.dataset.version}"]`)?.classList.toggle('dimmed', !show);
    });
    byId('rlEmpty').classList.toggle('hidden', visible > 0);
  }

  function jumpToVersion(selector) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.classList.add('open');
    target.querySelector('.rl-head')?.setAttribute('aria-expanded', 'true');
    syncOpenCardHeights();
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 92, behavior: 'smooth' });
    if (window.location.hash !== selector) history.replaceState(null, '', selector);
  }

  function updateNavSpy() {
    let current = null;
    document.querySelectorAll('.rl-card[data-version]:not(.hidden)').forEach((card) => {
      if (card.getBoundingClientRect().top <= 130) current = card.dataset.version;
    });
    document.querySelectorAll('.rl-nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.version === current);
    });
  }

  function bindRenderedInteractions() {
    document.querySelectorAll('.rl-head').forEach((head) => {
      head.addEventListener('click', () => toggleCard(head.closest('.rl-card')));
    });
    document.querySelectorAll('.rl-tab-btn').forEach((button) => {
      button.addEventListener('click', () => switchTab(button));
    });
    document.querySelectorAll('.rl-nav-item').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        jumpToVersion(item.getAttribute('href'));
      });
    });
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const output = [];
    let inList = false;
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        if (inList) output.push('</ul>');
        inList = false;
        continue;
      }
      const heading = /^(#{1,4})\s+(.+)$/.exec(line);
      if (heading) {
        if (inList) output.push('</ul>');
        inList = false;
        output.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      } else if (/^[-*]\s+/.test(line)) {
        if (!inList) output.push('<ul>');
        inList = true;
        output.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`);
      } else if (line === '---') {
        if (inList) output.push('</ul>');
        inList = false;
        output.push('<hr>');
      } else {
        if (inList) output.push('</ul>');
        inList = false;
        output.push(`<p>${inlineMarkdown(line)}</p>`);
      }
    }
    if (inList) output.push('</ul>');
    return output.join('');
  }

  async function loadChangelogContent() {
    if (changelogLoaded) return;
    const target = byId('rlChangelogBody');
    target.innerHTML = `<p><i class="fa-solid fa-circle-notch fa-spin"></i> ${copy.changelogLoading}</p>`;
    try {
      const response = await fetch(changelogUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      target.innerHTML = renderMarkdown(await response.text());
      changelogLoaded = true;
    } catch (error) {
      target.innerHTML = `<p>${copy.changelogError}</p><p><a href="${changelogUrl}" target="_blank" rel="noopener">${copy.openRaw}</a></p>`;
    }
  }

  async function openChangelog() {
    await loadChangelogContent();
    const modal = byId('rlChangelogModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
  }

  function closeChangelog() {
    const modal = byId('rlChangelogModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
  }

  function showNewSinceLastVisit() {
    const key = 'nexcore_rl_visit';
    const stored = localStorage.getItem(key);
    localStorage.setItem(key, String(Date.now()));
    if (!stored || !releaseData) return;
    const lastVisit = new Date(Number(stored));
    const fresh = releaseData.releases.filter((release) => new Date(`${release.date}T00:00:00Z`) > lastVisit);
    if (!fresh.length) return;
    const selector = `#${versionId(fresh[0].version)}`;
    byId('rlBannerText').innerHTML =
      `<strong>${copy.newSince}:</strong> ${fresh.map((release) => release.version).join(', ')} — <a href="${selector}">${copy.jump}</a>`;
    byId('rlBannerText').querySelector('a').addEventListener('click', (event) => {
      event.preventDefault();
      jumpToVersion(selector);
    });
    byId('rlBanner').classList.remove('hidden');
  }

  function bindStaticInteractions() {
    document.querySelectorAll('.rl-mode-btn').forEach((button) => {
      button.addEventListener('click', () => {
        currentMode = button.dataset.mode;
        applyMode();
      });
    });
    document.querySelectorAll('.rl-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        currentFilter = pill.dataset.filter;
        applyFilter();
      });
    });
    byId('openChangelogBtn')?.addEventListener('click', (event) => {
      event.preventDefault();
      openChangelog();
    });
    byId('rlChangelogClose')?.addEventListener('click', closeChangelog);
    byId('rlChangelogModal')?.addEventListener('click', (event) => {
      if (event.target === byId('rlChangelogModal')) closeChangelog();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeChangelog();
    });
    window.addEventListener('resize', syncOpenCardHeights);
    window.addEventListener('scroll', updateNavSpy, { passive: true });
  }

  async function init() {
    bindStaticInteractions();
    body.classList.add('mode-user');
    byId('year').textContent = new Date().getFullYear();
    byId('rlTl').innerHTML = `<p class="rl-loading">${copy.loading}</p>`;
    try {
      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    } catch (error) {
      console.error('Release data load failed:', error);
      byId('rlTl').innerHTML = `<p class="rl-loading">${copy.loadError}</p>`;
    }
  }

  window.NexCoreReleases = { init, render, applyFilter, applyMode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
