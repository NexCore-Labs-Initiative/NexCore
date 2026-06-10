const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_PATH = path.join(ROOT, 'assets', 'data', 'releases.json');
const USER_GROUPS = ['features', 'improvements', 'fixes'];
const DEV_GROUPS = ['technical_changes', 'database_changes', 'api_updates', 'internal_improvements'];
const SUPPORTED_TAGS = new Set(['feature', 'improvement', 'fix']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadReleaseData() {
  return readJson(DATA_PATH);
}

function semverParts(version) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid semantic version: ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(a, b) {
  const left = semverParts(a);
  const right = semverParts(b);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function bumpVersion(version, level) {
  let [major, minor, patch] = semverParts(version);
  if (level === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (level === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `v${major}.${minor}.${patch}`;
}

function validateReleaseData(data, options = {}) {
  const errors = [];
  validateStructure(data, errors);

  const versions = new Set();
  (data.releases || []).forEach((release, index) => {
    if (!release || typeof release !== 'object' || Array.isArray(release)) return;
    if (versions.has(release.version)) errors.push(`Duplicate version: ${release.version}`);
    versions.add(release.version);

    const previous = data.releases[index - 1];
    const versionIsValid = /^v\d+\.\d+\.\d+$/.test(release.version || '');
    const previousIsValid = /^v\d+\.\d+\.\d+$/.test(previous?.version || '');
    if (index > 0 && versionIsValid && previousIsValid &&
        compareVersions(previous.version, release.version) <= 0) {
      errors.push(`Releases must be newest first: ${data.releases[index - 1].version} before ${release.version}`);
    }

    if (Array.isArray(release.tags) && release.tags.some((tag) => !SUPPORTED_TAGS.has(tag))) {
      errors.push(`${release.version} contains an unsupported tag`);
    }
    if (!isCalendarDate(release.date)) errors.push(`${release.version} has an invalid date: ${release.date}`);

    const itemCount = USER_GROUPS.reduce(
      (count, group) => count + (Array.isArray(release.user_updates?.[group]) ? release.user_updates[group].length : 0),
      0
    ) + DEV_GROUPS.reduce(
      (count, group) => count + (Array.isArray(release.developer_notes?.[group]) ? release.developer_notes[group].length : 0),
      0
    );
    if (itemCount === 0) errors.push(`${release.version} has no release items`);

    for (const group of USER_GROUPS) {
      const items = release.user_updates?.[group];
      if (Array.isArray(items)) {
        for (const item of items) validateItem(item, release.version, group, errors);
      }
    }
    for (const group of DEV_GROUPS) {
      const items = release.developer_notes?.[group];
      if (Array.isArray(items)) {
        for (const item of items) validateItem(item, release.version, group, errors);
      }
    }

    if (release.is_major_release && !release.major_details) {
      errors.push(`${release.version} is major but has no major_details`);
    }
    if (!release.is_major_release && release.major_details) {
      errors.push(`${release.version} has major_details but is_major_release is false`);
    }
  });

  if (options.checkVersions !== false && data.releases?.length) {
    errors.push(...validateVersionFiles(data.releases[0].version));
  }

  if (errors.length) {
    const error = new Error(`Release validation failed:\n- ${errors.join('\n- ')}`);
    error.validationErrors = errors;
    throw error;
  }
  return data;
}

function validateStructure(data, errors) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('Release data must be an object');
    return;
  }
  if (data.schema_version !== 1) errors.push('schema_version must be 1');
  if (!Array.isArray(data.releases) || data.releases.length === 0) {
    errors.push('releases must be a non-empty array');
    return;
  }

  data.releases.forEach((release, index) => {
    const label = release?.version || `release ${index + 1}`;
    if (!release || typeof release !== 'object' || Array.isArray(release)) {
      errors.push(`${label} must be an object`);
      return;
    }
    if (!/^v\d+\.\d+\.\d+$/.test(release.version || '')) errors.push(`${label} has an invalid semantic version`);
    validateLocalizedText(release.title, `${label} title`, errors);
    validateLocalizedText(release.summary, `${label} summary`, errors);
    if (!Array.isArray(release.tags) || release.tags.length === 0) errors.push(`${label} tags must be a non-empty array`);
    if (new Set(release.tags || []).size !== (release.tags || []).length) errors.push(`${label} contains duplicate tags`);

    validateGroups(release.user_updates, USER_GROUPS, `${label} user_updates`, errors);
    validateGroups(release.developer_notes, DEV_GROUPS, `${label} developer_notes`, errors);

    if (typeof release.is_major_release !== 'boolean') errors.push(`${label} is_major_release must be boolean`);
    if (!release.source || typeof release.source !== 'object') {
      errors.push(`${label} source is required`);
    } else {
      for (const field of ['base_tag', 'target', 'commit_range']) {
        if (!String(release.source[field] || '').trim()) errors.push(`${label} source.${field} is required`);
      }
    }

    if (release.major_details) {
      for (const language of ['en', 'ar']) {
        const details = release.major_details[language];
        if (!details || typeof details !== 'object') {
          errors.push(`${label} major_details.${language} is required`);
          continue;
        }
        for (const field of ['why_it_matters', 'description']) {
          if (!String(details[field] || '').trim()) errors.push(`${label} major_details.${language}.${field} is required`);
        }
        if (!Array.isArray(details.highlights) || details.highlights.length === 0 ||
            details.highlights.some((highlight) => !String(highlight || '').trim())) {
          errors.push(`${label} major_details.${language}.highlights must contain text`);
        }
      }
    }
  });
}

function validateLocalizedText(value, label, errors) {
  if (!value || typeof value !== 'object') {
    errors.push(`${label} is required`);
    return;
  }
  for (const language of ['en', 'ar']) {
    if (!String(value[language] || '').trim()) errors.push(`${label}.${language} is required`);
  }
}

function validateGroups(value, groups, label, errors) {
  if (!value || typeof value !== 'object') {
    errors.push(`${label} is required`);
    return;
  }
  for (const group of groups) {
    if (group in value && !Array.isArray(value[group])) errors.push(`${label}.${group} must be an array`);
  }
  const allowed = new Set(groups);
  for (const group of Object.keys(value)) {
    if (!allowed.has(group)) errors.push(`${label}.${group} is unsupported`);
  }
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateItem(item, version, group, errors) {
  if (!item?.text?.en?.trim() || !item?.text?.ar?.trim()) {
    errors.push(`${version} ${group} item is missing English or Arabic text`);
  }
  if (!Array.isArray(item?.evidence) || item.evidence.length === 0) {
    errors.push(`${version} ${group} item is missing evidence`);
  } else {
    if (new Set(item.evidence).size !== item.evidence.length) {
      errors.push(`${version} ${group} item contains duplicate evidence`);
    }
    for (const reference of item.evidence) {
      if (!/^(tag:v\d+\.\d+\.\d+|commit:[0-9a-f]{40}|file:.+)$/i.test(reference)) {
        errors.push(`${version} ${group} item has invalid evidence: ${reference}`);
      }
    }
  }
}

function validateVersionFiles(version) {
  const bare = version.slice(1);
  const checks = [
    ['package.json', readJson(path.join(ROOT, 'package.json')).version, bare],
    ['package-lock.json', readJson(path.join(ROOT, 'package-lock.json')).version, bare],
    ['version.js', matchFile('version.js', /APP_VERSION\s*=\s*['"]([^'"]+)/), version],
    ['service-worker.js', matchFile('service-worker.js', /CACHE_VERSION\s*=\s*['"]([^'"]+)/), version],
    ['README.md', matchFile('README.md', /Current version:\s*\*\*(v\d+\.\d+\.\d+)\*\*/), version]
  ];
  return checks
    .filter(([, actual, expected]) => actual !== expected)
    .map(([file, actual, expected]) => `${file} version ${actual || '(missing)'} does not match ${expected}`);
}

function matchFile(relative, regex) {
  return regex.exec(fs.readFileSync(path.join(ROOT, relative), 'utf8'))?.[1] || '';
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer || 10 * 1024 * 1024
  }).trim();
}

function formatDate(date, lang) {
  const locale = lang === 'ar' ? 'ar-OM' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

function localizeItem(item, lang) {
  return item.text[lang];
}

function escapeMarkdown(text) {
  return String(text || '').trim();
}

function changelogForLanguage(data, lang) {
  const arabic = lang === 'ar';
  const lines = [arabic ? '# سجل التغييرات' : '# Changelog', ''];
  const userLabels = arabic
    ? { features: 'ميزات جديدة', improvements: 'تحسينات', fixes: 'إصلاحات' }
    : { features: 'New Features', improvements: 'Improvements', fixes: 'Fixes' };
  const devLabels = arabic
    ? {
        technical_changes: 'تغييرات تقنية',
        database_changes: 'تغييرات قاعدة البيانات',
        api_updates: 'تحديثات API',
        internal_improvements: 'تحسينات داخلية'
      }
    : {
        technical_changes: 'Technical Changes',
        database_changes: 'Database Changes',
        api_updates: 'API Updates',
        internal_improvements: 'Internal Improvements'
      };

  for (const release of data.releases) {
    lines.push(`## ${release.version} - ${formatDate(release.date, lang)}`, '');
    lines.push(`### ${release.title[lang]}`, '', release.summary[lang], '');

    for (const group of USER_GROUPS) {
      const items = release.user_updates[group] || [];
      if (!items.length) continue;
      lines.push(`#### ${userLabels[group]}`, '');
      items.forEach((item) => lines.push(`- ${escapeMarkdown(localizeItem(item, lang))}`));
      lines.push('');
    }

    const hasDeveloperNotes = DEV_GROUPS.some((group) => (release.developer_notes[group] || []).length);
    if (hasDeveloperNotes) {
      lines.push(`### ${arabic ? 'ملاحظات المطور' : 'Developer Notes'}`, '');
      for (const group of DEV_GROUPS) {
        const items = release.developer_notes[group] || [];
        if (!items.length) continue;
        lines.push(`#### ${devLabels[group]}`, '');
        items.forEach((item) => lines.push(`- ${escapeMarkdown(localizeItem(item, lang))}`));
        lines.push('');
      }
    }

    lines.push('---', '');
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function releaseNotes(data, version, lang = 'en') {
  const release = data.releases.find((entry) => entry.version === version);
  if (!release) throw new Error(`Release not found: ${version}`);
  const lines = [`# ${release.version} - ${release.title[lang]}`, '', release.summary[lang], ''];
  const labels = lang === 'ar'
    ? { features: 'ميزات جديدة', improvements: 'تحسينات', fixes: 'إصلاحات' }
    : { features: 'New Features', improvements: 'Improvements', fixes: 'Fixes' };
  for (const group of USER_GROUPS) {
    const items = release.user_updates[group] || [];
    if (!items.length) continue;
    lines.push(`## ${labels[group]}`, '');
    items.forEach((item) => lines.push(`- ${item.text[lang]}`));
    lines.push('');
  }
  const developerLabels = lang === 'ar'
    ? {
        technical_changes: 'تغييرات تقنية',
        database_changes: 'تغييرات قاعدة البيانات',
        api_updates: 'تحديثات API',
        internal_improvements: 'تحسينات داخلية'
      }
    : {
        technical_changes: 'Technical Changes',
        database_changes: 'Database Changes',
        api_updates: 'API Updates',
        internal_improvements: 'Internal Improvements'
      };
  if (DEV_GROUPS.some((group) => release.developer_notes[group]?.length)) {
    lines.push(`## ${lang === 'ar' ? 'ملاحظات المطور' : 'Developer Notes'}`, '');
    for (const group of DEV_GROUPS) {
      const items = release.developer_notes[group] || [];
      if (!items.length) continue;
      lines.push(`### ${developerLabels[group]}`, '');
      items.forEach((item) => lines.push(`- ${item.text[lang]}`));
      lines.push('');
    }
  }
  if (lang === 'en') {
    lines.push('## Arabic', '', '[Read the Arabic changelog](https://github.com/NexCoreLabs/NexCore/blob/main/CHANGELOG.ar.md)', '');
  }
  return `${lines.join('\n').trim()}\n`;
}

module.exports = {
  DATA_PATH,
  DEV_GROUPS,
  ROOT,
  USER_GROUPS,
  bumpVersion,
  changelogForLanguage,
  compareVersions,
  formatDate,
  git,
  loadReleaseData,
  releaseNotes,
  semverParts,
  validateReleaseData
};
