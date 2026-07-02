"use strict";

const assert = require("assert");
const { createAiHandler } = require("../api/ai");
const { authenticateUser, getBearerToken } = require("../lib/ai/auth");
const { inferScope, pickLexicalChunks, trimReplyWords } = require("../lib/ai/chat-utils");
const { getAiConfig, missingRequiredConfig } = require("../lib/ai/config");
const { buildAssistRequest, generateAssistContent } = require("../lib/ai/gemini");

const validEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  GEMINI_API_KEY: "gemini-key",
};

function responseMock() {
  return {
    body: undefined,
    ended: false,
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
  };
}

function request(overrides = {}) {
  return {
    method: "GET",
    headers: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function createSupabase({ user = { id: "user-1" }, authError = null, rpc } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    rpc: rpc || (async (name) => {
      if (name === "get_ai_usage") return { data: { used: 1, remaining: 2, max: 3 }, error: null };
      if (name === "consume_ai_use") return { data: 1, error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    }),
  };
}

class SuccessfulGoogleGenAI {
  constructor() {
    this.models = {
      generateContent: async (options) => ({ text: "Generated summary", options }),
    };
  }
}

class QuotaGoogleGenAI {
  constructor() {
    this.models = {
      generateContent: async () => { throw new Error("429 RESOURCE_EXHAUSTED quota"); },
    };
  }
}

async function run() {
  const config = getAiConfig(validEnv);
  assert.deepStrictEqual(missingRequiredConfig(config), []);
  assert.deepStrictEqual(missingRequiredConfig(getAiConfig({})), ["SUPABASE_URL", "SUPABASE_ANON_KEY", "GEMINI_API_KEY"]);
  assert.strictEqual(config.chat.disabled, true, "Chat must remain disabled during modularization");
  assert.strictEqual(config.assist.model, "models/gemini-flash-latest");

  assert.strictEqual(getBearerToken({ authorization: "Bearer token-1" }), "token-1");
  assert.strictEqual(getBearerToken({ Authorization: "Bearer token-2" }), "token-2");
  assert.strictEqual(getBearerToken({ authorization: "Basic nope" }), "");

  let receivedClientOptions;
  const authSuccess = await authenticateUser({
    headers: { authorization: "Bearer good-token" },
    supabaseUrl: validEnv.SUPABASE_URL,
    supabaseAnonKey: validEnv.SUPABASE_ANON_KEY,
    createClient: (url, key, options) => {
      receivedClientOptions = { url, key, options };
      return createSupabase();
    },
  });
  assert.strictEqual(authSuccess.ok, true);
  assert.strictEqual(receivedClientOptions.options.global.headers.Authorization, "Bearer good-token");

  assert.strictEqual(inferScope("Tell me about NexCore projects", [], false), "nexcore_scope");
  assert.strictEqual(inferScope("What about that?", [{ role: "user", text: "NexCore roadmap" }], false), "nexcore_scope");
  assert.strictEqual(inferScope("What is the weather?", [], false), "out_of_scope");
  assert.strictEqual(trimReplyWords("one two three four", 3), "one two three...");
  assert.deepStrictEqual(
    pickLexicalChunks("roadmap", [
      { title: "Other", content: "Nothing relevant", source: "misc" },
      { title: "Roadmap", content: "Feature voting", source: "nexcore" },
    ], 1),
    [{ title: "Roadmap", content: "Feature voting", source: "nexcore" }]
  );

  const requestShape = buildAssistRequest({ config: { temperature: 0.7 }, contents: [] }, "models/gemini-flash-latest");
  assert.deepStrictEqual(requestShape.config.thinkingConfig, { thinkingBudget: 0 });

  const calls = [];
  const waits = [];
  const retryingAi = {
    models: {
      generateContent: async ({ model }) => {
        calls.push(model);
        if (calls.length <= 2) throw new Error("503 UNAVAILABLE");
        return { text: "fallback success" };
      },
    },
  };
  const generated = await generateAssistContent(retryingAi, { config: {}, contents: [] }, {
    model: "primary",
    fallbackModel: "fallback",
    retryDelayMs: 25,
    wait: async (ms) => waits.push(ms),
    logger: { warn() {} },
  });
  assert.deepStrictEqual(calls, ["primary", "primary", "fallback"]);
  assert.deepStrictEqual(waits, [25]);
  assert.strictEqual(generated.model, "fallback");

  const createClientMock = () => createSupabase();
  const handler = createAiHandler({
    createClientImpl: createClientMock,
    GoogleGenAIImpl: SuccessfulGoogleGenAI,
    env: validEnv,
    logger: { error() {} },
  });

  const optionsResponse = responseMock();
  await createAiHandler({ env: {}, logger: { error() {} } })(request({ method: "OPTIONS" }), optionsResponse);
  assert.strictEqual(optionsResponse.statusCode, 200);
  assert.strictEqual(optionsResponse.ended, true);

  const missingConfigResponse = responseMock();
  await createAiHandler({ env: {}, logger: { error() {} } })(request(), missingConfigResponse);
  assert.strictEqual(missingConfigResponse.statusCode, 500);
  assert.strictEqual(missingConfigResponse.body.error, "Server misconfigured");

  const missingAuthResponse = responseMock();
  await handler(request(), missingAuthResponse);
  assert.strictEqual(missingAuthResponse.statusCode, 401);
  assert.strictEqual(missingAuthResponse.body.error, "Missing or invalid authorization token");

  const invalidAuthHandler = createAiHandler({
    createClientImpl: () => createSupabase({ user: null, authError: new Error("expired") }),
    GoogleGenAIImpl: SuccessfulGoogleGenAI,
    env: validEnv,
    logger: { error() {} },
  });
  const invalidAuthResponse = responseMock();
  await invalidAuthHandler(request({ headers: { authorization: "Bearer expired-token" } }), invalidAuthResponse);
  assert.strictEqual(invalidAuthResponse.statusCode, 401);
  assert.strictEqual(invalidAuthResponse.body.error, "Invalid or expired token");

  const usageResponse = responseMock();
  await handler(request({
    headers: { authorization: "Bearer good-token" },
    query: { usage: "1" },
  }), usageResponse);
  assert.deepStrictEqual(usageResponse.body, { used: 1, remaining: 2, max: 3 });

  const disabledChatResponse = responseMock();
  await handler(request({
    method: "POST",
    headers: { authorization: "Bearer good-token" },
    query: { chat: "1" },
  }), disabledChatResponse);
  assert.strictEqual(disabledChatResponse.statusCode, 503);
  assert.strictEqual(disabledChatResponse.body.error, "NexCore Intelligence is under development");

  const assistResponse = responseMock();
  await handler(request({
    method: "POST",
    headers: { authorization: "Bearer good-token" },
    body: { action: "card_summary", text: "A grounded source description." },
  }), assistResponse);
  assert.strictEqual(assistResponse.statusCode, 200);
  assert.strictEqual(assistResponse.body.text, "Generated summary");
  assert.strictEqual(assistResponse.body.model, "models/gemini-flash-latest");
  assert.strictEqual(assistResponse.body.remaining, 2);

  const dailyLimitHandler = createAiHandler({
    createClientImpl: () => createSupabase({
      rpc: async (name) => name === "consume_ai_use"
        ? { data: null, error: new Error("AI daily limit reached") }
        : { data: null, error: null },
    }),
    GoogleGenAIImpl: SuccessfulGoogleGenAI,
    env: validEnv,
    logger: { error() {} },
  });
  const dailyLimitResponse = responseMock();
  await dailyLimitHandler(request({
    method: "POST",
    headers: { authorization: "Bearer good-token" },
    body: { action: "card_summary", text: "Source" },
  }), dailyLimitResponse);
  assert.strictEqual(dailyLimitResponse.statusCode, 429);
  assert.strictEqual(dailyLimitResponse.body.remaining, 0);

  const quotaHandler = createAiHandler({
    createClientImpl: createClientMock,
    GoogleGenAIImpl: QuotaGoogleGenAI,
    env: validEnv,
    logger: { error() {} },
  });
  const quotaResponse = responseMock();
  await quotaHandler(request({
    method: "POST",
    headers: { authorization: "Bearer good-token" },
    body: { action: "card_summary", text: "Source" },
  }), quotaResponse);
  assert.strictEqual(quotaResponse.statusCode, 503);
  assert.strictEqual(quotaResponse.body.error, "AI temporarily unavailable");

  console.log("AI API modularization tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
