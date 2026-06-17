(function () {
  const DOTS_CORE_SVG = `
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="32" cy="10" r="5"/>
        <circle cx="51.05" cy="21" r="5"/>
        <circle cx="51.05" cy="43" r="5"/>
        <circle cx="32" cy="54" r="5"/>
        <circle cx="12.95" cy="43" r="5"/>
        <circle cx="12.95" cy="21" r="5"/>
      </g>
    </svg>`;

  const PDF_LIBS = [
    {
      id: "nexcore-html2canvas",
      src: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
      ready: () => Boolean(window.html2canvas)
    },
    {
      id: "nexcore-jspdf",
      src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      ready: () => Boolean(window.jspdf?.jsPDF)
    }
  ];

  const EN_TEXT = {
    modalTitle: "Project Card",
    brand: "NexCore Labs",
    close: "Close",
    download: "Download PDF",
    generating: "Preparing PDF...",
    failed: "PDF export is unavailable. Opening print fallback.",
    noLinks: "No project links available",
    categoryFallback: "Uncategorized",
    descriptionFallback: "No description available.",
    joined: "Joined",
    links: "Links"
  };

  const AR_TEXT = {
    modalTitle: "بطاقة المشروع",
    brand: "NexCore Labs",
    close: "إغلاق",
    download: "تنزيل PDF",
    generating: "جارٍ تجهيز ملف PDF...",
    failed: "تعذر تصدير PDF. سيتم فتح خيار الطباعة.",
    noLinks: "لا توجد روابط للمشروع",
    categoryFallback: "غير مصنف",
    descriptionFallback: "لا يوجد وصف متاح.",
    joined: "تاريخ الانضمام",
    links: "الروابط"
  };

  let lastFocusedElement = null;

  function isArabicPage() {
    const lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    return lang.startsWith("ar") || document.documentElement.getAttribute("dir") === "rtl" || /(^|\/)ar(\/|$)/.test(window.location.pathname);
  }

  function getCopy() {
    return isArabicPage() ? AR_TEXT : EN_TEXT;
  }

  function setProjectCardSource(project, options = {}) {
    window.nexcoreProjectCardSource = {
      project: project || {},
      links: Array.isArray(options.links) ? options.links : buildProjectCardLinks(project || {}),
      categoryLabel: options.categoryLabel || getProjectCategoryLabel(project?.category),
      locale: options.locale || (isArabicPage() ? "ar-OM" : "en-US")
    };
  }

  function buildProjectCardLinks(project) {
    const links = [];
    if (project.website) links.push({ icon: "fas fa-globe", label: "Website", platform: "website", url: project.website });
    if (project.x_url) links.push({ icon: "fab fa-x-twitter", label: "X", platform: "x", url: project.x_url });
    if (project.github_url) links.push({ icon: "fab fa-github", label: "GitHub", platform: "github", url: project.github_url });
    if (project.linkedin_url) links.push({ icon: "fab fa-linkedin", label: "LinkedIn", platform: "linkedin", url: project.linkedin_url });
    if (project.instagram_url) links.push({ icon: "fab fa-instagram", label: "Instagram", platform: "instagram", url: project.instagram_url });
    return links;
  }

  function getProjectCategoryLabel(value) {
    const copy = getCopy();
    const key = window.ProjectCategories?.displayCategory ? window.ProjectCategories.displayCategory(value) : String(value || "").trim();
    if (!key) return copy.categoryFallback;
    if (isArabicPage() && window.NEXCORE_AR_CATEGORY_LABELS) {
      return window.NEXCORE_AR_CATEGORY_LABELS[key] || window.NEXCORE_AR_CATEGORY_LABELS.uncategorized || copy.categoryFallback;
    }
    return window.ProjectCategories?.CATEGORY_LABELS?.[key] || key.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatProjectDate(value, locale) {
    if (!value) {
      return (document.getElementById("createdDate")?.textContent || "-").trim();
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(locale || (isArabicPage() ? "ar-OM" : "en-US"), {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function normalizeUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return null;
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch (error) {
      return null;
    }
  }

  function extractLinkDisplayName(url, platform) {
    const parsed = normalizeUrl(url);
    if (!parsed) return String(url || "").trim();

    const host = parsed.hostname.replace(/^www\./i, "");
    const cleanPlatform = String(platform || "").toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    let handleSegment = pathParts[0] || "";
    if (host.endsWith("linkedin.com") && ["in", "company", "school"].includes(handleSegment.toLowerCase()) && pathParts[1]) {
      handleSegment = pathParts[1];
    }
    const socialHosts = ["instagram.com", "x.com", "twitter.com", "github.com", "linkedin.com"];
    const shouldUseHandle = cleanPlatform !== "website" && (socialHosts.some((name) => host.endsWith(name)) || handleSegment);

    if (shouldUseHandle && handleSegment && !["share", "intent"].includes(handleSegment.toLowerCase())) {
      return `@${decodeURIComponent(handleSegment).replace(/^@/, "")}`;
    }

    return host;
  }

  function getProjectCardData() {
    const source = window.nexcoreProjectCardSource || {};
    const project = source.project || {};
    const copy = getCopy();
    const links = (source.links || buildProjectCardLinks(project)).map((link) => ({
      ...link,
      displayName: extractLinkDisplayName(link.url, link.platform || link.label)
    }));

    return {
      name: project.name || document.getElementById("projectName")?.textContent?.trim() || "Untitled Project",
      id: project.public_id || document.getElementById("projectId")?.textContent?.trim() || "Proj-#",
      category: source.categoryLabel || getProjectCategoryLabel(project.category),
      description: project.card_description || project.page_description || document.getElementById("pageDescription")?.textContent?.trim() || copy.descriptionFallback,
      joinedDate: formatProjectDate(project.created_at, source.locale),
      links
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildProjectCardMarkup(data) {
    const copy = getCopy();
    const linksMarkup = data.links.length
      ? data.links.map((link) => `
          <li class="project-card-link-pill">
            ${link.icon ? `<i class="${escapeHtml(link.icon)}" aria-hidden="true"></i>` : ""}
            <span class="project-card-link-text">${escapeHtml(link.displayName)}</span>
          </li>`).join("")
      : `<li class="project-card-empty-links">${escapeHtml(copy.noLinks)}</li>`;

    return `
      <div class="project-card-watermark">${DOTS_CORE_SVG}</div>
      <div class="project-card-preview-content">
        <div class="project-card-preview-top">
          <div>
            <div class="project-card-brand">${DOTS_CORE_SVG}<span>${escapeHtml(copy.brand)}</span></div>
            <h3 class="project-card-title">${escapeHtml(data.name)}</h3>
          </div>
          <span class="project-card-id">${escapeHtml(data.id)}</span>
        </div>
        <span class="project-card-category">${escapeHtml(data.category)}</span>
        <p class="project-card-description">${escapeHtml(data.description)}</p>
        <div class="project-card-preview-bottom">
          <div>
            <span class="project-card-meta-label">${escapeHtml(copy.joined)}</span>
            <span class="project-card-meta-value">${escapeHtml(data.joinedDate)}</span>
          </div>
          <div>
            <span class="project-card-links-label">${escapeHtml(copy.links)}</span>
            <ul class="project-card-links">${linksMarkup}</ul>
          </div>
        </div>
      </div>`;
  }

  function ensureProjectCardModal() {
    let modal = document.getElementById("projectCardModal");
    if (modal) return modal;

    const copy = getCopy();
    modal = document.createElement("div");
    modal.id = "projectCardModal";
    modal.className = "project-card-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "projectCardModalTitle");
    modal.innerHTML = `
      <div class="project-card-modal-panel" role="document">
        <div class="project-card-modal-header">
          <h2 id="projectCardModalTitle"><span class="project-card-core-icon">${DOTS_CORE_SVG}</span>${escapeHtml(copy.modalTitle)}</h2>
          <button class="project-card-modal-close" id="projectCardCloseBtn" type="button" aria-label="${escapeHtml(copy.close)}">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="project-card-modal-body">
          <div class="project-card-preview" id="projectCardPreview" aria-live="polite"></div>
        </div>
        <div class="project-card-modal-actions">
          <p class="project-card-status" id="projectCardStatus" role="status"></p>
          <button class="btn primary" id="projectCardDownloadBtn" type="button">
            <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> ${escapeHtml(copy.download)}
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    document.getElementById("projectCardCloseBtn")?.addEventListener("click", closeProjectCardModal);
    document.getElementById("projectCardDownloadBtn")?.addEventListener("click", downloadProjectCardPDF);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeProjectCardModal();
    });

    return modal;
  }

  function renderProjectCardPreview() {
    const modal = ensureProjectCardModal();
    const preview = modal.querySelector("#projectCardPreview");
    if (preview) preview.innerHTML = buildProjectCardMarkup(getProjectCardData());
  }

  function openProjectCardModal() {
    const modal = ensureProjectCardModal();
    renderProjectCardPreview();
    lastFocusedElement = document.activeElement;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    modal.querySelector("#projectCardCloseBtn")?.focus();
  }

  function closeProjectCardModal() {
    const modal = document.getElementById("projectCardModal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function setStatus(message, isError = false) {
    const status = document.getElementById("projectCardStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function loadScriptOnce(config) {
    if (config.ready()) return Promise.resolve();
    const existing = document.getElementById(config.id);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.id = config.id;
      script.src = config.src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensurePdfLibraries() {
    // html2canvas and jsPDF are loaded lazily because project pages are pure static HTML and need client-side PDF capture only for this action.
    for (const lib of PDF_LIBS) {
      await loadScriptOnce(lib);
      if (!lib.ready()) throw new Error(`PDF library failed to initialize: ${lib.id}`);
    }
  }

  function buildProjectCardFilename(data) {
    const name = String(data.name || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
    const id = String(data.id || "card").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "card";
    return `${name}-${id}-card.pdf`;
  }

  function printProjectCardFallback() {
    document.body.classList.add("project-card-printing");
    window.print();
    setTimeout(() => document.body.classList.remove("project-card-printing"), 500);
  }

  function createProjectCardExportClone(preview) {
    const wrapper = document.createElement("div");
    const clone = preview.cloneNode(true);

    clone.id = "projectCardPreviewExport";
    clone.style.width = "720px";
    clone.style.maxWidth = "none";
    clone.style.minHeight = "420px";
    clone.style.margin = "0";

    wrapper.setAttribute("aria-hidden", "true");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-10000px";
    wrapper.style.top = "0";
    wrapper.style.width = "720px";
    wrapper.style.pointerEvents = "none";
    wrapper.style.zIndex = "-1";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    return { wrapper, clone };
  }

  async function downloadProjectCardPDF() {
    const copy = getCopy();
    const data = getProjectCardData();
    const preview = document.getElementById("projectCardPreview");
    const downloadBtn = document.getElementById("projectCardDownloadBtn");
    if (!preview) return;

    setStatus(copy.generating);
    if (downloadBtn) downloadBtn.disabled = true;

    let exportWrapper = null;

    try {
      await ensurePdfLibraries();
      const { wrapper, clone } = createProjectCardExportClone(preview);
      exportWrapper = wrapper;
      const exportScale = Math.max(4, Math.min(5, (window.devicePixelRatio || 1) * 3));
      const canvas = await window.html2canvas(clone, {
        backgroundColor: null,
        scale: exportScale,
        useCORS: true
      });
      const image = canvas.toDataURL("image/png");
      const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      const x = (pageWidth - width) / 2;
      const y = (pageHeight - height) / 2;

      pdf.addImage(image, "PNG", x, y, width, height);
      pdf.save(buildProjectCardFilename(data));
      setStatus("");
    } catch (error) {
      console.error("Project card PDF export failed:", error);
      setStatus(copy.failed, true);
      setTimeout(printProjectCardFallback, 600);
    } finally {
      if (exportWrapper) exportWrapper.remove();
      if (downloadBtn) downloadBtn.disabled = false;
    }
  }

  function setupProjectCardButton(project, options = {}) {
    setProjectCardSource(project, options);
    const button = document.getElementById("projectCardBtn");
    if (!button) return;
    const newButton = button.cloneNode(true);
    button.replaceWith(newButton);
    newButton.addEventListener("click", openProjectCardModal);
  }

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("projectCardModal");
    if (!modal?.classList.contains("open")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeProjectCardModal();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])"))
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.getProjectCardData = getProjectCardData;
  window.extractLinkDisplayName = extractLinkDisplayName;
  window.openProjectCardModal = openProjectCardModal;
  window.closeProjectCardModal = closeProjectCardModal;
  window.downloadProjectCardPDF = downloadProjectCardPDF;
  window.setupProjectCardButton = setupProjectCardButton;
  window.setProjectCardSource = setProjectCardSource;
})();
