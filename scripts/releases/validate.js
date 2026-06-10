const { loadReleaseData, validateReleaseData } = require('./lib');

try {
  const data = loadReleaseData();
  validateReleaseData(data);
  console.log(`Validated ${data.releases.length} bilingual releases. Latest: ${data.releases[0].version}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
