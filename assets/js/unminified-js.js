// script.js — all custom JS for NexCore site

// Simple analytics: track page visits
async function trackVisit() {
  try {
    await fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page_path: window.location.pathname
      })
    });
  } catch (e) {
    // silent fail – analytics should never break UX
  }
}

window.addEventListener("load", trackVisit);

document.addEventListener("DOMContentLoaded", () => {
  const pageLang = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
  const isArabic = pageLang.startsWith("ar") || /(^|\/)ar(\/|$)/.test(window.location.pathname);
  const locale = isArabic ? {
    lang: "ar",
    dir: "rtl",
    formRequired: "يرجى تعبئة جميع الحقول.",
    formSending: "جارٍ الإرسال...",
    formError: "تعذر إرسال الرسالة. حاول مرة أخرى.",
    menuHint: "&#x1F44B; أنا القائمة",
    rotator: [
      `<div class="flag-includes"><img src="../assets/images/oman.webp" alt="علم عمان"><span>صُنع بفخر في عمان</span></div>`,
      `<i class="fa-solid fa-user-shield"></i> نراعي قوانين حماية البيانات في عُمان`,
      "الفارق بين الجيد والممتاز هو الاهتمام.",
      "حقيقي. مفيد. منجز.",
      "اعرض · اكتشف · تعاون",
      'محسّن لـ <i class="fa-brands fa-edge" aria-hidden="true"></i> و <i class="fa-brands fa-android" aria-hidden="true"></i>',
    ],
  } : {
    lang: "en",
    dir: "ltr",
    formRequired: "Please fill all fields.",
    formSending: "Sending...",
    formError: "We couldn't send your message. Please try again.",
    menuHint: "&#x1F44B; I'm the menu",
    rotator: [
      `<div class="flag-includes"><img src="assets/images/oman.webp" alt="Oman flag"><span>Proudly Built in Oman</span></div>`,
      `<i class="fa-solid fa-user-shield"></i> Designed with Oman data protection in mind`,
      "The margin between good and great is care.",
      "Real. Useful. Done.",
      "Showcase • Discover • Collaborate",
      'Enhanced for <i class="fa-brands fa-edge" aria-hidden="true"></i> & <i class="fa-brands fa-android" aria-hidden="true"></i>',
    ],
  };

  function setNotice(message, isError) {
    if (window.showToast) {
      window.showToast(message, isError);
    } else if (notice) {
      notice.textContent = message;
      notice.style.display = message ? "" : "none";
      notice.setAttribute("dir", locale.dir);
      notice.setAttribute("lang", locale.lang);
    }
  }

  function applyLocalizedFormAndModalDirection() {
    document.querySelectorAll("form, .modal, .modal-overlay, [role='dialog']").forEach((el) => {
      el.setAttribute("lang", locale.lang);
      el.setAttribute("dir", locale.dir);
    });

    document.querySelectorAll("input[type='text'], input[type='search'], input[type='email'], input[type='url'], textarea").forEach((el) => {
      el.setAttribute("dir", "auto");
      el.setAttribute("lang", locale.lang);
    });
  }

  const setupSign = () => {
    const sign = document.querySelector(".nexcore-sign") || document.getElementById("nexcoreSign");
    if (sign) {
      sign.style.cursor = "default";
      sign.style.transition = "opacity 0.3s ease";
      
      sign.addEventListener("click", (e) => {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
        
        // Fallback for browsers that don't support smooth scroll or if interrupted
        setTimeout(() => {
          if (window.scrollY > 0) {
            window.scrollTo(0, 0);
          }
        }, 600);
      });
    }
  };
  setupSign();

  const navList = document.getElementById("navList") || document.getElementById("navListHub");
  const navLinks = document.querySelectorAll(".nav-link");
  const revealItems = document.querySelectorAll(".reveal");
  const glass = document.getElementById("glassCard");
  const yearEl = document.getElementById("year") || document.getElementById("yearHub");
  const form = document.getElementById("contactForm");
  const notice = document.getElementById("formNotice");
  const resetBtn = document.getElementById("resetBtn");
  const logoImg = document.getElementById("logoImg");
  const mainContent = document.querySelector("main");
  const myDropdown = document.getElementById("myDropdown");
  const coreMenu = document.getElementById("coreMenu");
  const phone = document.getElementById("phoneMockup");
  const links = document.querySelectorAll("a.fade");
  const searchInput = document.getElementById("projectSearch");
  const projectsContainer = document.getElementById("projects-container");

  applyLocalizedFormAndModalDirection();
  initLivingReleaseBeacon({ isArabic, locale });

  // Smooth scroll to the top when the logo is clicked
  const logoTrigger = document.getElementById("logo");
  if (logoTrigger) {
    logoTrigger.addEventListener("click", function (event) {
      event.preventDefault();
      if (window.scrollY === 0) {
        if (mainContent) mainContent.style.opacity = "0";
        if (myDropdown) myDropdown.style.opacity = "0";
        if (logoImg) {
          logoImg.style.opacity = "0.8";
          logoImg.style.left = "50%";
          logoImg.style.top = "10%";
          logoImg.style.width = "600px";
        }
        setTimeout(() => { window.location.href = "index.html"; }, 1000);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  // set year
if (yearEl) {
    const currentYear = new Date().getFullYear().toString();
    
    // Check if the current page is set to Arabic or Right-To-Left
    const isArabic = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';

    if (isArabic) {
        // Apply Eastern Arabic numerals for the Arabic page
        yearEl.textContent = currentYear.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
    } else {
        // Keep standard numbers for the English page
        yearEl.textContent = currentYear;
    }
}

  // smooth scroll offset for anchored links on same page
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (ev) => {
      const href = a.getAttribute("href");
      if (href === "#") return;
      const target = document.getElementById(href.slice(1));
      if (!target) return;
      ev.preventDefault();
      const headerOffset = 82;
      const documentScroller = document.scrollingElement;
      const scrollContainer = documentScroller && documentScroller.scrollHeight > documentScroller.clientHeight
        ? documentScroller
        : document.body;
      const elementPosition = target.getBoundingClientRect().top + scrollContainer.scrollTop;
      const offsetPosition = elementPosition - headerOffset;
      scrollContainer.scrollTo({ top: offsetPosition, behavior: "smooth" });
      if (window.location.hash !== href) {
        window.history.pushState(null, "", href);
      }

      if (window.innerWidth <= 980 && navList && navList.style.display === "flex") {
        navList.style.display = "";
      }
    });
  });

  // scroll spy (active nav)
  const sections = Array.from(document.querySelectorAll("main section[id]"));
  if (sections.length > 0) {
    window.addEventListener("scroll", () => {
      const fromTop = window.scrollY + 120;
      let current = sections[0].id;
      for (const sec of sections) {
        if (sec.offsetTop <= fromTop) current = sec.id;
      }
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${current}` || link.getAttribute("href") === current);
      });
    }, { passive: true });
  }

  // Reveal elements on scroll using IntersectionObserver (more robust)
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealItems.forEach(el => revealObserver.observe(el));

  // Image Lazy Loading Fix using IntersectionObserver
  const imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const handleLoad = () => img.classList.add("is-loaded");
        if (img.complete) {
          handleLoad();
        } else {
          img.addEventListener("load", handleLoad);
        }
        imgObserver.unobserve(img);
      }
    });
  }, { rootMargin: "50px" });

  document.querySelectorAll('img[loading="lazy"]').forEach(img => imgObserver.observe(img));

  // subtle parallax on glass card with mouse move
  if (glass) {
    document.addEventListener("mousemove", (e) => {
      const rect = glass.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      glass.style.transform = `translate3d(${dx * 8}px, ${dy * 8}px, 0) rotate(${dx * 1.2}deg)`;
    });
    document.addEventListener("mouseleave", () => { glass.style.transform = ""; });
  }

  // Contact form handling
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const name = form.elements.namedItem("name")?.value.trim();
      const email = form.elements.namedItem("email")?.value.trim();
      const message = form.elements.namedItem("message")?.value.trim();

      if (!name || !email || !message) {
        setNotice(locale.formRequired, true);
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton?.textContent;

      if (submitButton) submitButton.disabled = true;
      setNotice(locale.formSending);

      try {
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" }
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
          throw new Error(result.message || "Web3Forms submission failed");
        }

        window.location.assign(form.dataset.successUrl || "/thanks.html");
      } catch (error) {
        console.error("Contact form submission failed:", error);
        setNotice(locale.formError, true);
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (form) form.reset();
      if (notice) notice.textContent = "";
    });
  }

  // respect reduced motion
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (media && media.matches) {
    document.querySelectorAll(".bg-orbit").forEach((n) => (n.style.animation = "none"));
    document.querySelectorAll(".reveal").forEach((n) => n.classList.add("visible"));
  }

  // Changing Text Rotator
  const textElement = document.getElementById("changing-text");
  if (textElement) {
    const sentences = locale.rotator;

    let index = 0;
    textElement.innerHTML = sentences[index];

    setInterval(() => {
      textElement.classList.add("fade-out");
      setTimeout(() => {
        index = (index + 1) % sentences.length;
        textElement.innerHTML = sentences[index];
        void textElement.offsetHeight;
        textElement.classList.remove("fade-out");
      }, 550);
    }, 3000);
  }

  // Menu hint — show speech bubble on first visit only
  if (coreMenu && !localStorage.getItem('nx_mh')) {
    const hint = document.createElement('span');
    hint.className = 'menu-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.setAttribute('lang', locale.lang);
    hint.setAttribute('dir', locale.dir);
    hint.innerHTML = locale.menuHint;
    coreMenu.parentElement.appendChild(hint);

    const removeHint = () => {
      hint.style.animation = 'none';
      hint.style.opacity = '0';
      localStorage.setItem('nx_mh', '1');
      setTimeout(() => hint.remove(), 400);
    };

    setTimeout(removeHint, 9800);
    coreMenu.addEventListener('click', removeHint, { once: true });
  }

  // Dropdown Menu Logic
  if (coreMenu && myDropdown) {
    const setMenuOpen = (open, { restoreFocus = false } = {}) => {
      coreMenu.classList.toggle("active", open);
      coreMenu.setAttribute("aria-expanded", String(open));
      myDropdown.style.visibility = open ? "visible" : "hidden";
      myDropdown.style.opacity = open ? 1 : 0;
      myDropdown.style.transform = open ? "translateY(10px)" : "translateY(0)";
      myDropdown.style.userSelect = open ? "auto" : "none";
      if (open) myDropdown.querySelector("a, button, input")?.focus();
      if (!open && restoreFocus) coreMenu.focus();
    };

    coreMenu.addEventListener("click", () => {
      setMenuOpen(coreMenu.getAttribute("aria-expanded") !== "true");
    });

    document.addEventListener("click", (event) => {
      if (!coreMenu.contains(event.target) && !myDropdown.contains(event.target)) {
        setMenuOpen(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && coreMenu.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        setMenuOpen(false, { restoreFocus: true });
      }
    });
  }

  // Mobile Preview Transition
  if (phone) {
    phone.addEventListener("click", () => {
      phone.classList.add("expand");
      setTimeout(() => { window.location.href = "mobile-preview.html"; }, 900);
    });
  }

  // Fade links
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.href;
      if (!href) return;
      event.preventDefault();
      if (mainContent) mainContent.style.opacity = "0";
      if (myDropdown) myDropdown.style.opacity = "0";
      if (logoImg) {
        logoImg.style.opacity = "0.8";
        logoImg.style.left = "50%";
        logoImg.style.top = "10%";
        logoImg.style.width = "600px";
      }
      setTimeout(() => { window.location.href = href; }, 1000);
    });
  });

  // Project Search
  if (searchInput && projectsContainer) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase();
      const projectCards = projectsContainer.querySelectorAll(".project-card");
      projectCards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? "block" : "none";
      });
    });
  }

  // Initial animation
  if (logoImg) {
    logoImg.style.filter = "drop-shadow(0 0 25px rgba(110, 231, 243, 1))";
    logoImg.style.webkitFilter = "drop-shadow(0 0 25px rgba(110, 231, 243, 1))";
    logoImg.style.left = "100%";
    logoImg.style.top = "15%";
    logoImg.style.width = "200px";
    setTimeout(() => { logoImg.style.opacity = "0.3"; }, 1000);
  }
  
  if (mainContent) {
    mainContent.style.opacity = "1";
  }
});

async function initLivingReleaseBeacon({ isArabic, locale }) {
  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const normalizedPath = window.location.pathname
    .replace(/\.html$/, "")
    .replace(/\/index$/, "")
    .replace(/\/$/, "") || "/";
  const publicPaths = new Set([
    "/", "/ar", "/hub", "/ar/hub", "/initiatives", "/ar/initiatives",
    "/contribute", "/ar/contribute", "/how-to-use", "/ar/how-to-use",
    "/faq", "/ar/faq", "/roadmap", "/ar/roadmap", "/terms", "/ar/terms",
    "/privacy-policy", "/ar/privacy-policy", "/pricing-policy", "/ar/pricing-policy"
  ]);
  if (!publicPaths.has(normalizedPath)) return;

  const navContainer = document.querySelector(".navbar .nav-container");
  const logo = navContainer?.querySelector(".logo");
  if (!navContainer || !logo) return;

  let storage;
  try {
    storage = window.localStorage;
    const storageProbe = "nx_release_storage_probe";
    storage.setItem(storageProbe, "1");
    storage.removeItem(storageProbe);
  } catch (error) {
    return;
  }

  let release;
  try {
    const dataUrl = isArabic ? "/assets/data/releases.json" : "/assets/data/releases.json";
    const response = await fetch(dataUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const payload = await response.json();
    release = payload.releases?.find((item) => item.visitor_announcement?.enabled === true);
  } catch (error) {
    return;
  }

  const language = isArabic ? "ar" : "en";
  const announcement = release?.visitor_announcement;
  const title = release?.title?.[language];
  const benefit = announcement?.benefit?.[language];
  const highlights = announcement?.highlights?.[language];
  if (!release?.version || !title || !benefit || !Array.isArray(highlights)
      || highlights.length !== 3 || highlights.some((item) => typeof item !== "string" || !item.trim())) return;

  const versionToken = release.version.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const openedKey = `nx_release_${versionToken}_opened`;
  const dismissedKey = `nx_release_${versionToken}_dismissed`;
  if (storage.getItem(dismissedKey) === "1") return;

  const copy = isArabic ? {
    newIn: "جديد في NexCore",
    close: "إغلاق تفاصيل التحديث",
    open: `استكشف الجديد في ${release.version}`,
    explore: "استكشف الجديد",
    dismiss: "عدم الإظهار مرة أخرى",
    liveOpen: `تم فتح تفاصيل إصدار ${release.version}`,
    liveClosed: "تم إغلاق تفاصيل الإصدار"
  } : {
    newIn: "New in NexCore",
    close: "Close update details",
    open: `Explore what is new in ${release.version}`,
    explore: "Explore what’s new",
    dismiss: "Dismiss",
    liveOpen: `${release.version} update details opened`,
    liveClosed: "Update details closed"
  };
  const panelId = `living-release-${versionToken}`;
  const titleId = `${panelId}-title`;
  const releaseAnchor = release.version.replace(/^v/i, "v").replace(/\./g, "-").toLowerCase();
  const releaseHref = `${isArabic ? "/ar/releases" : "/releases"}#${releaseAnchor}`;

  const shell = document.createElement("div");
  shell.className = "living-release";
  shell.setAttribute("lang", locale.lang);
  shell.setAttribute("dir", locale.dir);
  shell.innerHTML = `
    <button class="living-release__beacon" type="button" aria-expanded="false" aria-controls="${panelId}" aria-label="${copy.open}">
      <i class="fa-solid fa-circle-dot" aria-hidden="true"></i>
    </button>
    <section class="living-release__panel" id="${panelId}" role="dialog" aria-modal="false" aria-labelledby="${titleId}" hidden>
      <button class="living-release__close" type="button" aria-label="${copy.close}">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
      <p class="living-release__eyebrow"><i class="fa-solid fa-circle" aria-hidden="true"></i>${copy.newIn}</p>
      <h2 id="${titleId}"><span>${escapeHtml(release.version)}</span> — ${escapeHtml(title)}</h2>
      <p class="living-release__benefit">${escapeHtml(benefit)}</p>
      <ul class="living-release__highlights">
        ${highlights.map((item) => `<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>${escapeHtml(item)}</span></li>`).join("")}
      </ul>
      <a class="living-release__cta" href="${releaseHref}">
        <span>${copy.explore}</span><i class="fa-solid fa-arrow-${isArabic ? "left" : "right"}" aria-hidden="true"></i>
      </a>
      <button class="living-release__dismiss" type="button">${copy.dismiss}</button>
    </section>
    <span class="sr-only living-release__live" aria-live="polite"></span>`;
  logo.appendChild(shell);

  const beacon = shell.querySelector(".living-release__beacon");
  const panel = shell.querySelector(".living-release__panel");
  const closeButton = shell.querySelector(".living-release__close");
  const dismissButton = shell.querySelector(".living-release__dismiss");
  const cta = shell.querySelector(".living-release__cta");
  const live = shell.querySelector(".living-release__live");

  const setOpen = (open, { restoreFocus = false, announce = true } = {}) => {
    shell.classList.toggle("is-open", open);
    panel.hidden = !open;
    beacon.setAttribute("aria-expanded", String(open));
    if (announce) live.textContent = open ? copy.liveOpen : copy.liveClosed;
    if (!open && restoreFocus) beacon.focus();
  };
  const dismiss = () => {
    storage.setItem(dismissedKey, "1");
    shell.remove();
  };

  beacon.addEventListener("click", () => setOpen(beacon.getAttribute("aria-expanded") !== "true"));
  closeButton.addEventListener("click", () => setOpen(false, { restoreFocus: true }));
  dismissButton.addEventListener("click", dismiss);
  cta.addEventListener("click", () => storage.setItem(dismissedKey, "1"));
  document.addEventListener("click", (event) => {
    if (shell.isConnected && shell.classList.contains("is-open") && !shell.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell.isConnected && shell.classList.contains("is-open")) {
      event.preventDefault();
      setOpen(false, { restoreFocus: true });
    }
  });

  if (storage.getItem(openedKey) !== "1") {
    storage.setItem(openedKey, "1");
    setOpen(true, { announce: false });
  }
}

function filterFunction() {
  const input = document.getElementById("myInput");
  const filter = input ? input.value.toUpperCase() : "";
  const div = document.getElementById("myDropdown");
  if (!div) return;
  const a = div.getElementsByTagName("a");
  for (let i = 0; i < a.length; i++) {
    const txtValue = a[i].textContent || a[i].innerText;
    if (txtValue.toUpperCase().indexOf(filter) > -1) {
      a[i].style.display = "";
    } else {
      a[i].style.display = "none";
    }
  }
}

function showWebsiteLabel() {
  const checkBox = document.getElementById("websiteShow");
  const websiteLabel = document.getElementById("websiteURLLabel");
  if (!checkBox || !websiteLabel) return;
  if (checkBox.checked) {
    websiteLabel.style.display = "block";
    websiteLabel.setAttribute("required", "required");
  } else {
    websiteLabel.style.display = "none";
    websiteLabel.removeAttribute("required");
  }
}

const bookmarkBtn = document.getElementById('bookmarkBtn');

if (bookmarkBtn) {
  bookmarkBtn.addEventListener('click', function(e) {
    e.preventDefault();

    const userAgent = navigator.userAgent || '';
    const isMobilePhone = navigator.userAgentData?.mobile
      ?? /Android|iPhone|iPod|IEMobile|Opera Mini/i.test(userAgent);

    if (isMobilePhone) {
      alert('To bookmark this page on your phone, open the browser menu or Share menu, then choose Add bookmark.');
      return;
    }

    const isMac = /Mac/i.test(userAgent);
    const shortcut = isMac ? 'Cmd + D' : 'Ctrl + D';

    alert(`To bookmark this page, press ${shortcut} on your keyboard.`);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const menu = document.getElementById('myDropdown');
  if (!menu || menu.querySelector('[data-initiatives-nav]')) return;

  const isArabic = (document.documentElement.lang || '').toLowerCase().startsWith('ar')
    || /(^|\/)ar(\/|$)/.test(window.location.pathname);
  const hubLink = [...menu.querySelectorAll('a')].find((link) => /(^|\/)hub(?:\.html)?(?:#|$)/.test(link.getAttribute('href') || ''));
  if (!hubLink) return;

  const link = document.createElement('a');
  link.href = isArabic ? '/ar/initiatives' : '/initiatives';
  link.dataset.initiativesNav = 'true';
  link.title = isArabic ? 'مبادرات NexCore Labs' : 'NexCore Labs Initiatives';
  link.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> ' + (isArabic ? 'المبادرات' : 'Initiatives');
  if (window.location.pathname.replace(/\/$/, '') === link.getAttribute('href')) link.setAttribute('aria-current', 'page');
  hubLink.insertAdjacentElement('afterend', link);
});
