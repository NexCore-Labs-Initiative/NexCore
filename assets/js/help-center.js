(function () {
  const root = document.querySelector(".support-shell");
  if (!root) return;

  const searchInput = root.querySelector("#helpSearch");
  const topSearch = root.querySelector("[data-support-search-trigger]");
  const sidebarLinks = Array.from(root.querySelectorAll("[data-support-filter]"));
  const articles = Array.from(root.querySelectorAll("[data-support-article]"));
  const collections = Array.from(root.querySelectorAll("[data-support-collection]"));
  const noResults = root.querySelector("[data-support-no-results]");
  let activeFilter = "all";

  const normalize = (value) => String(value || "").toLowerCase().trim();
  const searchableText = (element) => normalize([
    element.dataset.title,
    element.dataset.category,
    element.dataset.keywords,
    element.textContent,
  ].join(" "));

  function itemMatches(element, query) {
    const category = element.dataset.category || "";
    const categoryMatches = activeFilter === "all" || category === activeFilter;
    const queryMatches = !query || searchableText(element).includes(query);
    return categoryMatches && queryMatches;
  }

  function applyFilters() {
    const query = normalize(searchInput?.value);
    let visibleTotal = 0;

    articles.forEach((article) => {
      const visible = itemMatches(article, query);
      article.hidden = !visible;
      if (visible) visibleTotal += 1;
    });

    collections.forEach((collection) => {
      const visible = itemMatches(collection, query);
      collection.hidden = !visible;
      if (visible) visibleTotal += 1;
    });

    noResults?.classList.toggle("is-visible", visibleTotal === 0);
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href") || "";
      const target = href.startsWith("#") ? document.querySelector(href) : null;
      activeFilter = link.dataset.supportFilter || "all";
      sidebarLinks.forEach((item) => item.classList.toggle("is-active", item === link));
      applyFilters();
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  topSearch?.addEventListener("click", () => searchInput?.focus());
  searchInput?.addEventListener("input", applyFilters);

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      searchInput?.focus();
    }
  });

  applyFilters();
})();
