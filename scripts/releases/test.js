const assert = require('assert');
const {
  bumpVersion,
  compareVersions,
  validateReleaseData
} = require('./lib');
const { cleanJson, resolveVersion, verifyDraftEvidence } = require('./draft');

function item(en = 'English text', ar = 'نص عربي') {
  return { text: { en, ar }, evidence: ['file:index.html'] };
}

function release(version = 'v1.2.3') {
  return {
    version,
    date: '2026-06-10',
    title: { en: 'Release title', ar: 'عنوان الإصدار' },
    summary: { en: 'Release summary', ar: 'ملخص الإصدار' },
    tags: ['feature'],
    user_updates: { features: [item()] },
    developer_notes: { technical_changes: [item()] },
    is_major_release: false,
    source: { base_tag: 'v1.2.2', target: 'dev', commit_range: 'v1.2.2..dev' }
  };
}

function expectFailure(data, fragment) {
  assert.throws(
    () => validateReleaseData(data, { checkVersions: false }),
    (error) => error.message.includes(fragment)
  );
}

assert.equal(bumpVersion('v1.2.3', 'patch'), 'v1.2.4');
assert.equal(bumpVersion('v1.2.3', 'minor'), 'v1.3.0');
assert.equal(bumpVersion('v1.2.3', 'major'), 'v2.0.0');
assert(compareVersions('v2.0.0', 'v1.9.9') > 0);
assert.equal(resolveVersion('v1.2.3', 'patch'), 'v1.2.4');
assert.equal(resolveVersion('v1.2.3', 'patch', '2.0.0'), 'v2.0.0');

validateReleaseData({ schema_version: 1, releases: [release()] }, { checkVersions: false });

const duplicate = release();
expectFailure({ schema_version: 1, releases: [release(), duplicate] }, 'Duplicate version');

const missingArabic = release();
missingArabic.user_updates.features[0].text.ar = '';
expectFailure({ schema_version: 1, releases: [missingArabic] }, 'missing English or Arabic');

const missingEvidence = release();
missingEvidence.user_updates.features[0].evidence = [];
expectFailure({ schema_version: 1, releases: [missingEvidence] }, 'missing evidence');

const malformedDate = release();
malformedDate.date = '2026-02-30';
expectFailure({ schema_version: 1, releases: [malformedDate] }, 'invalid date');

const malformedVersion = release('1.2');
expectFailure({ schema_version: 1, releases: [malformedVersion] }, 'invalid semantic version');

const unsupportedTag = release();
unsupportedTag.tags = ['developer'];
expectFailure({ schema_version: 1, releases: [unsupportedTag] }, 'unsupported tag');

const missingGroup = release();
missingGroup.user_updates.fixes = {};
expectFailure({ schema_version: 1, releases: [missingGroup] }, 'user_updates.fixes must be an array');

assert.equal(cleanJson('```json\n{"ok":true}\n```'), '{"ok":true}');
assert.throws(() => JSON.parse(cleanJson('not valid JSON')), SyntaxError);
assert.throws(
  () => verifyDraftEvidence(release(), { commits: [], files: ['other.html'] }),
  /unsupported evidence/
);

console.log('Release pipeline tests passed.');
