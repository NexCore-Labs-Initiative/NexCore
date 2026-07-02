/**
 * NexCore AI — combined serverless endpoint.
 * Public routing and response contracts remain centralized here; chat and
 * dashboard-assist behavior live in independently testable modules.
 */

const { createClient } = require("@supabase/supabase-js");
const { GoogleGenAI } = require("@google/genai");
const { createAssistHandler } = require("../lib/ai/assist");
const { authenticateUser } = require("../lib/ai/auth");
const { createChatHandler } = require("../lib/ai/chat");
const { getAiConfig, missingRequiredConfig } = require("../lib/ai/config");
const { isGeminiQuotaError } = require("../lib/ai/gemini");
const { applyCors } = require("../lib/ai/http");

function createAiHandler({
  createClientImpl = createClient,
  GoogleGenAIImpl = GoogleGenAI,
  env = process.env,
  logger = console,
} = {}) {
  const config = getAiConfig(env);
  const handleChat = createChatHandler({ GoogleGenAI: GoogleGenAIImpl, config: config.chat, logger });
  const handleAssist = createAssistHandler({
    GoogleGenAI: GoogleGenAIImpl,
    config: { ...config.assist, geminiApiKey: config.shared.geminiApiKey },
    logger,
  });

  return async function aiHandler(req, res) {
    try {
      applyCors(res, config.shared.allowedOrigin);
      if (req.method === "OPTIONS") return res.status(200).end();

      const missing = missingRequiredConfig(config);
      if (missing.length > 0) {
        logger.error("Missing AI environment variables:", missing);
        return res.status(500).json({
          error: "Server misconfigured",
          details: "Missing SUPABASE_URL, SUPABASE_ANON_KEY, or GEMINI_API_KEY",
        });
      }

      const auth = await authenticateUser({
        headers: req.headers,
        createClient: createClientImpl,
        supabaseUrl: config.shared.supabaseUrl,
        supabaseAnonKey: config.shared.supabaseAnonKey,
      });
      if (!auth.ok) {
        if (auth.authError) logger.error("Auth error:", auth.authError.message);
        return res.status(auth.status).json({ error: auth.error });
      }

      if (String(req.query?.chat || "") === "1") {
        return await handleChat(req, res, auth.supabase, auth.user);
      }
      return await handleAssist(req, res, auth.supabase, auth.user);
    } catch (error) {
      logger.error("AI endpoint crash:", error);
      if (isGeminiQuotaError(error)) {
        return res.status(503).json({ error: "AI temporarily unavailable", details: "Quota exceeded. Try later." });
      }
      return res.status(500).json({ error: "Gemini API failed", details: error?.message || String(error) });
    }
  };
}

const handler = createAiHandler();
module.exports = handler;
module.exports.createAiHandler = createAiHandler;
