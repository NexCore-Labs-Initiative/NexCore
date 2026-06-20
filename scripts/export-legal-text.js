"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "legal-review");

const EXPORTS = [
  {
    source: "terms.html",
    output: "NexCore-Terms-EN.txt",
    title: "NexCore Labs - Terms of Service (English)",
  },
  {
    source: "ar/terms.html",
    output: "NexCore-Terms-AR.txt",
    title: "NexCore Labs - شروط الخدمة (العربية)",
  },
  {
    source: "pricing-policy.html",
    output: "NexCore-Pricing-Policy-EN.txt",
    title: "NexCore Labs - Pricing & Billing Policy (English)",
  },
  {
    source: "ar/pricing-policy.html",
    output: "NexCore-Pricing-Policy-AR.txt",
    title: "NexCore Labs - سياسة التسعير والفوترة (العربية)",
  },
];

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "...",
    laquo: "<<",
    ldquo: "\"",
    lsquo: "'",
    lt: "<",
    mdash: "-",
    middot: "·",
    nbsp: " ",
    ndash: "-",
    quot: "\"",
    raquo: ">>",
    rdquo: "\"",
    rsquo: "'",
    times: "x",
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function htmlToText(html) {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  let content = mainMatch ? mainMatch[1] : html;

  content = content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<div\b[^>]*class=["'][^"']*\bpolicy-actions\b[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<i\b[^>]*>[\s\S]*?<\/i>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n----------------------------------------\n")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
      if (!cleanLabel || href.startsWith("#")) return cleanLabel;
      return `${cleanLabel} (${href})`;
    })
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n$1\n")
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n$1\n")
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n$1\n")
    .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n$1\n")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<th\b[^>]*>([\s\S]*?)<\/th>/gi, "$1 | ")
    .replace(/<td\b[^>]*>([\s\S]*?)<\/td>/gi, "$1 | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<(p|div|section|article|header|footer|table|thead|tbody|tfoot|ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|table|thead|tbody|tfoot|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(content)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\|\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const item of EXPORTS) {
  const sourcePath = path.join(ROOT, item.source);
  const outputPath = path.join(OUTPUT_DIR, item.output);
  const html = fs.readFileSync(sourcePath, "utf8");
  const text = [
    item.title,
    "=".repeat(item.title.length),
    "",
    htmlToText(html),
    "",
  ].join("\n");

  fs.writeFileSync(outputPath, text, "utf8");
  console.log(`Created ${path.relative(ROOT, outputPath)}`);
}
