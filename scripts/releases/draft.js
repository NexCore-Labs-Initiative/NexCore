const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { GoogleGenAI } = require('@google/genai');
const {
  DATA_PATH,
  DEV_GROUPS,
  ROOT,
  USER_GROUPS,
  bumpVersion,
  git,
  loadReleaseData,
  validateReleaseData
} = require('./lib');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function cleanJson(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

function resolveVersion(currentVersion, recommendation, override = '') {
  if (!override) return bumpVersion(currentVersion, recommendation);
  return override.startsWith('v') ? override : `v${override}`;
}

function collectEvidence(baseTag, source) {
  const commits = git(['log', '--format=%H%x09%s', `${baseTag}..${source}`])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, ...subject] = line.split('\t');
      return { sha, subject: subject.join('\t') };
    });
  const files = git(['diff', '--name-only', `${baseTag}..${source}`]).split('\n').filter(Boolean);
  const stat = git(['diff', '--stat', `${baseTag}..${source}`]);
  const diff = git(
    ['diff', '--unified=2', `${baseTag}..${source}`, '--', '.', ':(exclude)package-lock.json'],
    { maxBuffer: 20 * 1024 * 1024 }
  ).slice(0, 60000);
  return { commits, files, stat, diff };
}

function promptForDraft(context) {
  return `You are preparing a bilingual release draft for NexCore Labs.

Compare ${context.baseTag} with ${context.source}. Use only the supplied Git evidence.
Recommend exactly one semantic version level: patch, minor, or major.
Write concise user-facing updates and detailed developer notes in English and Arabic.
Every bullet must cite at least one evidence reference using:
- commit:<full commit SHA>
- file:<exact changed path>
Do not invent features. Preserve code identifiers and file paths in backticks.
Allowed tags: feature, improvement, fix. Do not create a developer tag.

Return only JSON with this exact shape:
{
  "version_recommendation": "patch|minor|major",
  "title": {"en":"...", "ar":"..."},
  "summary": {"en":"...", "ar":"..."},
  "tags": ["feature"],
  "user_updates": {
    "features": [{"text":{"en":"...","ar":"..."},"evidence":["commit:...","file:..."]}],
    "improvements": [],
    "fixes": []
  },
  "developer_notes": {
    "technical_changes": [],
    "database_changes": [],
    "api_updates": [],
    "internal_improvements": []
  },
  "is_major_release": false,
  "major_details": null
}
For a major release, major_details must contain en/ar objects with why_it_matters, description, and highlights.

COMMITS:
${context.commits.map((commit) => `${commit.sha} ${commit.subject}`).join('\n')}

CHANGED FILES:
${context.files.join('\n')}

DIFF STAT:
${context.stat}

BOUNDED DIFF:
${context.diff}`;
}

function verifyDraftEvidence(draft, context) {
  const commitRefs = new Set(context.commits.map((commit) => `commit:${commit.sha}`));
  const fileRefs = new Set(context.files.map((file) => `file:${file}`));
  const allowed = new Set([...commitRefs, ...fileRefs]);
  const errors = [];
  for (const group of USER_GROUPS) {
    for (const item of draft.user_updates?.[group] || []) verifyItem(item, group, allowed, errors);
  }
  for (const group of DEV_GROUPS) {
    for (const item of draft.developer_notes?.[group] || []) verifyItem(item, group, allowed, errors);
  }
  if (errors.length) throw new Error(`Gemini returned unsupported evidence:\n- ${errors.join('\n- ')}`);
}

function verifyItem(item, group, allowed, errors) {
  for (const evidence of item.evidence || []) {
    if (!allowed.has(evidence)) errors.push(`${group}: ${evidence}`);
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required.');

  const source = arg('source', process.env.RELEASE_SOURCE || 'dev');
  const baseTag = arg('base') || git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', source]);
  const data = loadReleaseData();
  validateReleaseData(data);
  const currentVersion = data.releases[0].version;
  const context = { baseTag, source, ...collectEvidence(baseTag, source) };
  if (!context.commits.length) throw new Error(`No commits found in ${baseTag}..${source}`);

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || 'models/gemini-2.5-flash';
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: promptForDraft(context) }] }],
    config: {
      temperature: 0.2,
      maxOutputTokens: 10000,
      responseMimeType: 'application/json'
    }
  });

  const draft = JSON.parse(cleanJson(response?.text));
  if (!['patch', 'minor', 'major'].includes(draft.version_recommendation)) {
    throw new Error(`Invalid version recommendation: ${draft.version_recommendation}`);
  }
  verifyDraftEvidence(draft, context);

  const override = arg('version', process.env.RELEASE_VERSION || '');
  const version = resolveVersion(currentVersion, draft.version_recommendation, override);
  const date = arg('date', process.env.RELEASE_DATE || new Date().toISOString().slice(0, 10));

  const release = {
    version,
    date,
    title: draft.title,
    summary: draft.summary,
    tags: draft.tags,
    user_updates: draft.user_updates,
    developer_notes: draft.developer_notes,
    is_major_release: Boolean(draft.is_major_release),
    ...(draft.is_major_release ? { major_details: draft.major_details } : {}),
    source: {
      base_tag: baseTag,
      target: source,
      commit_range: `${baseTag}..${source}`
    }
  };

  const nextData = { ...data, releases: [release, ...data.releases] };
  validateReleaseData(nextData, { checkVersions: false });
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(nextData, null, 2)}\n`, 'utf8');
  execFileSync(process.execPath, [path.join(__dirname, 'generate.js')], { cwd: ROOT, stdio: 'inherit' });
  console.log(`Drafted ${version} from ${baseTag}..${source} using ${model}.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { cleanJson, resolveVersion, verifyDraftEvidence };
