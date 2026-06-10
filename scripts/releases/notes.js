const fs = require('fs');
const { loadReleaseData, releaseNotes, validateReleaseData } = require('./lib');

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const data = loadReleaseData();
validateReleaseData(data);
const version = arg('version', data.releases[0].version);
const lang = arg('lang', 'en');
const output = arg('output');
const notes = releaseNotes(data, version, lang);

if (output) fs.writeFileSync(output, notes, 'utf8');
else process.stdout.write(notes);
