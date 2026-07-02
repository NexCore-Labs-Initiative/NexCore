"use strict";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGeminiErrorMessage(error) {
  return String(error?.message || error || "");
}

function isGeminiQuotaError(error) {
  const message = getGeminiErrorMessage(error).toLowerCase();
  return message.includes("429") || message.includes("resource_exhausted") || message.includes("quota");
}

function isGeminiUnavailableError(error) {
  const message = getGeminiErrorMessage(error).toLowerCase();
  return message.includes("503") || message.includes("unavailable") || message.includes("high demand");
}

function buildAssistRequest(request, model) {
  const config = { ...request.config };
  if (!model.includes("gemini-2.0")) config.thinkingConfig = { thinkingBudget: 0 };
  return { ...request, model, config };
}

async function generateAssistContent(ai, request, options) {
  const {
    model,
    fallbackModel,
    retryDelayMs = 1200,
    wait = sleep,
    logger = console,
  } = options;
  const models = [...new Set([model, fallbackModel].filter(Boolean))];
  let lastError;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const currentModel = models[modelIndex];
    const attempts = modelIndex === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return {
          result: await ai.models.generateContent(buildAssistRequest(request, currentModel)),
          model: currentModel,
        };
      } catch (error) {
        lastError = error;
        const unavailable = isGeminiUnavailableError(error);
        const quotaExceeded = isGeminiQuotaError(error);
        if (!unavailable && !quotaExceeded) throw error;

        if (unavailable && attempt < attempts) {
          logger.warn(`[ai-assist] ${currentModel} unavailable, retrying once...`);
          await wait(retryDelayMs);
          continue;
        }

        if (modelIndex < models.length - 1) {
          logger.warn(`[ai-assist] ${currentModel} failed, trying fallback model ${models[modelIndex + 1]}...`);
        }
        break;
      }
    }
  }

  throw lastError || new Error("No Gemini model is available");
}

module.exports = {
  buildAssistRequest,
  generateAssistContent,
  getGeminiErrorMessage,
  isGeminiQuotaError,
  isGeminiUnavailableError,
  sleep,
};
