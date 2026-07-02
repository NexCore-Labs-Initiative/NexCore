"use strict";

const { sleep } = require("./gemini");
const {
  inferScope,
  isTrustedKnowledgeSource,
  pickLexicalChunks,
  relevanceScore,
  trimReplyWords,
} = require("./chat-utils");

function createChatHandler({ GoogleGenAI, config, logger = globalThis.console }) {
  const console = {
    error: logger.error?.bind(logger) || (() => {}),
    log: logger.log?.bind(logger) || (() => {}),
    warn: logger.warn?.bind(logger) || (() => {}),
  };
  const CHAT_DISABLED = config.disabled;
  const CHAT_API_KEY = config.apiKey;
  const CHAT_MODEL = config.model;
  const EMBED_MODEL = config.embedModel;
  const EMBED_DIMENSIONS = config.embedDimensions;
  const DAILY_LIMIT = config.dailyLimit;
  const CHAT_RETRY_DELAY_MS = config.retryDelayMs;
  const MINUTE_LIMIT = config.minuteLimit;
  const MAX_CONTEXT_CHARS = config.maxContextChars;
  const MAX_MSG_CHARS = config.maxMessageChars;
  const MAX_REPLY_WORDS = config.maxReplyWords;
  const OUT_OF_SCOPE_REPLY = config.outOfScopeReply;
  const NO_EVIDENCE_REPLY = config.noEvidenceReply;

async function getChatUsageSnapshot(supabase) {
  const { data, error } = await supabase.rpc('get_ai_chat_usage', { max_uses: DAILY_LIMIT });
  if (error) {
    console.error('[ai-chat] get_ai_chat_usage error:', error.message);
    return { used: 0, remaining: 0, max: DAILY_LIMIT };
  }
  return {
    used:      data?.used      ?? 0,
    remaining: data?.remaining ?? 0,
    max:       data?.max       ?? DAILY_LIMIT
  };
}

// Per-minute burst limiter (in-memory; effective within a single serverless instance)
const minuteMap = new Map();

function checkMinuteLimit(userId) {
  const now   = Date.now();
  const entry = minuteMap.get(userId);
  if (!entry || now - entry.windowStart > 60_000) {
    minuteMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MINUTE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── Chat handler ──────────────────────────────────────────────────────────────
async function handleChat(req, res, supabase, user) {
  if (CHAT_DISABLED) {
    return res.status(503).json({
      error: 'NexCore Intelligence is under development',
      message: 'NexCore Intelligence is under development and will be available soon.'
    });
  }

  // Per-minute burst check (POST only)
  if (req.method === 'POST' && !checkMinuteLimit(user.id)) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'You are sending messages too quickly. Please wait a moment.'
    });
  }

  // GET: usage check
  if (req.method === 'GET' && String(req.query?.usage || '').trim() === '1') {
    const { data, error } = await supabase.rpc('get_ai_chat_usage', { max_uses: DAILY_LIMIT });
    if (error) {
      console.error('[ai-chat] get_ai_chat_usage error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch usage', details: error.message });
    }
    return res.status(200).json(data);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse and validate body
  const body        = req.body || {};
  const rawMessage  = String(body.message || '').trim();
  if (!rawMessage) {
    return res.status(400).json({ error: 'Missing required field: message' });
  }

  const userMessage = rawMessage.replace(/\0/g, '').slice(0, MAX_MSG_CHARS);

  const projectContext = body.projectContext
    ? {
        title:       String(body.projectContext.title       || '').slice(0, 200),
        description: String(body.projectContext.description || '').slice(0, 800)
      }
    : null;

  const scope = inferScope(userMessage, body.history, Boolean(projectContext));
  if (scope === 'out_of_scope') {
    const usage = await getChatUsageSnapshot(supabase);
    return res.status(200).json({
      reply:     OUT_OF_SCOPE_REPLY,
      used:      usage.used,
      remaining: usage.remaining,
      max:       usage.max,
      sources:   [{ title: 'Scope Policy', source: 'nexcore_policy' }]
    });
  }

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .slice(-12)
    .filter(h => h && (h.role === 'user' || h.role === 'ai' || h.role === 'model') && typeof h.text === 'string')
    .map(h => ({
      role:  (h.role === 'ai' || h.role === 'model') ? 'model' : 'user',
      parts: [{ text: String(h.text).replace(/\0/g, '').slice(0, MAX_MSG_CHARS) }]
    }));

  // Rate limit
  const { data: usageData, error: usageError } = await supabase.rpc('consume_ai_chat_use', {
    max_uses: DAILY_LIMIT
  });

  if (usageError) {
    console.error('[ai-chat] consume_ai_chat_use error:', usageError.message);
    if (usageError.message?.includes('daily limit reached')) {
      return res.status(429).json({
        error:   'Daily chat limit reached',
        message: `You have used all ${DAILY_LIMIT} AI chat messages for today. Try again tomorrow.`,
        remaining: 0
      });
    }
    return res.status(500).json({ error: 'Failed to check usage limit', details: usageError.message });
  }

  const used      = usageData?.used      ?? 0;
  const remaining = usageData?.remaining ?? 0;

  // Gemini clients
  const genAi   = new GoogleGenAI({ apiKey: CHAT_API_KEY, httpOptions: { apiVersion: 'v1' } });
  const embedAi = new GoogleGenAI({ apiKey: CHAT_API_KEY, httpOptions: { apiVersion: 'v1beta' } });

  // Step 1: Generate query embedding
  let queryEmbedding = null;
  try {
    const embedResult = await embedAi.models.embedContent({
      model:    EMBED_MODEL,
      contents: userMessage,
      config: {
        outputDimensionality: EMBED_DIMENSIONS,
        taskType: 'RETRIEVAL_QUERY'
      }
    });
    queryEmbedding =
      embedResult?.embeddings?.[0]?.values ||
      embedResult?.embedding?.values       ||
      null;
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('Embedding values missing from Gemini response');
    }
  } catch (embedErr) {
    console.error('[ai-chat] Embedding error:', embedErr.message);
    queryEmbedding = null;
  }

  // Step 2: Semantic search
  let knowledgeChunks    = [];
  let usedLexicalFallback = false;
  try {
    if (queryEmbedding) {
      const { data: chunks, error: searchError } = await supabase.rpc('search_knowledge', {
        query_embedding: queryEmbedding,
        match_count: 5
      });
      if (searchError) throw new Error(searchError.message);
      knowledgeChunks = (chunks || [])
        .map(c => ({ ...c, _score: relevanceScore(userMessage, c) }))
        .filter(c => c._score >= 2 || (isTrustedKnowledgeSource(c.source) && c._score >= 1))
        .sort((a, b) => b._score - a._score)
        .slice(0, 5)
        .map(({ _score, ...rest }) => rest);
    }
  } catch (searchErr) {
    console.error('[ai-chat] Search error:', searchErr.message);
  }

  // Lexical fallback
  if (knowledgeChunks.length === 0) {
    try {
      const { data: rows, error: fallbackError } = await supabase
        .from('ai_knowledge')
        .select('title, content, source')
        .in('source', ['nexcore', 'project'])
        .limit(120);
      if (fallbackError) throw new Error(fallbackError.message);
      knowledgeChunks     = pickLexicalChunks(userMessage, rows, 5);
      usedLexicalFallback = knowledgeChunks.length > 0;
    } catch (fallbackErr) {
      console.error('[ai-chat] Lexical fallback error:', fallbackErr.message);
    }
  }

  // Step 3: Build context string
  let contextBlock = '';
  if (knowledgeChunks.length > 0) {
    contextBlock = knowledgeChunks
      .map(c => `[${c.source.toUpperCase()}] ${c.title}\n${c.content}`)
      .join('\n\n')
      .slice(0, MAX_CONTEXT_CHARS);
  }

  // Step 4: System instruction
  let systemInstruction = `You are the NexCore AI Assistant — a focused, concise assistant exclusively for NexCore Labs.

## STRICT SCOPE — topics you are allowed to answer:
- NexCore Labs: its mission to empower the SQU community, platform features, tools, services, accounts, AI tools, FAQs
- SQU community use of NexCore for collaboration, project visibility, shared knowledge, and practical digital support
- How to submit, manage, discover, or view projects on NexCore
- Student projects listed on NexCore Labs (use the search_projects or get_project_details tools for live data)
- Direct follow-up questions that relate to the above topics

## HARD RULES — never break these:
- Do NOT answer general coding help, world events, science, math, opinions, or anything unrelated
- Use only evidence from:
  1) [Relevant knowledge for this question] context
  2) Tool results from search_projects/get_project_details/get_platform_stats
  3) Explicit projectContext passed by the client
- If evidence is insufficient, reply EXACTLY: "${NO_EVIDENCE_REPLY}" (in the user's language if not English)
- Do NOT invent project names, numbers, dates, or features

## TOOL USAGE — use tools proactively:
- When asked about "projects", "list projects", "how many projects", "show projects" → ALWAYS use get_platform_stats or search_projects
- When asked about a specific project by name → use search_projects or get_project_details
- Never say "I don't have access" — try the tools first, they have database access
- If tools return no results, then say data is unavailable

## RESPONSE STYLE — be extremely concise:
- Answer in 1-2 direct sentences maximum
- No explanations of your limitations or what you can't access unless specifically asked
- No preambles like "I understand..." or "Let me explain..."
- If you need to use tools (search_projects, get_platform_stats), use them and give the direct answer
- When listing items, use proper markdown: start each item on a new line with "- " or use **bold** for emphasis
- Avoid inline asterisks like "can: * item" — use line breaks instead
- Be helpful but brief — every word counts

## LANGUAGE — multilingual support:
- Detect the language of the user's message
- Respond in the SAME language as the user's question
- If the user asks in Arabic, respond in Arabic; if English, respond in English
- Keep technical terms in English (e.g., "NexCore Labs", "Hub", "API", "GitHub")
- Keep product/feature names in English for consistency
- Support all major languages: Arabic, English, French, Spanish, etc.`;

  if (projectContext) {
    systemInstruction += `\n\nThe user is currently viewing this project:\nTitle: ${projectContext.title}\nDescription: ${projectContext.description}\nYou may reference this project when answering questions about it.`;
  }

  const userTurn = contextBlock
    ? `${userMessage}\n\n[Relevant knowledge for this question]\n${contextBlock}`
    : userMessage;

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userTurn }] }
  ];

  // Tool declarations
  const tools = [{
    functionDeclarations: [
      {
        name: 'search_projects',
        description: 'Search published student projects on NexCore Labs by keyword.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query:    { type: 'STRING',  description: 'Search term matched against project name and description' },
            category: { type: 'STRING',  description: 'Optional category filter (e.g. "AI", "Web Development")' },
            limit:    { type: 'INTEGER', description: 'Max results to return (default 5, max 8)' }
          },
          required: ['query']
        }
      },
      {
        name: 'get_project_details',
        description: 'Get full public details of a specific project by its URL slug.',
        parameters: {
          type: 'OBJECT',
          properties: {
            slug: { type: 'STRING', description: 'The URL slug of the project to look up' }
          },
          required: ['slug']
        }
      },
      {
        name: 'get_platform_stats',
        description: 'Get live NexCore Labs statistics: total published project count and the 3 most recent projects.',
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }];

  // Tool executor (RLS-enforced via user-auth Supabase client)
  const toolEvidence = [];
  const executeTool = async (name, args) => {
    try {
      if (name === 'search_projects') {
        const limit = Math.min(parseInt(args.limit || 5, 10), 8);
        let q = supabase
          .from('projects')
          .select('name, slug, description, category')
          .eq('published', true)
          .limit(limit);
        if (args.query)    q = q.or(`name.ilike.%${args.query}%,description.ilike.%${args.query}%`);
        if (args.category) q = q.ilike('category', `%${args.category}%`);
        const { data } = await q;
        if ((data || []).length > 0) toolEvidence.push(`search_projects:${(data || []).length}`);
        return {
          results: (data || []).map(p => ({
            name:        p.name,
            slug:        p.slug,
            description: (p.description || '').slice(0, 200),
            category:    p.category
          })),
          count: (data || []).length
        };
      }
      if (name === 'get_project_details') {
        const { data } = await supabase
          .from('projects')
          .select('name, slug, description, category, website, github_url')
          .eq('slug', String(args.slug || '').slice(0, 100))
          .eq('published', true)
          .maybeSingle();
        if (!data) return { error: 'Project not found' };
        toolEvidence.push('get_project_details:1');
        return {
          name:        data.name,
          slug:        data.slug,
          description: (data.description || '').slice(0, 500),
          category:    data.category,
          website:     data.website    || null,
          github_url:  data.github_url || null
        };
      }
      if (name === 'get_platform_stats') {
        const [countRes, newestRes] = await Promise.all([
          supabase.from('projects').select('*', { count: 'exact', head: true }).eq('published', true),
          supabase.from('projects').select('name, slug, category').eq('published', true)
            .order('created_at', { ascending: false }).limit(3)
        ]);
        toolEvidence.push('get_platform_stats:1');
        return {
          total_projects:  countRes.count ?? 0,
          newest_projects: newestRes.data || []
        };
      }
    } catch (toolErr) {
      console.error(`[ai-chat] Tool "${name}" error:`, toolErr.message);
      return { error: 'Tool execution failed' };
    }
    return { error: 'Unknown tool' };
  };

  // Helper: single Gemini call with 503 retry
  const callGemini = async (opts) => {
    try {
      return await genAi.models.generateContent(opts);
    } catch (firstErr) {
      const msg = String(firstErr?.message || '');
      const isUnavailable =
        msg.includes('"code":503') ||
        msg.includes('UNAVAILABLE') ||
        msg.toLowerCase().includes('high demand');
      if (!isUnavailable) throw firstErr;
      console.warn('[ai-chat] Gemini high demand, retrying once...');
      await sleep(CHAT_RETRY_DELAY_MS);
      return await genAi.models.generateContent(opts);
    }
  };

  const genOpts = {
    model: CHAT_MODEL,
    systemInstruction,
    tools,
    generationConfig: { temperature: 0.4, maxOutputTokens: 350, topP: 0.85 }
  };

  // Step 5: Agentic loop
  let replyText;
  try {
    let genResult;
    const MAX_TOOL_ROUNDS = 3;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      genResult = await callGemini({ ...genOpts, contents });
      const part = genResult?.candidates?.[0]?.content?.parts?.[0];
      if (!part?.functionCall) break;
      if (round === MAX_TOOL_ROUNDS) { console.warn('[ai-chat] Tool round cap reached'); break; }

      const { name, args } = part.functionCall;
      console.log(`[ai-chat] Tool call: ${name}`, args);
      const toolResult = await executeTool(name, args);
      contents.push({ role: 'model', parts: [{ functionCall: { name, args } }] });
      contents.push({ role: 'user', parts: [{ functionResponse: { name, response: { result: toolResult } } }] });
    }

    replyText =
      genResult?.text ||
      genResult?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!replyText) throw new Error('Gemini returned empty response');
  } catch (genErr) {
    console.error('[ai-chat] Gemini generation error:', genErr.message);
    const genMsg = String(genErr?.message || '');
    if (genMsg.includes('429') || genMsg.toLowerCase().includes('quota')) {
      return res.status(503).json({
        error:   'AI temporarily unavailable',
        code:    'quota_exhausted',
        message: 'The AI service is at capacity. Please try again in a moment.'
      });
    }
    if (genMsg.includes('"code":503') || genMsg.includes('UNAVAILABLE') || genMsg.toLowerCase().includes('high demand')) {
      return res.status(503).json({
        error:   'AI temporarily unavailable',
        code:    'model_busy',
        message: 'The AI model is under high demand right now. Please retry in a few seconds.'
      });
    }
    return res.status(500).json({ error: 'AI generation failed', details: genErr.message });
  }

  // Return success
  const hasEvidence = Boolean(projectContext) || knowledgeChunks.length > 0 || toolEvidence.length > 0;
  const finalReply  = hasEvidence ? trimReplyWords(replyText, MAX_REPLY_WORDS) : NO_EVIDENCE_REPLY;

  return res.status(200).json({
    reply:          finalReply,
    used,
    remaining,
    max:            DAILY_LIMIT,
    sources:        knowledgeChunks.map(c => ({ title: c.title, source: c.source })),
    retrieval_mode: usedLexicalFallback ? 'lexical_fallback' : 'vector'
  });
}

  return handleChat;
}

module.exports = { createChatHandler };
