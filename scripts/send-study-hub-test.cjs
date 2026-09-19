// Manual local smoke test only. Load an isolated local .env with node --env-file=.env.
const { configuration, sign } = require("../lib/study-hub-ingest");
const {
  payload,
  env,
} = require("../tests/helpers/study-hub-ingestion-fixture.cjs");
async function main() {
  const cfg = configuration();
  if (
    cfg.spreadsheet !== env.STUDY_HUB_GOOGLE_SPREADSHEET_ID ||
    cfg.sheetId !== 12
  )
    throw new Error(
      "Use synthetic_study_hub_sheet / tab 12 and an isolated test database.",
    );
  const url = new URL(
    process.argv.find((v) => v.startsWith("http")) ||
      "http://localhost:3000/api/integrations/study-hub-ingest",
  );
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.protocol !== "http:" ||
    url.pathname !== "/api/integrations/study-hub-ingest"
  )
    throw new Error(
      "This helper sends only to the localhost ingestion endpoint.",
    );
  const p = payload();
  if (process.argv.includes("--check")) {
    p.kind = "check";
    delete p.values;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sign(p, cfg.secret)),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  console.log(res.status, await res.json());
  if (!res.ok) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
