"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

for (const [file, scriptPath, label] of [
  ["index.html", "assets/js/github-contributions.js", "commits"],
  ["ar/index.html", "../assets/js/github-contributions.js", "التزامات"]
]) {
  const html = read(file);
  assert(html.includes(`src="${scriptPath}"`), `${file} must load the GitHub contributions counter`);
  assert(html.includes('id="githubCommitCount"'), `${file} must include the GitHub commits KPI`);
  assert(html.includes(`fa-github"></i>\n                    ${label}`), `${file} must label the GitHub commits KPI`);
  assert(!html.includes('id="tasks"'), `${file} must remove the static tasks KPI`);
}

const windowStub = { addEventListener() {}, HomepageGitHubContributions: null };
const documentStub = {
  readyState: "loading",
  documentElement: { lang: "en" },
  addEventListener() {}
};
vm.runInNewContext(read("assets/js/github-contributions.js"), {
  window: windowStub,
  document: documentStub,
  Intl,
  console,
  performance,
  requestAnimationFrame() {}
});

const { formatCompactNumber, sumContributions, fetchContributorTotal } = windowStub.HomepageGitHubContributions;
assert.strictEqual(formatCompactNumber(1200, "en"), "1.2K", "Commit totals must use compact notation");
assert(!/[0-9]/.test(formatCompactNumber(540, "ar")), "Arabic counters must use Arabic-Indic numerals");
assert.strictEqual(sumContributions([{ contributions: 7 }, { contributions: 5 }, { contributions: "bad" }]), 12);

(async () => {
  const requests = [];
  const firstPage = Array.from({ length: 100 }, () => ({ contributions: 1 }));
  const pages = [firstPage, [{ contributions: 8 }, { contributions: 12 }]];
  const total = await fetchContributorTotal(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 200, json: async () => pages.shift() };
  });

  assert.strictEqual(total, 120, "Every contributors page must be included in the total");
  assert.strictEqual(requests.length, 2, "A full page must trigger the next contributors page");
  assert(requests[0].url.endsWith("?per_page=100&page=1"));
  assert(requests[1].url.endsWith("?per_page=100&page=2"));
  assert(!("Authorization" in requests[0].options.headers), "Frontend requests must not expose a GitHub token");
  assert(read("service-worker.js").includes("'/assets/js/github-contributions.js'"), "The counter script must be available offline after precaching");
  console.log("Homepage metrics tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
