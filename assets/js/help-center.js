(function () {
  const root = document.querySelector(".help-center-page");
  if (!root) return;

  const searchInput = root.querySelector("#helpSearch");
  const chips = Array.from(root.querySelectorAll("[data-help-filter]"));
  const topics = Array.from(root.querySelectorAll(".help-topic-card"));
  const articleCards = Array.from(root.querySelectorAll(".help-article-card"));
  const articles = Array.from(root.querySelectorAll(".help-article"));
  const resultCount = root.querySelector("[data-help-result-count]");
  const noResults = root.querySelector("[data-help-no-results]");
  let activeFilter = "all";

  const normalize = (value) => String(value || "").toLowerCase().trim();
  const searchable = (element) => normalize([
    element.dataset.title,
    element.dataset.category,
    element.dataset.keywords,
    element.textContent,
  ].join(" "));

  function matches(element, query) {
    const categoryMatches = activeFilter === "all" || element.dataset.category === activeFilter;
    const queryMatches = !query || searchable(element).includes(query);
    return categoryMatches && queryMatches;
  }

  function applyFilters() {
    const query = normalize(searchInput?.value);
    let visibleArticles = 0;

    topics.forEach((topic) => {
      const topicVisible = activeFilter === "all" || topic.dataset.category === activeFilter || !query;
      const queryVisible = !query || searchable(topic).includes(query);
      topic.hidden = !(topicVisible && queryVisible);
    });

    articleCards.forEach((card) => {
      const visible = matches(card, query);
      card.hidden = !visible;
      if (visible) visibleArticles += 1;
    });

    articles.forEach((article) => {
      article.hidden = !matches(article, query);
    });

    if (resultCount) {
      const label = resultCount.dataset.label || "articles";
      resultCount.textContent = `${visibleArticles} ${label}`;
    }

    if (noResults) {
      noResults.classList.toggle("is-visible", visibleArticles === 0);
    }
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.helpFilter || "all";
      chips.forEach((item) => item.classList.toggle("is-active", item === chip));
      applyFilters();
    });
  });

  searchInput?.addEventListener("input", applyFilters);

  document.addEventListener("keydown", (event) => {
    const isMacShortcut = event.metaKey && event.key.toLowerCase() === "k";
    const isWinShortcut = event.ctrlKey && event.key.toLowerCase() === "k";
    if (!isMacShortcut && !isWinShortcut) return;
    event.preventDefault();
    searchInput?.focus();
  });

  applyFilters();
})();
