"use strict";

const {
  generateAssistContent,
  isGeminiQuotaError,
  isGeminiUnavailableError,
} = require("./gemini");

function createAssistHandler({ GoogleGenAI, config, logger = globalThis.console }) {
  const console = {
    error: logger.error?.bind(logger) || (() => {}),
    log: logger.log?.bind(logger) || (() => {}),
    warn: logger.warn?.bind(logger) || (() => {}),
  };
  const GEMINI_API_KEY = config.geminiApiKey;
  const GEMINI_MODEL = config.model;
  const GEMINI_FALLBACK_MODEL = config.fallbackModel;
  const ASSIST_RETRY_DELAY_MS = config.retryDelayMs;

async function handleAssist(req, res, supabase, user) {
  const usageQuery = String(req.query?.usage || '').trim();
  if (req.method === 'GET' && usageQuery === '1') {
    const { data: usageData, error: usageError } = await supabase.rpc('get_ai_usage', { max_uses: 3 });
    if (usageError) {
      console.error('Usage RPC error:', usageError);
      return res.status(500).json({ error: 'Failed to fetch AI usage', details: usageError.message });
    }
    const used      = Number(usageData?.used ?? usageData?.use_count ?? 0);
    const remaining = Number(usageData?.remaining ?? Math.max(0, 3 - used));
    return res.status(200).json({
      used:      Number.isNaN(used)      ? 0 : used,
      remaining: Number.isNaN(remaining) ? 0 : remaining,
      max: 3
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('AI user:', user.id);

  const { action, text, style } = req.body;

  if (!action || !text) {
    return res.status(400).json({ error: 'Missing required fields: action, text' });
  }

  if (!['improve_page', 'card_summary', 'project_insights'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be improve_page, card_summary, or project_insights' });
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc('consume_ai_use', { max_uses: 3 });

  if (rpcError) {
    console.error('RPC error:', rpcError);
    if (rpcError.message && rpcError.message.includes('AI daily limit reached')) {
      return res.status(429).json({
        error:     'AI daily limit reached',
        remaining: 0,
        message:   'You have reached your daily limit of 3 AI actions. Try again tomorrow.'
      });
    }
    return res.status(500).json({ error: 'Failed to check AI usage limit', details: rpcError.message });
  }

  const used      = Number(rpcData || 0);
  const remaining = Math.max(0, 3 - used);
  console.log('AI used:', used, 'remaining:', remaining);

  let prompt = '';
  if (action === 'improve_page') {
    const styleGuide = {
      Professional: 'Rewrite this in a professional, polished tone suitable for business and academic audiences.',
      Shorter:      'Make this more concise and to the point. Remove redundancy while keeping key information.',
      Technical:    'Rewrite this with a technical focus, emphasizing technical details and capabilities.',
      Inspiring:    'Make this more inspiring and motivational, highlighting vision and impact.'
    };
    const styleInstruction = styleGuide[style] || styleGuide.Professional;
    prompt = `${styleInstruction}

RULES:
- Do NOT invent achievements, affiliations, or facts
- Only restructure and rewrite what is already provided
- Keep the output to 200-300 words maximum
- Maintain accuracy and authenticity
- Output plain text only, no markdown formatting

Original text:
${text}`;
  } else if (action === 'card_summary') {
    prompt = `Create a brief, engaging 1-2 sentence summary (60-80 words max) suitable for a project card display. 

RULES:
- Do NOT invent information
- Only summarize what is provided
- Focus on the most important aspects
- Make it concise and appealing
- Output plain text only, no markdown formatting

Source text:
${text}`;
  } else if (action === 'project_insights') {
    prompt = `Generate a short summary (1-2 sentences, 50-80 words) that describes the project's name and the core of what it provides, based on the description.

Return a JSON object with:
- "summary": the summary text
- "insights": [] (empty array)

RULES:
- Include the project's name in the summary
- Focus on what the project provides or its core functionality
- Be concise and informative
- Output ONLY valid JSON, no markdown, no code fences, no extra text

Project name: ${req.body.project_name || ''}
Project description:
${text}`;
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  console.log('Using model:', GEMINI_MODEL, 'fallback:', GEMINI_FALLBACK_MODEL);

  let result;
  let usedModel = GEMINI_MODEL;
  try {
    const generated = await generateAssistContent(
      ai,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature:     0.7,
          maxOutputTokens: action === 'card_summary' ? 300 : 700
        }
      },
      {
        model: GEMINI_MODEL,
        fallbackModel: GEMINI_FALLBACK_MODEL,
        retryDelayMs: ASSIST_RETRY_DELAY_MS,
        logger: console
      }
    );
    result = generated.result;
    usedModel = generated.model;
  } catch (geminiErr) {
    console.error('Gemini API error:', geminiErr?.message || geminiErr);
    if (isGeminiQuotaError(geminiErr) || isGeminiUnavailableError(geminiErr)) {
      return res.status(503).json({
        error: 'AI temporarily unavailable',
        details: 'Gemini is at capacity. Please try again shortly.',
        model: GEMINI_MODEL
      });
    }
    return res.status(500).json({ error: 'Gemini API failed', details: geminiErr?.message || String(geminiErr), model: GEMINI_MODEL });
  }

  const generatedText = result?.text || '';
  if (!generatedText) {
    console.error('No result from Gemini');
    return res.status(500).json({ error: 'No response generated from AI' });
  }

  if (action === 'project_insights') {
    try {
      const cleaned = generatedText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      const parsed  = JSON.parse(cleaned);
      return res.status(200).json({
        summary:  parsed.summary || '',
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        used,
        remaining
      });
    } catch (parseErr) {
      console.error('Failed to parse project_insights JSON:', parseErr, generatedText);
      return res.status(500).json({ error: 'AI returned invalid JSON for project insights' });
    }
  }

  return res.status(200).json({ text: generatedText.trim(), used, remaining, model: usedModel });
}

  return handleAssist;
}

module.exports = { createAssistHandler };
