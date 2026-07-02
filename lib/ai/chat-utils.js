"use strict";

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

function isFollowUpLike(text) {
  const followUpTokens = [
    "this", "that", "it", "they", "them", "those", "these",
    "more", "details", "explain", "how about", "and what about", "why",
  ];
  return text.length <= 60 && containsAny(text, followUpTokens);
}

function inferScope(userMessage, rawHistory, hasProjectContext) {
  const text = normalizeText(userMessage);
  const nexcoreKeywords = [
    "nexcore", "platform", "project", "publish", "submission", "student project",
    "feature", "roadmap", "hub", "account", "faq", "release", "labs",
  ];
  if (containsAny(text, nexcoreKeywords) || hasProjectContext) return "nexcore_scope";
  if (isFollowUpLike(text) && Array.isArray(rawHistory)) {
    const recentUserTexts = rawHistory
      .slice(-6)
      .filter((item) => item && item.role === "user" && typeof item.text === "string")
      .map((item) => normalizeText(item.text));
    if (recentUserTexts.some((item) => containsAny(item, nexcoreKeywords))) return "nexcore_scope";
  }
  return "out_of_scope";
}

function isTrustedKnowledgeSource(source) {
  const normalized = normalizeText(source);
  if (!normalized) return false;
  return ["nexcore", "project", "faq", "roadmap", "release", "hub", "policy", "privacy", "terms", "student"]
    .some((keyword) => normalized.includes(keyword));
}

function relevanceScore(query, chunk) {
  const queryTokens = normalizeText(query).split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
  if (queryTokens.length === 0) return isTrustedKnowledgeSource(chunk?.source) ? 1 : 0;
  const haystack = normalizeText(`${chunk?.title || ""} ${chunk?.content || ""} ${chunk?.source || ""}`);
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function trimReplyWords(text, maxWords) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return String(text || "").trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function pickLexicalChunks(query, rows, max = 5) {
  return (rows || [])
    .map((row) => ({ ...row, _score: relevanceScore(query, row) }))
    .filter((row) => row._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, max)
    .map(({ _score, ...rest }) => rest);
}

module.exports = {
  inferScope,
  isTrustedKnowledgeSource,
  normalizeText,
  pickLexicalChunks,
  relevanceScore,
  trimReplyWords,
};
