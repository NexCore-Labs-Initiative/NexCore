const fs = require('fs');
const path = require('path');
const {
  ROOT,
  changelogForLanguage,
  loadReleaseData,
  validateReleaseData
} = require('./lib');

const checkOnly = process.argv.includes('--check');
const data = loadReleaseData();
validateReleaseData(data, { checkVersions: false });
const latest = data.releases[0];
const version = latest.version;
const bareVersion = version.slice(1);

const outputs = new Map([
  [path.join(ROOT, 'CHANGELOG.md'), changelogForLanguage(data, 'en')],
  [path.join(ROOT, 'CHANGELOG.ar.md'), changelogForLanguage(data, 'ar')]
]);

const packageJsonPath = path.join(ROOT, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.version = bareVersion;
outputs.set(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

const lockPath = path.join(ROOT, 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
lock.version = bareVersion;
if (lock.packages?.['']) lock.packages[''].version = bareVersion;
outputs.set(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

outputs.set(
  path.join(ROOT, 'version.js'),
  fs.readFileSync(path.join(ROOT, 'version.js'), 'utf8')
    .replace(/APP_VERSION\s*=\s*['"][^'"]+['"]/, `APP_VERSION = '${version}'`)
);
outputs.set(
  path.join(ROOT, 'service-worker.js'),
  fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8')
    .replace(/CACHE_VERSION\s*=\s*['"][^'"]+['"]/, `CACHE_VERSION = '${version}'`)
);
outputs.set(
  path.join(ROOT, 'README.md'),
  fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
    .replace(/Current version:\s*\*\*v\d+\.\d+\.\d+\*\*/, `Current version: **${version}**`)
);
for (const relative of ['releases.html', path.join('ar', 'releases.html')]) {
  const pagePath = path.join(ROOT, relative);
  outputs.set(
    pagePath,
    fs.readFileSync(pagePath, 'utf8')
      .replace(/releases\.css(?:\?v=[^"']+)?(?=["'])/g, `releases.css?v=${bareVersion}`)
      .replace(/releases\.js(?:\?v=[^"']+)?(?=["'])/g, `releases.js?v=${bareVersion}`)
  );
}

const changed = [];
for (const [file, expected] of outputs) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current === expected) continue;
  changed.push(path.relative(ROOT, file));
  if (!checkOnly) fs.writeFileSync(file, expected, 'utf8');
}

if (checkOnly && changed.length) {
  console.error(`Generated release artifacts are stale:\n- ${changed.join('\n- ')}`);
  process.exit(1);
}

if (!checkOnly) {
  console.log(changed.length ? `Generated:\n- ${changed.join('\n- ')}` : 'Release artifacts are already current.');
}
