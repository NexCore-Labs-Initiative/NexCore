// ============================================
// NexCore Labs — Cookie Consent Manager v2
// Granular category-based consent system
// GDPR-oriented with focus trapping & a11y
// ============================================

(function () {
  'use strict';

  const PREF_KEY = 'nexcore_cookie_preferences';
  const OLD_KEY = 'nexcore_cookie_consent_v1';
  const GA_ID = 'G-PYZB5L2R8W';
  const COOKIE_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 3a5 5 0 0 0 7 7 9 9 0 1 1-9-9h2Z"/>' +
    '<circle cx="8.5" cy="10.5" r="1"/><circle cx="13.5" cy="13.5" r="1"/><circle cx="10.5" cy="16.5" r=".9"/>' +
    '</svg>';
  const I18N = {
    en: {
      dir: 'ltr',
      settings: 'Cookie Settings',
      title: 'Privacy &amp; Cookies',
      desc: 'We use cookies to enhance your experience, ensure security, and improve our services.',
      acceptAll: 'Accept all',
      rejectOptional: 'Reject optional',
      customize: 'Customize settings',
      necessary: 'Necessary',
      always: 'Always enabled',
      necessaryLabel: 'Necessary cookies - always enabled',
      necessaryDesc: 'Required for login, Supabase authentication, and core functionality.',
      analytics: 'Analytics',
      analyticsLabel: 'Toggle analytics cookies',
      analyticsDesc: 'Allows anonymous usage analytics to help improve the platform.',
      externalMedia: 'External Media',
      externalMediaLabel: 'Toggle external media cookies',
      externalMediaDesc: 'Allows content from external platforms such as LinkedIn or YouTube.',
      aiServices: 'AI Services',
      aiServicesLabel: 'Toggle AI services cookies',
      aiServicesDesc: 'Allows AI usage tracking and feature improvements.',
      comingSoon: 'Coming soon',
      save: 'Save preferences',
      privacy: 'Privacy Policy',
      privacyHref: 'privacy-policy.html',
    },
    ar: {
      dir: 'rtl',
      settings: 'إعدادات ملفات تعريف الارتباط',
      title: 'الخصوصية وملفات تعريف الارتباط',
      desc: 'نستخدم الكوكيز لتحسين تجربتك، وضمان الأمان، وتطوير خدماتنا.',
      acceptAll: 'قبول الكل',
      rejectOptional: 'رفض الاختيارية',
      customize: 'تخصيص الإعدادات',
      necessary: 'الضرورية',
      always: 'مفعلة دائماً',
      necessaryLabel: 'الكوكيز الضرورية - مفعلة دائماً',
      necessaryDesc: 'مطلوبة لتسجيل الدخول، ومصادقة Supabase، والوظائف الأساسية.',
      analytics: 'التحليلات',
      analyticsLabel: 'تبديل كوكيز التحليلات',
      analyticsDesc: 'تسمح بتحليلات استخدام مجهولة تساعدنا على تحسين المنصة.',
      externalMedia: 'الوسائط الخارجية',
      externalMediaLabel: 'تبديل كوكيز الوسائط الخارجية',
      externalMediaDesc: 'تسمح بعرض محتوى من منصات خارجية مثل LinkedIn أو YouTube.',
      aiServices: 'خدمات الذكاء الاصطناعي',
      aiServicesLabel: 'تبديل كوكيز خدمات الذكاء الاصطناعي',
      aiServicesDesc: 'تسمح بتتبع استخدام الذكاء الاصطناعي وتحسين الميزات.',
      comingSoon: 'قريباً',
      save: 'حفظ',
      privacy: 'سياسة الخصوصية',
      privacyHref: 'privacy-policy.html',
    },
  };

  function getLocale() {
    var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    var path = window.location.pathname || '';
    return lang.indexOf('ar') === 0 || /(^|\/)ar(\/|$)/.test(path) ? 'ar' : 'en';
  }

  function t() {
    return I18N[getLocale()] || I18N.en;
  }

  // ─── Storage helpers ───────────────────────

  function getPrefs() {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function savePrefs(prefs) {
    prefs.timestamp = Math.floor(Date.now() / 1000);
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* storage full */ }
    window.dispatchEvent(new CustomEvent('nexcore:consent', { detail: prefs }));
    applyConsent(prefs);
  }

  /** Migrate from the old single-flag key to the new granular structure */
  function migrateOldConsent() {
    try {
      const old = localStorage.getItem(OLD_KEY);
      if (!old || getPrefs()) return; // nothing to migrate or already migrated
      const parsed = JSON.parse(old);
      savePrefs({
        necessary: true,
        analytics: !!parsed.analytics,
        external_media: false,
        ai_services: false,
      });
      localStorage.removeItem(OLD_KEY);
    } catch (e) { /* ignore */ }
  }

  // ─── Script / embed loading ─────────────────

  function loadGoogleAnalytics() {
    if (window.__ncc_ga_loaded) return;
    window.__ncc_ga_loaded = true;
    const s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    s.async = true;
    s.onload = function () {
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      window.gtag = window.gtag || gtag;
      gtag('js', new Date());
      gtag('config', GA_ID, {
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
    };
    document.head.appendChild(s);
  }

  function clearGACookies() {
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.split('=')[0].trim();
      if (/^_ga|^_gid|^_gat|^_gac_/.test(name)) {
        document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname + ';';
        document.cookie = name + '=; Max-Age=0; path=/;';
      }
    });
  }

  /**
   * Activate any lazy external-media embeds that opted in via
   * data-cookie-embed + data-src on the element.
   */
  function enableEmbeds() {
    document.querySelectorAll('[data-cookie-embed]').forEach(function (el) {
      if (el.dataset.src && !el.src) el.src = el.dataset.src;
    });
  }

  function applyConsent(prefs) {
    if (prefs.analytics) {
      loadGoogleAnalytics();
    } else {
      clearGACookies();
    }
    if (prefs.external_media) {
      enableEmbeds();
    }
  }

  // ─── Modal HTML ────────────────────────────

  function buildModalHTML() {
    var copy = t();
    return [
      '<div id="nexcore-cookie-overlay" class="ncc-overlay" role="dialog"',
      '     aria-modal="true" aria-labelledby="ncc-title"',
      '     aria-describedby="ncc-desc" aria-hidden="true" tabindex="-1"',
      '     lang="' + getLocale() + '" dir="' + copy.dir + '">',
      '  <div class="ncc-panel" role="document">',
      '    <div class="ncc-header">',
      '      <span class="ncc-icon" aria-hidden="true" title="' + copy.settings + '">' + COOKIE_ICON_SVG + '</span>',
      '      <h2 id="ncc-title" class="ncc-title">' + copy.title + '</h2>',
      '      <p id="ncc-desc" class="ncc-desc">',
      '        ' + copy.desc,
      '      </p>',
      '    </div>',

      '    <div class="ncc-actions-top">',
      '      <button id="ncc-accept-all" class="ncc-btn ncc-btn-primary" type="button">',
      '        ' + copy.acceptAll,
      '      </button>',
      '      <button id="ncc-reject-opt" class="ncc-btn ncc-btn-ghost" type="button">',
      '        ' + copy.rejectOptional,
      '      </button>',
      '    </div>',

      '    <details class="ncc-customize">',
      '      <summary>',
      '        <span>' + copy.customize + '</span>',
      '        <i class="ncc-chevron" aria-hidden="true">&#9662;</i>',
      '      </summary>',

      '      <div class="ncc-customize-body">',
      '      <div class="ncc-categories">',

      // Necessary — locked
      '        <div class="ncc-category">',
      '          <div class="ncc-cat-header">',
      '            <div class="ncc-cat-info">',
      '              <span class="ncc-cat-name">' + copy.necessary + '</span>',
      '              <span class="ncc-cat-always">' + copy.always + '</span>',
      '            </div>',
      '            <label class="ncc-toggle ncc-toggle-locked" aria-label="' + copy.necessaryLabel + '">',
      '              <input type="checkbox" checked disabled aria-disabled="true">',
      '              <span class="ncc-slider"></span>',
      '            </label>',
      '          </div>',
      '          <p class="ncc-cat-desc">' + copy.necessaryDesc + '</p>',
      '        </div>',

      // Analytics
      '        <div class="ncc-category">',
      '          <div class="ncc-cat-header">',
      '            <div class="ncc-cat-info">',
      '              <span class="ncc-cat-name">' + copy.analytics + '</span>',
      '            </div>',
      '            <label class="ncc-toggle" aria-label="' + copy.analyticsLabel + '">',
      '              <input type="checkbox" id="ncc-chk-analytics" name="analytics">',
      '              <span class="ncc-slider"></span>',
      '            </label>',
      '          </div>',
      '          <p class="ncc-cat-desc">' + copy.analyticsDesc + '</p>',
      '        </div>',

      // External Media
      '        <div class="ncc-category">',
      '          <div class="ncc-cat-header">',
      '            <div class="ncc-cat-info">',
      '              <span class="ncc-cat-name">' + copy.externalMedia + '</span>',
      '            </div>',
      '            <label class="ncc-toggle" aria-label="' + copy.externalMediaLabel + '">',
      '              <input type="checkbox" id="ncc-chk-external" name="external_media">',
      '              <span class="ncc-slider"></span>',
      '            </label>',
      '          </div>',
      '          <p class="ncc-cat-desc">' + copy.externalMediaDesc + '</p>',
      '        </div>',

      // AI Services
      '        <div class="ncc-category">',
      '          <div class="ncc-cat-header">',
      '            <div class="ncc-cat-info">',
      '              <span class="ncc-cat-name">' + copy.aiServices + '</span>',
      '              <span class="ncc-cat-badge">' + copy.comingSoon + '</span>',
      '            </div>',
      '            <label class="ncc-toggle" aria-label="' + copy.aiServicesLabel + '">',
      '              <input type="checkbox" id="ncc-chk-ai" name="ai_services">',
      '              <span class="ncc-slider"></span>',
      '            </label>',
      '          </div>',
      '          <p class="ncc-cat-desc">' + copy.aiServicesDesc + '</p>',
      '        </div>',

      '      </div>',// end .ncc-categories

      '      <div class="ncc-actions-bottom">',
      '        <button id="ncc-save" class="ncc-btn ncc-btn-save" type="button">' + copy.save + '</button>',
      '      </div>',
      '      </div>',// end .ncc-customize-body

      '    </details>',

      '    <div class="ncc-modal-footer">',
      '      <a href="' + copy.privacyHref + '" class="ncc-link">' + copy.privacy + '</a>',
      '    </div>',

      '  </div>',// end .ncc-panel
      '</div>',// end .ncc-overlay

      // Floating settings button
      '<button id="nexcore-cookie-settings-btn" class="ncc-floating-btn"',
      '        aria-label="' + copy.settings + '" title="' + copy.settings + '" type="button">',
      '  <span class="ncc-cookie-icon" aria-hidden="true">' + COOKIE_ICON_SVG + '</span>',
      '</button>',
    ].join('\n');
  }

  // ─── Focus trap ────────────────────────────

  function getFocusableEls(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function trapFocus(e) {
    var overlay = document.getElementById('nexcore-cookie-overlay');
    if (!overlay || !overlay.classList.contains('ncc-visible')) return;

    if (e.key === 'Escape') {
      closeModal();
      return;
    }

    if (e.key !== 'Tab') return;

    var focusable = getFocusableEls(overlay);
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ─── Modal open / close ────────────────────

  function showModal() {
    var overlay = document.getElementById('nexcore-cookie-overlay');
    var btn = document.getElementById('nexcore-cookie-settings-btn');
    if (!overlay) return;

    // Pre-fill toggles from stored preferences
    var prefs = getPrefs() || { necessary: true, analytics: false, external_media: false, ai_services: false };
    setToggle('ncc-chk-analytics', !!prefs.analytics);
    setToggle('ncc-chk-external', !!prefs.external_media);
    setToggle('ncc-chk-ai', !!prefs.ai_services);

    overlay.classList.add('ncc-visible');
    overlay.setAttribute('aria-hidden', 'false');
    if (btn) btn.classList.remove('ncc-btn-visible');
    document.addEventListener('keydown', trapFocus);

    requestAnimationFrame(function () {
      var focusable = getFocusableEls(overlay);
      if (focusable.length) focusable[0].focus();
    });
  }

  function closeModal() {
    var overlay = document.getElementById('nexcore-cookie-overlay');
    var btn = document.getElementById('nexcore-cookie-settings-btn');
    if (!overlay) return;

    overlay.classList.remove('ncc-visible');
    overlay.setAttribute('aria-hidden', 'true');
    if (btn) btn.classList.add('ncc-btn-visible');
    document.removeEventListener('keydown', trapFocus);
  }

  function setToggle(id, value) {
    var el = document.getElementById(id);
    if (el) el.checked = value;
  }

  function getToggle(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }

  // ─── Bind button events ─────────────────────

  function bindEvents() {
    var overlay = document.getElementById('nexcore-cookie-overlay');
    var acceptAllBtn = document.getElementById('ncc-accept-all');
    var rejectOptBtn = document.getElementById('ncc-reject-opt');
    var saveBtn = document.getElementById('ncc-save');
    var settingsBtn = document.getElementById('nexcore-cookie-settings-btn');

    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', function () {
        savePrefs({ necessary: true, analytics: true, external_media: true, ai_services: true });
        closeModal();
      });
    }

    if (rejectOptBtn) {
      rejectOptBtn.addEventListener('click', function () {
        savePrefs({ necessary: true, analytics: false, external_media: false, ai_services: false });
        closeModal();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        savePrefs({
          necessary: true,
          analytics: getToggle('ncc-chk-analytics'),
          external_media: getToggle('ncc-chk-external'),
          ai_services: getToggle('ncc-chk-ai'),
        });
        closeModal();
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', showModal);
    }

    // Dismiss on backdrop click
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }

    // ── Customize accordion smooth animation ──
    var details = document.querySelector('.ncc-customize');
    if (details) {
      var body = details.querySelector('.ncc-customize-body');
      var summary = details.querySelector('summary');

      summary.addEventListener('click', function (e) {
        e.preventDefault();

        if (details.open) {
          // Closing: animate down then remove [open]
          body.style.maxHeight = body.scrollHeight + 'px';
          requestAnimationFrame(function () {
            body.style.maxHeight = '0';
            body.style.opacity   = '0';
          });
          function onClose() {
            details.removeAttribute('open');
            body.removeEventListener('transitionend', onClose);
          }
          body.addEventListener('transitionend', onClose);
        } else {
          // Opening: add [open] then animate up
          details.setAttribute('open', '');
          body.style.maxHeight = '0';
          body.style.opacity   = '0';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              body.style.maxHeight = body.scrollHeight + 'px';
              body.style.opacity   = '1';
            });
          });
          function onOpen() {
            body.style.maxHeight = 'none';
            body.removeEventListener('transitionend', onOpen);
          }
          body.addEventListener('transitionend', onOpen);
        }
      });
    }

    // Cross-tab consent sync
    window.addEventListener('storage', function (e) {
      if (e.key === PREF_KEY) {
        var prefs = getPrefs();
        if (prefs) applyConsent(prefs);
      }
    });
  }

  // ─── DOM injection ──────────────────────────

  function injectModal() {
    if (document.getElementById('nexcore-cookie-overlay')) return; // already injected
    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildModalHTML();
    while (wrapper.firstChild) {
      document.body.appendChild(wrapper.firstChild);
    }
  }

  // ─── Initialise ─────────────────────────────

  function init() {
    migrateOldConsent();
    injectModal();
    bindEvents();

    var prefs = getPrefs();
    if (!prefs) {
      // First visit — show the modal
      showModal();
    } else {
      // Returning visitor — honour stored preferences
      applyConsent(prefs);
      // Show the floating settings button so users can revisit choices
      var btn = document.getElementById('nexcore-cookie-settings-btn');
      if (btn) {
        btn.classList.add('ncc-btn-visible');

        // Hide the button when the footer enters the viewport so it never
        // overlaps footer text. IntersectionObserver has zero scroll-event cost.
        var footer = document.querySelector('footer');
        if (footer && 'IntersectionObserver' in window) {
          var footerObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                btn.style.opacity = '0';
                btn.style.pointerEvents = 'none';
              } else {
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
              }
            });
          }, { threshold: 0 });
          footerObserver.observe(footer);
        }
      }
    }

    // Public API — accessible via window.nexcoreConsent
    window.nexcoreConsent = {
      get: getPrefs,
      open: showModal,
      accept: function () {
        savePrefs({ necessary: true, analytics: true, external_media: true, ai_services: true });
        closeModal();
      },
      reject: function () {
        savePrefs({ necessary: true, analytics: false, external_media: false, ai_services: false });
        closeModal();
      },
      reset: function () {
        localStorage.removeItem(PREF_KEY);
        clearGACookies();
        window.location.reload();
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
