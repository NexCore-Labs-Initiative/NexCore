(function () {
  "use strict";

  const STATUS = {
    launched: { en: "Launched", ar: "تم الإطلاق", summary: "launched" },
    active: { en: "Active", ar: "نشطة", summary: "building" },
    "in-development": { en: "In development", ar: "قيد التطوير", summary: "building" },
    incubation: { en: "Incubation", ar: "قيد الاحتضان", summary: "building" },
    concept: { en: "Concept", ar: "فكرة", summary: "exploring" }
  };

  const CATEGORY_LABELS = {
    "ai-dev-tools": { en: "AI & Dev Tools", ar: "الذكاء الاصطناعي وأدوات التطوير" },
    "community-events": { en: "Community Events", ar: "فعاليات المجتمع" },
    "hardware-exploration": { en: "Hardware & Exploration", ar: "الأجهزة والاستكشاف" }
  };

  const COPY = {
    en: {
      all: "All initiatives",
      resultOne: "1 initiative",
      resultMany: "{count} initiatives",
      loading: "Loading initiatives…",
      empty: "No initiatives are published in this category yet.",
      error: "We could not load initiatives right now. Please try again shortly.",
      view: "View initiative",
      close: "Close initiative details",
      highlights: "Highlights",
      external: "Open initiative",
      launched: "Launched",
      building: "Building",
      exploring: "Exploring"
    },
    ar: {
      all: "كل المبادرات",
      resultOne: "مبادرة واحدة",
      resultMany: "{count} مبادرات",
      loading: "جارٍ تحميل المبادرات…",
      empty: "لا توجد مبادرات منشورة في هذه الفئة بعد.",
      error: "تعذر تحميل المبادرات الآن. يُرجى المحاولة بعد قليل.",
      view: "عرض المبادرة",
      close: "إغلاق تفاصيل المبادرة",
      highlights: "أبرز الملامح",
      external: "فتح المبادرة",
      launched: "تم الإطلاق",
      building: "قيد البناء",
      exploring: "قيد الاستكشاف"
    }
  };

  const state = {
    initiatives: Object.freeze([]),
    activeCategory: "all",
    activeInitiativeSlug: null,
    lastFocusedElement: null
  };

  const isArabic = () => document.documentElement.lang.toLowerCase().startsWith("ar");
  const locale = () => (isArabic() ? "ar" : "en");
  const copy = () => COPY[locale()];
  const byId = (id) => document.getElementById(id);
  const asText = (value) => String(value || "").trim();

  function getLocalized(value, currentLocale = locale()) {
    if (typeof value === "string") return asText(value);
    if (!value || typeof value !== "object") return "";
    return asText(value[currentLocale] || value.en || value.ar);
  }

  function hasRequiredLocales(value) {
    return Boolean(value && typeof value === "object" && asText(value.en) && asText(value.ar));
  }

  function labelForCategory(category) {
    const known = CATEGORY_LABELS[category];
    if (known) return known[locale()];
    return category
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function normalizeInitiative(raw) {
    if (!raw || raw.visibility !== "public") return null;

    const slug = asText(raw.slug).toLowerCase();
    const status = asText(raw.status).toLowerCase();
    const categories = Array.isArray(raw.categories)
      ? [...new Set(raw.categories.map((category) => asText(category).toLowerCase()).filter(Boolean))]
      : [];

    if (!slug || !STATUS[status] || !categories.length) return null;
    if (![raw.title, raw.mission, raw.summary, raw.overview].every(hasRequiredLocales)) return null;

    const highlights = Array.isArray(raw.highlights)
      ? raw.highlights.filter(hasRequiredLocales).map((highlight) => Object.freeze({ en: asText(highlight.en), ar: asText(highlight.ar) }))
      : [];
    const image = raw.image && typeof raw.image === "object" && asText(raw.image.src) && hasRequiredLocales(raw.image.alt)
      ? Object.freeze({ src: asText(raw.image.src), alt: raw.image.alt || {} })
      : null;
    const primaryLink = raw.primary_link && typeof raw.primary_link === "object" && asText(raw.primary_link.url)
      ? Object.freeze({ url: asText(raw.primary_link.url), label: raw.primary_link.label || {} })
      : null;

    return Object.freeze({
      slug,
      status,
      categories: Object.freeze(categories),
      featured: raw.featured === true,
      sortOrder: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : 0,
      title: Object.freeze({ en: asText(raw.title.en), ar: asText(raw.title.ar) }),
      mission: Object.freeze({ en: asText(raw.mission.en), ar: asText(raw.mission.ar) }),
      summary: Object.freeze({ en: asText(raw.summary.en), ar: asText(raw.summary.ar) }),
      overview: Object.freeze({ en: asText(raw.overview.en), ar: asText(raw.overview.ar) }),
      highlights: Object.freeze(highlights),
      image,
      primaryLink
    });
  }

  function filterInitiatives(initiatives, category) {
    return initiatives.filter((initiative) => category === "all" || initiative.categories.includes(category));
  }

  function readRouteState() {
    const params = new URLSearchParams(window.location.search);
    return {
      category: asText(params.get("category")) || "all",
      initiative: asText(params.get("initiative")) || null
    };
  }

  function writeRouteState({ replace = false } = {}) {
    const url = new URL(window.location.href);
    if (state.activeCategory === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", state.activeCategory);

    if (state.activeInitiativeSlug) url.searchParams.set("initiative", state.activeInitiativeSlug);
    else url.searchParams.delete("initiative");

    const method = replace ? "replaceState" : "pushState";
    window.history[method]({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function setStateFromRoute() {
    const routeState = readRouteState();
    const categoryExists = routeState.category === "all" || state.initiatives.some((initiative) => initiative.categories.includes(routeState.category));
    state.activeCategory = categoryExists ? routeState.category : "all";
    state.activeInitiativeSlug = state.initiatives.some((initiative) => initiative.slug === routeState.initiative)
      ? routeState.initiative
      : null;
  }

  function setGridState(iconClass, message) {
    const grid = byId("initiativesGrid");
    if (!grid) return;
    grid.replaceChildren();
    const stateMessage = document.createElement("p");
    stateMessage.className = "initiatives-state";
    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");
    stateMessage.append(icon, document.createTextNode(message));
    grid.append(stateMessage);
  }

  function renderSummary() {
    const source = state.initiatives;
    const counts = { launched: 0, building: 0, exploring: 0 };
    source.forEach((initiative) => { counts[STATUS[initiative.status].summary] += 1; });

    ["launched", "building", "exploring"].forEach((key) => {
      const count = byId(`initiativeCount${key.charAt(0).toUpperCase()}${key.slice(1)}`);
      if (count) count.textContent = String(counts[key]);
    });
  }

  function renderFilters() {
    const filterList = byId("initiativeFilters");
    if (!filterList) return;

    const categories = new Map();
    state.initiatives.forEach((initiative) => {
      initiative.categories.forEach((category) => categories.set(category, (categories.get(category) || 0) + 1));
    });

    const fragment = document.createDocumentFragment();
    const addFilter = (category, label, count) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "initiative-filter";
      button.dataset.category = category;
      button.setAttribute("aria-pressed", String(state.activeCategory === category));
      button.append(document.createTextNode(label));
      const countEl = document.createElement("span");
      countEl.className = "initiative-filter-count";
      countEl.textContent = String(count);
      countEl.setAttribute("aria-hidden", "true");
      button.append(countEl);
      fragment.append(button);
    };

    addFilter("all", copy().all, state.initiatives.length);
    [...categories.keys()].sort((first, second) => labelForCategory(first).localeCompare(labelForCategory(second), locale())).forEach((category) => {
      addFilter(category, labelForCategory(category), categories.get(category));
    });
    filterList.replaceChildren(fragment);
  }

  function createCard(initiative, isFeatured) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `initiative-card${isFeatured ? " initiative-card--featured" : ""}`;
    card.dataset.initiativeSlug = initiative.slug;
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-label", `${copy().view}: ${getLocalized(initiative.title)}`);

    const visual = document.createElement("div");
    visual.className = "initiative-card-visual";
    if (initiative.image) {
      const image = document.createElement("img");
      image.loading = "lazy";
      image.src = initiative.image.src;
      image.alt = getLocalized(initiative.image.alt);
      visual.append(image);
    }
    const badge = document.createElement("span");
    badge.className = `initiative-status initiative-status--${initiative.status}`;
    badge.textContent = STATUS[initiative.status][locale()];
    visual.append(badge);

    const content = document.createElement("span");
    content.className = "initiative-card-content";
    const categories = document.createElement("span");
    categories.className = "initiative-categories";
    initiative.categories.forEach((category) => {
      const categoryEl = document.createElement("span");
      categoryEl.className = "initiative-category";
      categoryEl.textContent = labelForCategory(category);
      categories.append(categoryEl);
    });
    const title = document.createElement("strong");
    title.className = "initiative-card-title";
    title.textContent = getLocalized(initiative.title);
    const mission = document.createElement("span");
    mission.className = "initiative-card-mission";
    mission.textContent = getLocalized(initiative.mission);
    const cta = document.createElement("span");
    cta.className = "initiative-card-cta";
    cta.append(document.createTextNode(copy().view));
    const arrow = document.createElement("i");
    arrow.className = isArabic() ? "fa-solid fa-arrow-left" : "fa-solid fa-arrow-right";
    arrow.setAttribute("aria-hidden", "true");
    cta.append(arrow);
    content.append(categories, title, mission, cta);
    card.append(visual, content);
    return card;
  }

  function renderGrid() {
    const grid = byId("initiativesGrid");
    const resultCount = byId("initiativesResultCount");
    if (!grid) return;

    const initiatives = filterInitiatives(state.initiatives, state.activeCategory);
    if (resultCount) {
      resultCount.textContent = initiatives.length === 1
        ? copy().resultOne
        : copy().resultMany.replace("{count}", String(initiatives.length));
    }

    if (!initiatives.length) {
      setGridState("fa-solid fa-compass", copy().empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    initiatives.forEach((initiative) => fragment.append(createCard(initiative, initiative.featured && initiatives.length >= 3)));
    grid.replaceChildren(fragment);
  }

  function renderCatalogue() {
    renderSummary();
    renderFilters();
    renderGrid();
    byId("initiativesGrid")?.setAttribute("aria-busy", "false");
  }

  function renderModal(initiative) {
    const visual = byId("initiativeModalVisual");
    const status = byId("initiativeModalStatus");
    const categories = byId("initiativeModalCategories");
    const title = byId("initiativeModalTitle");
    const overview = byId("initiativeModalOverview");
    const highlights = byId("initiativeModalHighlights");
    const link = byId("initiativeModalLink");
    if (!visual || !status || !categories || !title || !overview || !highlights || !link) return;

    visual.replaceChildren();
    if (initiative.image) {
      const image = document.createElement("img");
      image.src = initiative.image.src;
      image.alt = getLocalized(initiative.image.alt);
      visual.append(image);
    }
    status.className = `initiative-status initiative-status--${initiative.status}`;
    status.textContent = STATUS[initiative.status][locale()];
    categories.replaceChildren();
    initiative.categories.forEach((category) => {
      const categoryEl = document.createElement("span");
      categoryEl.className = "initiative-category";
      categoryEl.textContent = labelForCategory(category);
      categories.append(categoryEl);
    });
    title.textContent = getLocalized(initiative.title);
    overview.textContent = getLocalized(initiative.overview);
    highlights.replaceChildren();
    initiative.highlights.forEach((highlight) => {
      const item = document.createElement("li");
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-check";
      icon.setAttribute("aria-hidden", "true");
      item.append(icon, document.createTextNode(getLocalized(highlight)));
      highlights.append(item);
    });
    link.hidden = !initiative.primaryLink;
    if (initiative.primaryLink) {
      link.href = initiative.primaryLink.url;
      link.textContent = getLocalized(initiative.primaryLink.label) || copy().external;
      const external = /^https?:\/\//i.test(initiative.primaryLink.url) && !initiative.primaryLink.url.includes(window.location.hostname);
      link.target = external ? "_blank" : "_self";
      link.rel = external ? "noopener noreferrer" : "";
    }
  }

  function getFocusableElements() {
    const modal = byId("initiativeModal");
    if (!modal) return [];
    return [...modal.querySelectorAll('a[href]:not([hidden]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null);
  }

  function trapModalFocus(event) {
    if (event.key !== "Tab" || !state.activeInitiativeSlug) return;
    const focusable = getFocusableElements();
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
  }

  function openInitiative(slug, { updateUrl = true, focus = true } = {}) {
    const initiative = state.initiatives.find((item) => item.slug === slug);
    if (!initiative) return;
    if (!state.activeInitiativeSlug) state.lastFocusedElement = document.activeElement;
    state.activeInitiativeSlug = slug;
    renderModal(initiative);
    const modal = byId("initiativeModal");
    if (modal) {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => modal.classList.add("is-open"));
    }
    document.body.classList.add("initiative-modal-open");
    if (updateUrl) writeRouteState();
    if (focus) byId("initiativeModalClose")?.focus();
  }

  function closeInitiative({ updateUrl = true, restoreFocus = true } = {}) {
    const modal = byId("initiativeModal");
    if (!state.activeInitiativeSlug && (!modal || modal.hidden)) return;
    state.activeInitiativeSlug = null;
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (!state.activeInitiativeSlug) modal.hidden = true;
      }, 220);
    }
    document.body.classList.remove("initiative-modal-open");
    if (updateUrl) writeRouteState();
    if (restoreFocus && state.lastFocusedElement instanceof HTMLElement) state.lastFocusedElement.focus();
    state.lastFocusedElement = null;
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && state.activeInitiativeSlug) {
      event.preventDefault();
      closeInitiative();
      return;
    }
    trapModalFocus(event);
  }

  function bindEvents() {
    byId("initiativeFilters")?.addEventListener("click", (event) => {
      const filter = event.target.closest("button[data-category]");
      if (!filter) return;
      const nextCategory = filter.dataset.category;
      if (nextCategory === state.activeCategory) return;
      closeInitiative({ updateUrl: false, restoreFocus: false });
      state.activeCategory = nextCategory;
      renderCatalogue();
      writeRouteState();
    });

    byId("initiativesGrid")?.addEventListener("click", (event) => {
      const card = event.target.closest("button[data-initiative-slug]");
      if (card) openInitiative(card.dataset.initiativeSlug);
    });

    byId("initiativeModal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget || event.target.closest("[data-modal-close]")) closeInitiative();
    });
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("popstate", () => {
      setStateFromRoute();
      renderCatalogue();
      if (state.activeInitiativeSlug) openInitiative(state.activeInitiativeSlug, { updateUrl: false, focus: false });
      else closeInitiative({ updateUrl: false, restoreFocus: false });
    });
  }

  async function loadInitiatives() {
    setGridState("fa-solid fa-spinner fa-spin", copy().loading);
    const client = window.supabaseClient;
    if (!client) {
      setGridState("fa-solid fa-triangle-exclamation", copy().error);
      byId("initiativesGrid")?.setAttribute("aria-busy", "false");
      return;
    }

    try {
      const { data, error } = await client
        .from("initiatives")
        .select("slug, status, categories, featured, sort_order, visibility, title, mission, summary, overview, highlights, image, primary_link")
        .eq("visibility", "public")
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;

      state.initiatives = Object.freeze((data || []).map(normalizeInitiative).filter(Boolean));
      setStateFromRoute();
      renderCatalogue();
      if (state.activeInitiativeSlug) openInitiative(state.activeInitiativeSlug, { updateUrl: false, focus: false });
    } catch (error) {
      console.error("Unable to load initiatives", error);
      setGridState("fa-solid fa-triangle-exclamation", copy().error);
      byId("initiativesGrid")?.setAttribute("aria-busy", "false");
    }
  }

  function init() {
    bindEvents();
    loadInitiatives();
  }

  window.InitiativesPage = Object.freeze({ normalizeInitiative, filterInitiatives, STATUS });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
