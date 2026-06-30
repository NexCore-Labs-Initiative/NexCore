(function () {
  "use strict";

  const CONTRIBUTORS_API = "https://api.github.com/repos/NexCoreLabs/NexCore/contributors";
  const PER_PAGE = 100;

  function sumContributions(contributors) {
    return contributors.reduce((total, contributor) => {
      const contributions = Number(contributor?.contributions);
      return total + (Number.isFinite(contributions) && contributions > 0 ? contributions : 0);
    }, 0);
  }

  function formatCompactNumber(value, locale = "en") {
    const formatted = new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1
    }).format(value);

    // Preserve Arabic-Indic numerals even in browsers with limited locale data.
    return locale.toLowerCase().startsWith("ar")
      ? formatted.replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[digit])
      : formatted;
  }

  /**
   * Fetch every contributors page and sum GitHub's contribution counts.
   * Public repository data needs no token, so no credential is sent or stored.
   */
  async function fetchContributorTotal(fetchImpl = window.fetch.bind(window)) {
    let page = 1;
    let total = 0;

    while (true) {
      const response = await fetchImpl(`${CONTRIBUTORS_API}?per_page=${PER_PAGE}&page=${page}`, {
        headers: { Accept: "application/vnd.github+json" }
      });

      if (response.status === 204) return total;
      if (!response.ok) throw new Error(`GitHub contributors request failed (${response.status})`);

      const contributors = await response.json();
      if (!Array.isArray(contributors)) throw new TypeError("GitHub contributors response must be an array");

      total += sumContributions(contributors);
      if (contributors.length < PER_PAGE) return total;
      page += 1;
    }
  }

  function animateCompactCount(element, end, locale, duration = 1000) {
    const startTime = performance.now();

    function update(currentTime) {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = formatCompactNumber(Math.floor(end * eased), locale);

      if (progress < 1) requestAnimationFrame(update);
      else element.textContent = formatCompactNumber(end, locale);
    }

    requestAnimationFrame(update);
  }

  async function updateGitHubCommitCount() {
    const element = document.getElementById("githubCommitCount");
    if (!element) return;

    const locale = document.documentElement.lang?.toLowerCase().startsWith("ar") ? "ar" : "en";

    try {
      const total = await fetchContributorTotal();
      animateCompactCount(element, total, locale);
    } catch (error) {
      console.error("Unable to load GitHub contribution count", error);
      element.textContent = "--";
    }
  }

  window.HomepageGitHubContributions = Object.freeze({
    formatCompactNumber,
    sumContributions,
    fetchContributorTotal,
    updateGitHubCommitCount
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateGitHubCommitCount, { once: true });
  } else {
    updateGitHubCommitCount();
  }
})();
