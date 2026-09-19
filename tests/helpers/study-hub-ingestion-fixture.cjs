const { HEADERS } = require("../../lib/study-hub-intake");
// Synthetic values only. This secret has no use outside automated tests.
const env = {
  STUDY_HUB_INGEST_SECRET: "a".repeat(64),
  STUDY_HUB_INGEST_ENABLED: "true",
  STUDY_HUB_GOOGLE_SPREADSHEET_ID: "synthetic_study_hub_sheet",
  STUDY_HUB_GOOGLE_SHEET_ID: "12",
};
function payload(id = "40000000-0000-0000-0000-000000000001") {
  return {
    kind: "submission",
    spreadsheet_id: env.STUDY_HUB_GOOGLE_SPREADSHEET_ID,
    sheet_id: 12,
    row_number: 2,
    timezone: "Asia/Muscat",
    headers: Object.values(HEADERS).map((v) => v[0]),
    values: [
      id,
      46000,
      "Private Student",
      "INTAKEBROWSER",
      "Browser course",
      "Spring26",
      "Intake browser " + id,
      "Notes",
      "Arrays، Loops",
      "https://drive.google.com/file/d/" + id + "/view",
      "Study notes",
      "No",
      "I have read and agree to the Contribution Terms.",
      "Private note",
      "",
      "",
    ],
  };
}
module.exports = { env, payload };
