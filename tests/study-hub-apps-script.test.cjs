const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { env, payload } = require("./helpers/study-hub-ingestion-fixture.cjs");
const { authenticate, configuration } = require("../lib/study-hub-ingest");
const { sheetTime, HEADERS } = require("../lib/study-hub-intake");
function trigger(handler, source, type, minutes) {
  return {
    handler,
    source,
    type,
    minutes,
    getHandlerFunction: () => handler,
    getTriggerSourceId: () => source,
    getEventType: () => type,
  };
}
function harness(options = {}) {
  const p = payload();
  p.values[0] = "";
  p.values[1] = new Date(sheetTime(46000, "Asia/Muscat"));
  const rows = [
    [...p.headers, "Your SQU id", "Email Address"],
    [...p.values, "PRIVATE-ID", "PRIVATE-EMAIL"],
  ];
  const props = new Map(
    Object.entries({
      ...env,
      STUDY_HUB_INGEST_URL:
        "https://example.invalid/api/integrations/study-hub-ingest",
    }),
  );
  const requests = [];
  const triggers = [...(options.triggers || [])];
  const opened = [];
  let locks = 0,
    unlocks = 0;
  const sheet = {
    getSheetId: () => 12,
    getParent: () => book,
    getLastColumn: () => rows[0].length,
    getLastRow: () => rows.length,
    getMaxColumns: () => 100,
    getRange(r, c, n = 1, m = 1) {
      if (options.headerOnly) {
        assert.equal(r, 1, "preflight must not read student rows");
        assert.equal(n, 1, "preflight must read only the header row");
      }
      return {
        getRow: () => r,
        getSheet: () => sheet,
        getValues: () =>
          Array.from({ length: n }, (_, i) =>
            Array.from(
              { length: m },
              (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? "",
            ),
          ),
        getValue: () => rows[r - 1]?.[c - 1] ?? "",
        setValue(v) {
          assert.ok(!options.headerOnly, "preflight must not write Sheet cells");
          rows[r - 1] ??= [];
          rows[r - 1][c - 1] = v;
        },
      };
    },
  };
  const book = {
    getId: () => env.STUDY_HUB_GOOGLE_SPREADSHEET_ID,
    getSheets: () => [sheet],
    getFormUrl: () => "https://docs.google.com/forms/d/test/edit",
    getSpreadsheetTimeZone: () => "Asia/Muscat",
  };
  const context = vm.createContext({
    Date,
    console: { log() {} },
    SpreadsheetApp: {
      openById(id) {
        opened.push(id);
        assert.equal(id, env.STUDY_HUB_GOOGLE_SPREADSHEET_ID);
        return book;
      },
      getActiveSpreadsheet() {
        throw new Error("No bound container");
      },
      getUi() {
        throw new Error("No spreadsheet UI");
      },
      flush() {},
    },
    ScriptApp: {
      EventType: { ON_FORM_SUBMIT: "FORM_SUBMIT", CLOCK: "CLOCK" },
      getProjectTriggers: () => [...triggers],
      deleteTrigger(t) {
        triggers.splice(triggers.indexOf(t), 1);
      },
      newTrigger(handler) {
        let source = null,
          type = null,
          minutes = null;
        const builder = {
          forSpreadsheet(id) {
            source = id;
            return builder;
          },
          onFormSubmit() {
            type = "FORM_SUBMIT";
            return builder;
          },
          timeBased() {
            type = "CLOCK";
            return builder;
          },
          everyMinutes(n) {
            minutes = n;
            return builder;
          },
          create() {
            if (options.triggerFailure) throw new Error("Google private error");
            const created = trigger(handler, source, type, minutes);
            triggers.push(created);
            return created;
          },
        };
        return builder;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props.get(k) || null,
        setProperty(k, v) {
          props.set(k, v);
        },
        deleteProperty(k) {
          props.delete(k);
        },
      }),
    },
    FormApp: {
      openByUrl: () => ({
        // Match Google's Form API; there is no getAllowResponseEdits method.
        canEditResponse: () => options.editable || false,
      }),
    },
    LockService: {
      getDocumentLock() {
        throw new Error("No document lock");
      },
      getScriptLock: () => ({
        waitLock() {
          locks++;
        },
        releaseLock() {
          unlocks++;
        },
      }),
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      Charset: { UTF_8: "utf8" },
      newBlob: (s) => ({ getBytes: () => Buffer.from(s) }),
      computeHmacSha256Signature: (s, k) =>
        Array.from(crypto.createHmac("sha256", k).update(s).digest()).map(
          (b) => (b > 127 ? b - 256 : b),
        ),
      formatDate(d, z) {
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat("en", {
            timeZone: z,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
            hourCycle: "h23",
          })
            .formatToParts(d)
            .map((p) => [p.type, p.value]),
        );
        return [
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "second",
          "fractionalSecond",
        ]
          .map((k) => parts[k])
          .join(",");
      },
    },
    UrlFetchApp: {
      fetch(url, opts) {
        assert.equal(opts.followRedirects, false);
        const body = JSON.parse(opts.payload);
        const data = authenticate(
          { headers: { "content-type": "application/json" }, body },
          configuration(env),
        );
        requests.push({ url, opts, data });
        if (options.networkFailure) throw new Error("PRIVATE GOOGLE BODY");
        const response = options.reply?.(data) || {
          status: 200,
          data:
            data.kind === "check"
              ? { result: "ready", enabled: true }
              : { result: "imported", external_response_id: data.values[0] },
        };
        return {
          getResponseCode: () => response.status,
          getContentText: () => JSON.stringify(response.data),
        };
      },
    },
  });
  vm.runInContext(
    fs.readFileSync("scripts/study-hub-response-ids.gs", "utf8"),
    context,
  );
  const run = (code) => vm.runInContext(code, context);
  return {
    rows,
    props,
    requests,
    run,
    context,
    sheet,
    triggers,
    opened,
    balance: () => locks - unlocks,
  };
}
test("script and server header aliases stay in sync; setup verifies actual edit setting without changing it", () => {
  const h = harness();
  assert.deepEqual(
    JSON.parse(h.run("JSON.stringify(STUDY_HUB_HEADERS)")),
    HEADERS,
  );
  h.run("setupStudyHubIntake()");
  assert.ok(h.props.get("STUDY_HUB_SETUP_VERIFIED"));
  assert.equal(h.requests.length, 0);
  const editable = harness({ editable: true });
  assert.throws(
    () => editable.run("setupStudyHubIntake()"),
    /editable_responses_require_review/,
  );
  assert.equal(editable.props.get("STUDY_HUB_SETUP_VERIFIED"), undefined);
  assert.equal(editable.requests.length, 0);
});

test("standalone setup opens configured spreadsheet and installs exactly one submit and retry trigger", () => {
  const h = harness();
  h.run("setupStudyHubIntake(); setupStudyHubIntake()");
  assert.ok(h.opened.length >= 2);
  assert.equal(h.triggers.length, 2);
  const submit = h.triggers.find((t) => t.handler === "onStudyHubFormSubmit");
  assert.equal(submit.source, env.STUDY_HUB_GOOGLE_SPREADSHEET_ID);
  assert.equal(submit.type, "FORM_SUBMIT");
  assert.equal(h.triggers.find((t) => t.type === "CLOCK").minutes, 5);
  assert.equal(h.run("typeof onOpen"), "undefined");
  assert.equal(h.balance(), 0);
});

test("setup removes owned duplicate/stale triggers and preserves unrelated triggers", () => {
  const id = env.STUDY_HUB_GOOGLE_SPREADSHEET_ID;
  const unrelated = trigger("unrelatedHandler", id, "FORM_SUBMIT");
  const h = harness({
    triggers: [
      unrelated,
      trigger("onStudyHubFormSubmit", "old_spreadsheet", "FORM_SUBMIT"),
      trigger("onStudyHubFormSubmit", id, "FORM_SUBMIT"),
      trigger("onStudyHubFormSubmit", id, "FORM_SUBMIT"),
      trigger("stampStudyHubId", id, "FORM_SUBMIT"),
      trigger("retryStudyHubAutomatically", null, "CLOCK", 5),
      trigger("retryStudyHubAutomatically", null, "CLOCK", 5),
    ],
  });
  h.run("setupStudyHubIntake()");
  assert.equal(h.triggers.length, 3);
  assert.ok(h.triggers.includes(unrelated));
  assert.equal(
    h.triggers.filter((t) => t.handler === "onStudyHubFormSubmit").length,
    1,
  );
  assert.equal(h.balance(), 0);
});

test("failed trigger installation or missing configured tab leaves setup blocked", () => {
  const h = harness({ triggerFailure: true });
  assert.throws(
    () => h.run("setupStudyHubIntake()"),
    /script_execution_failed/,
  );
  assert.equal(h.props.get("STUDY_HUB_SETUP_VERIFIED"), undefined);
  assert.throws(() => h.run("backfillStudyHubResponses()"), /run_setup_first/);
  assert.equal(h.requests.length, 0);
  assert.equal(h.balance(), 0);
  const wrongTab = harness();
  wrongTab.props.set("STUDY_HUB_GOOGLE_SHEET_ID", "999");
  assert.throws(
    () => wrongTab.run("setupStudyHubIntake()"),
    /response_tab_missing/,
  );
  assert.equal(wrongTab.triggers.length, 0);
});

test("standalone submit ignores events from another spreadsheet or tab", () => {
  const h = harness();
  h.run("setupStudyHubIntake()");
  for (const [bookId, tabId, result] of [
    ["other_spreadsheet", 12, "ignored_spreadsheet"],
    [env.STUDY_HUB_GOOGLE_SPREADSHEET_ID, 13, "ignored_tab"],
  ]) {
    h.context.event = {
      range: {
        getSheet: () => ({
          getSheetId: () => tabId,
          getParent: () => ({ getId: () => bookId }),
        }),
      },
    };
    assert.equal(h.run("onStudyHubFormSubmit(event)").result, result);
  }
  assert.equal(h.requests.length, 0);
});
test("signed preflight sends headers only; delivery discards SQU IDs/emails and preserves UUIDs", () => {
  const h = harness();
  h.run("setupStudyHubIntake(); testStudyHubConnection()");
  assert.equal(h.requests[0].data.kind, "check");
  assert.equal(h.requests[0].data.values, undefined);
  h.run("backfillStudyHubResponses()");
  const delivered = h.requests[1];
  assert.ok(!JSON.stringify(delivered.data).includes("PRIVATE-ID"));
  assert.ok(!JSON.stringify(delivered.data).includes("PRIVATE-EMAIL"));
  const id = h.rows[1][0];
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(delivered.data.values[1], 46000);
  assert.equal(h.rows[1].at(-1), "delivered");
  h.run("repairStudyHubIds(); retryPendingStudyHub()");
  assert.equal(h.rows[1][0], id);
  assert.equal(h.requests.length, 2);
  assert.equal(h.balance(), 0);
});

test("preflight works before setup without student reads, Sheet writes, triggers or setup approval", () => {
  const h = harness({
    headerOnly: true,
    reply: () => ({ status: 200, data: { result: "ready", enabled: false } }),
  });
  h.rows.forEach((row) => row.shift()); // Fresh response Sheet has no ID column.
  const before = JSON.stringify(h.rows);
  assert.equal(h.run("testStudyHubConnection()").enabled, false);
  assert.equal(JSON.stringify(h.rows), before);
  assert.equal(h.triggers.length, 0);
  assert.equal(h.props.has("STUDY_HUB_SETUP_VERIFIED"), false);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].data.kind, "check");
  assert.equal(h.requests[0].data.values, undefined);
  assert.ok(h.requests[0].data.headers.includes("NexCore Submission ID"));
  assert.ok(!JSON.stringify(h.requests[0]).includes("PRIVATE"));
  assert.throws(() => h.run("backfillStudyHubResponses()"), /run_setup_first/);
  assert.equal(h.requests.length, 1);
});

test("preflight still rejects missing or ambiguous Form headers before a network request", () => {
  for (const duplicate of [false, true]) {
    const h = harness({ headerOnly: true });
    h.rows[0][1] = duplicate ? h.rows[0][0] : "Renamed Timestamp";
    assert.throws(() => h.run("testStudyHubConnection()"), /missing_columns|ambiguous_columns/);
    assert.equal(h.requests.length, 0);
    assert.equal(h.triggers.length, 0);
  }
});
test("installable submit sends immediately; failed network delivery retries using same permanent ID", () => {
  const options = { networkFailure: true };
  const h = harness(options);
  h.run("setupStudyHubIntake()");
  h.context.event = { range: h.sheet.getRange(2, 1) };
  h.run("onStudyHubFormSubmit(event)");
  const id = h.rows[1][0];
  assert.equal(h.rows[1].at(-1), "retry: network_failure");
  options.networkFailure = false;
  h.run("retryStudyHubAutomatically()");
  assert.equal(h.rows[1][0], id);
  assert.equal(h.requests[1].data.values[0], id);
  assert.equal(h.rows[1].at(-1), "delivered");
});
test("server failures are visible; permanent failures need manual retry; success requires matching acknowledgment", () => {
  for (const status of [401, 403, 409, 422, 429, 500, 200]) {
    const options = {
      reply: () => ({
        status,
        data: {
          error:
            status === 409 ? "source_conflict" : "PRIVATE PROVIDER DETAILS",
        },
      }),
    };
    const h = harness(options);
    h.run("setupStudyHubIntake(); backfillStudyHubResponses()");
    assert.match(h.rows[1].at(-1), /^(error|retry):/);
    assert.ok(!h.rows[1].at(-1).includes("PRIVATE"));
    const first = h.requests.length;
    h.run("retryStudyHubAutomatically()");
    assert.equal(
      h.requests.length,
      first + ([429, 500, 200].includes(status) ? 1 : 0),
    );
    options.reply = undefined;
    h.run("retryPendingStudyHub()");
    assert.equal(h.rows[1].at(-1), "delivered");
  }
});
test("invalid row does not stop later rows; duplicate UUID blocks delivery and lock is released", () => {
  const h = harness();
  h.rows.push([...h.rows[1]]);
  h.rows[1][1] = "invalid date";
  h.run("setupStudyHubIntake(); backfillStudyHubResponses()");
  assert.equal(h.rows[1].at(-1), "error: invalid_timestamp");
  assert.equal(h.rows[2].at(-1), "delivered");
  h.rows[1][0] = h.rows[2][0];
  assert.throws(() => h.run("repairStudyHubIds()"), /duplicate_response_id/);
  assert.equal(h.balance(), 0);
});
test("bounded retry batches advance past persistent failures", () => {
  const h = harness({ networkFailure: true });
  for (let i = 0; i < 30; i++) h.rows.push([...h.rows[1]]);
  h.run("setupStudyHubIntake(); repairStudyHubIds()");
  const statusColumn = h.rows[0].indexOf("NexCore Delivery Status");
  h.rows.slice(1).forEach((row) => { row[statusColumn] = "retry: network_failure"; });
  h.run("retryStudyHubAutomatically()");
  assert.equal(h.requests.length, 25);
  h.run("retryStudyHubAutomatically()");
  assert.ok(h.requests.slice(25).some((r) => r.data.row_number === 32));
});

test("automatic and manual retry leave historical and unknown-status rows untouched", () => {
  const h = harness();
  h.run("setupStudyHubIntake()");
  const statusColumn = h.rows[0].indexOf("NexCore Delivery Status");
  for (const status of ["", "operator hold", "delivered"]) {
    h.rows[1][statusColumn] = status;
    const before = JSON.stringify(h.rows);
    h.run("retryStudyHubAutomatically(); retryPendingStudyHub()");
    assert.equal(JSON.stringify(h.rows), before);
    assert.equal(h.requests.length, 0);
  }
});

test("new form submission delivers without importing older blank-status rows", () => {
  const h = harness();
  h.rows.push([...h.rows[1]]);
  h.run("setupStudyHubIntake()");
  const previous = JSON.stringify(h.rows[1]);
  h.context.event = { range: h.sheet.getRange(3, 1) };
  h.run("onStudyHubFormSubmit(event); retryStudyHubAutomatically()");
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].data.row_number, 3);
  assert.equal(JSON.stringify(h.rows[1]), previous);
  assert.equal(h.rows[2].at(-1), "delivered");
});

test("backfill requires explicit subsequent batches; timer cannot continue unsent history", () => {
  const h = harness();
  for (let i = 0; i < 30; i++) h.rows.push([...h.rows[1]]);
  h.run("setupStudyHubIntake()");
  assert.equal(h.run("backfillStudyHubResponses()").remaining, 6);
  assert.equal(h.requests.length, 25);
  h.run("retryStudyHubAutomatically(); retryPendingStudyHub()");
  assert.equal(h.requests.length, 25);
  assert.equal(h.run("backfillStudyHubResponses()").remaining, 0);
  assert.equal(h.requests.length, 31);
  assert.equal(new Set(h.requests.map((r) => r.data.values[0])).size, 31);
});
test("missing or ambiguous headers fail setup; no unknown student data reaches endpoint", () => {
  for (const duplicate of [false, true]) {
    const h = harness();
    h.rows[0][1] = duplicate ? h.rows[0][0] : "Renamed Timestamp";
    assert.throws(
      () => h.run("setupStudyHubIntake()"),
      /missing_columns|ambiguous_columns/,
    );
    assert.equal(h.requests.length, 0);
  }
});

test("optional Vercel bypass is header-only, host-bound, and independent of signed HMAC", () => {
  const h = harness({
    reply: () => ({ status: 200, data: { result: "ready", enabled: false } }),
  });
  const bypass = crypto.randomBytes(32).toString("hex");
  h.props.set("STUDY_HUB_VERCEL_BYPASS_SECRET", bypass);
  h.props.set("STUDY_HUB_VERCEL_BYPASS_HOST", "example.invalid");
  h.run("setupStudyHubIntake()");
  assert.equal(h.run("testStudyHubConnection()").enabled, false);
  const req = h.requests[0]; // Harness verifies the original HMAC on every request.
  assert.equal(req.opts.headers["x-vercel-protection-bypass"], bypass);
  assert.equal(req.opts.followRedirects, false);
  assert.deepEqual(Object.keys(req.opts.headers), ["x-vercel-protection-bypass"]);
  assert.equal(req.data.kind, "check");
  assert.equal(req.data.values, undefined);
  assert.ok(!req.url.includes(bypass));
  assert.ok(!req.opts.payload.includes(bypass));
  assert.ok(!h.props.get("STUDY_HUB_LAST_RESULT").includes(bypass));
  assert.equal(h.requests.length, 1);
});

test("without optional bypass properties, requests retain the HMAC-only behavior", () => {
  const h = harness();
  h.run("setupStudyHubIntake(); testStudyHubConnection()");
  assert.equal(Object.keys(h.requests[0].opts.headers).length, 0);
});

test("unsafe or misdirected bypass configuration fails before reading the Sheet or sending", () => {
  const bypass = crypto.randomBytes(32).toString("hex");
  for (const [secret, host] of [
    [bypass, "other.invalid"],
    [bypass, ""],
    ["", "example.invalid"],
    [env.STUDY_HUB_INGEST_SECRET, "example.invalid"],
    [env.STUDY_HUB_INGEST_SECRET.toUpperCase(), "example.invalid"],
    [bypass + "\r\nX-Other: value", "example.invalid"],
    [bypass, "example.invalid?token=secret"],
  ]) {
    const h = harness();
    h.props.set("STUDY_HUB_VERCEL_BYPASS_SECRET", secret);
    h.props.set("STUDY_HUB_VERCEL_BYPASS_HOST", host);
    assert.throws(() => h.run("testStudyHubConnection()"), /vercel_bypass_configuration_invalid/);
    assert.equal(h.requests.length, 0);
    assert.equal(h.opened.length, 0);
    assert.equal(h.props.get("STUDY_HUB_LAST_RESULT"), "vercel_bypass_configuration_invalid");
  }
});
