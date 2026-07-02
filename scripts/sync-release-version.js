"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const target = process.argv[2]?.replace(/^v/, "");

if (!target || !/^\d+\.\d+\.\d+$/.test(target)) {
  console.error("Usage: npm run release -- <major.minor.patch>");
  process.exit(1);
}

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const readJson = (file) => JSON.parse(read(file));
const write = (file, content) => fs.writeFileSync(path.join(root, file), content, "utf8");
const writeJson = (file, value) => write(file, `${JSON.stringify(value, null, 2)}\n`);

const releases = readJson("assets/data/releases.json");
const expectedTag = `v${target}`;
const latestRelease = releases.releases?.[0]?.version;

if (latestRelease !== expectedTag) {
  console.error(`Refusing to publish ${expectedTag}: assets/data/releases.json starts with ${latestRelease || "no release"}.`);
  console.error("Document the release first, then run this command again.");
  process.exit(1);
}

for (const file of ["CHANGELOG.md", "CHANGELOG.ar.md"]) {
  const firstVersion = read(file).match(/^## v(\d+\.\d+\.\d+)\b/m)?.[1];
  if (firstVersion !== target) {
    console.error(`Refusing to publish ${expectedTag}: ${file} starts with v${firstVersion || "unknown"}.`);
    process.exit(1);
  }
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");

packageJson.version = target;
packageLock.version = target;
if (packageLock.packages?.[""]) packageLock.packages[""].version = target;

const versionSource = read("version.js").replace(
  /const APP_VERSION = 'v[^']+';/,
  `const APP_VERSION = '${expectedTag}';`
);
const serviceWorker = read("service-worker.js").replace(
  /const CACHE_VERSION = 'v[^']+';/,
  `const CACHE_VERSION = '${expectedTag}';`
);

writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
write("version.js", versionSource);
write("service-worker.js", serviceWorker);

console.log(`Synchronized NexCore release surfaces to ${expectedTag}.`);
