"use strict";

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAiConfig(env = process.env) {
  const geminiApiKey = env.GEMINI_API_KEY;
  const assistModel = env.GEMINI_MODEL || "models/gemini-flash-latest";

  return {
    shared: {
      supabaseUrl: env.SUPABASE_URL,
      supabaseAnonKey: env.SUPABASE_ANON_KEY,
      geminiApiKey,
      allowedOrigin: env.ALLOWED_ORIGIN || "*",
    },
    assist: {
      model: assistModel,
      fallbackModel: env.GEMINI_FALLBACK_MODEL || (
        assistModel === "models/gemini-flash-latest"
          ? "models/gemini-3.1-flash-lite"
          : "models/gemini-flash-latest"
      ),
      retryDelayMs: integer(env.GEMINI_ASSIST_RETRY_DELAY_MS, 1200),
      dailyLimit: 3,
    },
    chat: {
      disabled: true,
      apiKey: env.GEMINI_CHAT_API_KEY || geminiApiKey,
      model: env.GEMINI_CHAT_MODEL || "models/gemini-2.5-flash",
      embedModel: env.GEMINI_EMBED_MODEL || "gemini-embedding-001",
      embedDimensions: integer(env.GEMINI_EMBED_DIMENSIONS, 768),
      dailyLimit: integer(env.AI_CHAT_DAILY_LIMIT, 10),
      retryDelayMs: integer(env.GEMINI_CHAT_RETRY_DELAY_MS, 1200),
      minuteLimit: integer(env.AI_CHAT_MINUTE_LIMIT, 5),
      maxContextChars: 4000,
      maxMessageChars: 500,
      maxReplyWords: integer(env.AI_CHAT_MAX_REPLY_WORDS, 75),
      outOfScopeReply: "I can only help with NexCore Labs topics. Ask me about the platform, features, or student projects.",
      noEvidenceReply: "I do not have verified NexCore data for that yet. Please ask about a specific feature or project, and I will use available records.",
    },
  };
}

function missingRequiredConfig(config) {
  const shared = config?.shared || {};
  return [
    ["SUPABASE_URL", shared.supabaseUrl],
    ["SUPABASE_ANON_KEY", shared.supabaseAnonKey],
    ["GEMINI_API_KEY", shared.geminiApiKey],
  ].filter(([, value]) => !value).map(([name]) => name);
}

module.exports = { getAiConfig, missingRequiredConfig };
