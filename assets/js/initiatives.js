(function () {
  "use strict";

  const DATA_URL = "/assets/data/initiatives.json";
  const PAGE_SIZE = 12;
  const COPY = {
    en: {
      type: "Type",
      area: "Area",
      status: "Status",
      all: "All",
      searchPlaceholder: "Search initiatives",
      results: (count) => `${count} initiative${count === 1 ? "" : "s"} found`,
      noResults: "No initiatives match those filters yet.",
      loadMore: "Load more initiatives",
      launch: "Launched",
      team: "Team",
      open: "Explore initiative",
      error: "The initiative directory is unavailable right now. Please try again shortly.",
      notFound: "This initiative could not be found.",
      labels: {
        type: { platform: "Platform", program: "Program", campaign: "Campaign", event: "Event" },
        status: { active: "Active", beta: "Beta", upcoming: "Upcoming", completed: "Completed", archived: "Archived" },
        category: {
          "academic-learning": "Academic & Learning",
          "campus-services": "Campus Services",
          "research-innovation": "Research & Innovation",
          community: "Community",
          "student-life": "Student Life",
          "digital-infrastructure": "Digital Infrastructure"
        }
      }
    },
    ar: {
      type: "النوع",
      area: "المجال",
      status: "الحالة",
      all: "الكل",
      searchPlaceholder: "ابحث في المبادرات",
      results: (count) => `تم العثور على ${count} مبادرة`,
      noResults: "لا توجد مبادرات تطابق عوامل التصفية حالياً.",
      loadMore: "عرض المزيد من المبادرات",
      launch: "سنة الإطلاق",
      team: "الفريق",
      open: "استكشف المبادرة",
      error: "دليل المبادرات غير متاح حالياً. يرجى المحاولة بعد قليل.",
      notFound: "تعذر العثور على هذه المبادرة.",
      labels: {
        type: { platform: "منصة", program: "برنامج", campaign: "حملة", event: "فعالية" },
        status: { active: "نشطة", beta: "تجريبية", upcoming: "قريباً", completed: "مكتملة", archived: "مؤرشفة" },
        category: {
          "academic-learning": "التعلّم والموارد الأكاديمية",
          "campus-services": "خدمات الحرم الجامعي",
          "research-innovation": "البحث والابتكار",
          community: "المجتمع",
          "student-life": "الحياة الطلابية",
          "digital-infrastructure": "البنية الرقمية"
        }
      }
    }
  };

  const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  const getLocale = () => document.documentElement.lang === "ar" || document.documentElement.dir === "rtl" ? "ar" : "en";
  const getCopy = () => COPY[getLocale()];
  const label = (group, key) => getCopy().labels[group][key] || key;
  const initiativeCopy = (initiative) => initiative[getLocale()] || initiative.en;

  async function loadInitiatives() {
    const response = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Initiatives request failed: ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload.initiatives) ? payload.initiatives : [];
  }

  const statusBadge = (initiative) => `
    <span class="initiative-badge initiative-badge--${escapeHtml(initiative.status)}">${escapeHtml(label("status", initiative.status))}</span>
    ${initiative.communityDriven ? `<span class="initiative-badge initiative-badge--community"><i class="fa-solid fa-people-group" aria-hidden="true"></i>${getLocale() === "ar" ? "يقودها المجتمع" : "Community Driven"}</span>` : ""}
  `;

  function renderCard(initiative) {
    const text = initiativeCopy(initiative);
    const primary = initiative.links && initiative.links.primary;
    const external = /^https?:/i.test(primary || "");
    const ctaLabel = text.primaryCta || getCopy().open;
    return `
      <article class="initiative-card" data-initiative-card data-type="${escapeHtml(initiative.type)}" data-status="${escapeHtml(initiative.status)}" data-category="${escapeHtml(initiative.category)}">
        <div class="initiative-card-top">
          <span class="initiative-card-icon" aria-hidden="true"><i class="fa-solid ${escapeHtml(initiative.visual?.icon || "fa-lightbulb")}"></i></span>
          <span class="initiative-type"><i class="fa-solid fa-layer-group" aria-hidden="true"></i>${escapeHtml(label("type", initiative.type))}</span>
        </div>
        <div class="initiative-badges">${statusBadge(initiative)}</div>
        <h3>${escapeHtml(text.name)}</h3>
        <p class="initiative-card-summary">${escapeHtml(text.summary)}</p>
        <div class="initiative-card-meta">
          <span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHtml(getCopy().launch)} ${escapeHtml(initiative.launchYear)}</span>
          <span><i class="fa-solid fa-users" aria-hidden="true"></i>${escapeHtml(text.teamLabel)}</span>
        </div>
        <div class="initiative-card-footer">
          <span class="initiative-badge">${escapeHtml(label("category", initiative.category))}</span>
          ${primary ? `<a class="initiative-link" href="${escapeHtml(primary)}"${external ? " target=\"_blank\" rel=\"noopener\"" : ""}>${escapeHtml(ctaLabel)} <i class="fa-solid ${external ? "fa-arrow-up-right-from-square" : "fa-arrow-right"}" aria-hidden="true"></i></a>` : ""}
        </div>
      </article>
    `;
  }

  function mountDirectory(initiatives) {
    const root = document.querySelector("[data-initiative-directory]");
    if (!root) return;
    const grid = root.querySelector("[data-initiative-grid]");
    const search = root.querySelector("[data-initiative-search]");
    const resultSummary = root.querySelector("[data-initiative-results]");
    const loadMore = root.querySelector("[data-initiative-load-more]");
    const typeRow = root.querySelector('[data-initiative-filter="type"]')?.parentElement;
    if (typeRow && !root.querySelector('[data-initiative-filter="category"]')) {
      const categoryRow = document.createElement("div");
      categoryRow.className = "initiative-filter-row";
      categoryRow.setAttribute("role", "group");
      categoryRow.setAttribute("aria-label", getLocale() === "ar" ? "التصفية حسب المجال" : "Filter by area");
      const categories = Object.keys(getCopy().labels.category);
      categoryRow.innerHTML = ["all", ...categories].map((category) => {
        const name = category === "all" ? (getLocale() === "ar" ? "كل المجالات" : "All areas") : label("category", category);
        return `<button class="initiative-filter${category === "all" ? " is-active" : ""}" type="button" data-initiative-filter="category" data-value="${escapeHtml(category)}" aria-pressed="${category === "all"}">${escapeHtml(name)}</button>`;
      }).join("");
      typeRow.insertAdjacentElement("afterend", categoryRow);
    }
    const filterButtons = Array.from(root.querySelectorAll("[data-initiative-filter]"));
    const state = { query: "", type: "all", status: "all", category: "all", visible: PAGE_SIZE };
    const featured = initiatives.filter((initiative) => initiative.featured);
    const sorted = [...initiatives].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.launchYear - b.launchYear);

    function filtered() {
      const query = state.query.trim().toLocaleLowerCase(getLocale() === "ar" ? "ar" : "en");
      return sorted.filter((initiative) => {
        const text = initiativeCopy(initiative);
        const searchable = `${text.name} ${text.summary} ${initiative.type} ${initiative.status} ${initiative.category}`.toLocaleLowerCase(getLocale() === "ar" ? "ar" : "en");
        return (state.type === "all" || initiative.type === state.type)
          && (state.status === "all" || initiative.status === state.status)
          && (state.category === "all" || initiative.category === state.category)
          && (!query || searchable.includes(query));
      });
    }

    function render() {
      const matches = filtered();
      const visible = matches.slice(0, state.visible);
      resultSummary.textContent = getCopy().results(matches.length);
      if (!matches.length) {
        grid.innerHTML = `<div class="initiative-empty"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>${escapeHtml(getCopy().noResults)}</div>`;
      } else {
        grid.innerHTML = visible.map(renderCard).join("");
      }
      loadMore.hidden = matches.length <= state.visible;
      loadMore.textContent = getCopy().loadMore;
      root.querySelectorAll("[data-featured-initiative]").forEach((element) => {
        const activeFeatured = featured[0];
        if (!activeFeatured) return;
        const text = initiativeCopy(activeFeatured);
        element.innerHTML = `
          <div>
            <div class="initiative-badges">${statusBadge(activeFeatured)}</div>
            <h2>${escapeHtml(text.name)}</h2>
            <p>${escapeHtml(text.description)}</p>
            <a class="btn primary" href="${escapeHtml(activeFeatured.links.primary)}" target="_blank" rel="noopener">${escapeHtml(text.primaryCta)} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
          </div>
          <aside class="featured-initiative-aside" aria-label="${getLocale() === "ar" ? "ما يقدمه Study Hub" : "What Study Hub offers"}">
            <span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>${getLocale() === "ar" ? "مواد دراسية قابلة للبحث" : "Searchable study materials"}</span>
            <span><i class="fa-solid fa-people-group" aria-hidden="true"></i>${getLocale() === "ar" ? "مساهمات من المجتمع" : "Community contributions"}</span>
            <span><i class="fa-solid fa-circle-check" aria-hidden="true"></i>${getLocale() === "ar" ? "مسار للتحقق" : "Verification workflow"}</span>
            <span><i class="fa-brands fa-google-drive" aria-hidden="true"></i>${getLocale() === "ar" ? "تكامل Google Drive" : "Google Drive integration"}</span>
          </aside>
        `;
      });
    }

    filterButtons.forEach((button) => button.addEventListener("click", () => {
      const group = button.dataset.initiativeFilter;
      state[group] = button.dataset.value || "all";
      state.visible = PAGE_SIZE;
      filterButtons.filter((item) => item.dataset.initiativeFilter === group).forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      render();
    }));

    search.addEventListener("input", () => { state.query = search.value; state.visible = PAGE_SIZE; render(); });
    loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; render(); });
    search.placeholder = getCopy().searchPlaceholder;
    render();
  }

  function mountDetail(initiatives) {
    const root = document.querySelector("[data-initiative-detail]");
    if (!root) return;
    const slug = root.dataset.initiativeDetail || new URLSearchParams(window.location.search).get("slug");
    const initiative = initiatives.find((item) => item.slug === slug);
    if (!initiative) {
      root.innerHTML = `<div class="initiative-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>${escapeHtml(getCopy().notFound)}</div>`;
      return;
    }
    const text = initiativeCopy(initiative);
    root.innerHTML = `
      <div class="initiative-detail-shell">
        <span class="initiative-type"><i class="fa-solid ${escapeHtml(initiative.visual?.icon || "fa-lightbulb")}" aria-hidden="true"></i>${escapeHtml(label("type", initiative.type))}</span>
        <h1>${escapeHtml(text.name)}</h1>
        <div class="initiative-badges">${statusBadge(initiative)}</div>
        <p>${escapeHtml(text.description)}</p>
        <div class="initiative-detail-meta">
          <span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHtml(getCopy().launch)} ${escapeHtml(initiative.launchYear)}</span>
          <span><i class="fa-solid fa-users" aria-hidden="true"></i>${escapeHtml(text.teamLabel)}</span>
          <span><i class="fa-solid fa-tag" aria-hidden="true"></i>${escapeHtml(label("category", initiative.category))}</span>
        </div>
        <a class="btn primary" href="${escapeHtml(initiative.links.primary)}" target="_blank" rel="noopener">${escapeHtml(text.primaryCta)} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const directory = document.querySelector("[data-initiative-directory]");
    const detail = document.querySelector("[data-initiative-detail]");
    if (!directory && !detail) return;
    try {
      const initiatives = await loadInitiatives();
      mountDirectory(initiatives);
      mountDetail(initiatives);
    } catch (error) {
      console.error(error);
      const target = directory?.querySelector("[data-initiative-grid]") || detail;
      if (target) target.innerHTML = `<div class="initiative-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>${escapeHtml(getCopy().error)}</div>`;
    }
  });
})();
