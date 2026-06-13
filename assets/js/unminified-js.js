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
    menuHint: "&#x1F44B; أنا القائمة",
    rotator: [
      `<div class="flag-includes"><img src="../assets/images/oman.webp" alt="علم عمان"><span>صُنع بفخر في عمان</span></div>`,
      `<div class="flag-includes"><img src="../assets/images/oman-data-protect.webp" alt="علم عمان"><span>نراعي قوانين حماية البيانات في عُمان</span></div>`,
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
    menuHint: "&#x1F44B; I'm the menu",
    rotator: [
      `<div class="flag-includes"><img src="assets/images/oman.webp" alt="Oman flag"><span>Proudly Built in Oman</span></div>`,
      `<div class="flag-includes"><img src="assets/images/oman-data-protect.webp" alt="Oman flag"><span>Designed with Oman data protection in mind</span></div>`,
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
      const target = document.querySelector(href);
      if (!target) return;
      ev.preventDefault();
      const headerOffset = 82;
      const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });

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

  // simple form handling
  if (form) {
    form.addEventListener("submit", (ev) => {
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();
      if (!name || !email || !message) {
        ev.preventDefault();
        setNotice(locale.formRequired, true);
      } else {
        setNotice(locale.formSending);
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
    coreMenu.addEventListener("click", () => {
      coreMenu.classList.toggle("active");
      if (myDropdown.style.visibility == "visible" && myDropdown.style.opacity == 1) {
        myDropdown.style.visibility = "hidden";
        myDropdown.style.opacity = 0;
        myDropdown.style.transform = "translateY(0)";
        myDropdown.style.userSelect = "none";
      } else {
        myDropdown.style.visibility = "visible";
        myDropdown.style.opacity = 1;
        myDropdown.style.transform = "translateY(10px)";
        myDropdown.style.userSelect = "auto";
      }
    });

    document.addEventListener("click", (event) => {
      if (!coreMenu.contains(event.target) && !myDropdown.contains(event.target)) {
        coreMenu.classList.remove("active");
        myDropdown.style.visibility = "hidden";
        myDropdown.style.opacity = 0;
        myDropdown.style.transform = "translateY(0)";
        myDropdown.style.userSelect = "none";
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
