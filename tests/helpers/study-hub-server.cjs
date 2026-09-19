// Local integration harness. Auth is simulated; API authorization and PostgreSQL are real.
// Never deploy this file or run its fixtures against a shared/production database.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { createHandler } = require("../../api/admin/study-hub");
const labs = path.resolve(__dirname, "../..");
const hub =
  process.env.STUDY_HUB_ROOT || path.resolve(labs, "../nexcore-study-hub");
const container = "nexcore-study-hub-test";
const quote = (v) =>
  v == null ? "null" : "'" + String(v).replaceAll("'", "''") + "'";
const actors = {
  admin: {
    id: "20000000-0000-0000-0000-000000000001",
    email: "browser-admin@example.invalid",
  },
  editor: {
    id: "20000000-0000-0000-0000-000000000002",
    email: "browser-editor@example.invalid",
  },
  member: {
    id: "20000000-0000-0000-0000-000000000003",
    email: "browser-member@example.invalid",
  },
};
function sql(query, role = "service_role") {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-Atq",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
      ],
      { encoding: "utf8", maxBuffer: 8000000 },
      (error, stdout, stderr) => {
        if (error) {
          const m = stderr.match(/ERROR:\s+([A-Z0-9]{5}):\s+([^\n]+)/);
          return reject({
            code: m?.[1] || "unknown",
            message: m?.[2] || stderr,
          });
        }
        try {
          resolve(stdout.trim() ? JSON.parse(stdout) : null);
        } catch {
          reject(new Error(stdout));
        }
      },
    );
    child.stdin.end((role ? "set role " + role + ";\n" : "") + query);
  });
}
const tables = new Set([
  "admins",
  "study_hub_editors",
  "study_hub_settings",
  "study_hub_colleges",
  "study_hub_courses",
  "study_hub_resources",
  "study_hub_resource_revisions",
  "study_hub_submissions",
]);
function database(role = "service_role") {
  return {
    from(table) {
      if (!tables.has(table)) throw new Error("Test table not allowed");
      const filters = [];
      let order = table === "study_hub_editors" ? "user_id" : "id",
        desc = false,
        limit = 1000,
        offset = 0,
        single = false;
      const chain = {
        select() {
          return chain;
        },
        eq(key, value) {
          if (!/^[a-z_]+$/.test(key)) throw new Error("column");
          filters.push(key + "=" + quote(value));
          return chain;
        },
        order(key, options) {
          order = key;
          desc = options?.ascending === false;
          return chain;
        },
        range(start, end) {
          offset = start;
          limit = end - start + 1;
          return chain;
        },
        single() {
          single = true;
          return chain;
        },
        maybeSingle() {
          single = true;
          return chain;
        },
        async then(resolve, reject) {
          try {
            const data = await sql(
              `select coalesce(json_agg(row_to_json(t)),'[]') from (select * from public.${table}${filters.length ? " where " + filters.join(" and ") : ""} order by ${order} ${desc ? "desc" : "asc"} limit ${limit} offset ${offset}) t;`,
              role,
            );
            return resolve({
              data: single ? data[0] || null : data,
              count: data.length,
            });
          } catch (error) {
            return resolve({ error });
          }
        },
      };
      return chain;
    },
    async rpc(name, a) {
      try {
        if (name === "study_hub_ingest_submission")
          return {
            data: await sql(
              `select public.study_hub_ingest_submission(${quote(a.p_source)},${a.p_sheet},${a.p_row},${quote(JSON.stringify(a.p_data))}::jsonb);`,
            ),
          };
        if (name === "study_hub_review_submission")
          return {
            data: await sql(
              `select public.study_hub_review_submission(${quote(a.p_actor)}::uuid,${quote(a.p_actor_email)},${quote(a.p_action)},${quote(a.p_id)}::uuid,${a.p_version},${quote(JSON.stringify(a.p_payload))}::jsonb);`,
            ),
          };
        if (name === "study_hub_import_submission")
          return {
            data: await sql(
              `select public.study_hub_import_submission(${quote(a.p_actor)}::uuid,${quote(a.p_actor_email)},${quote(a.p_source)},${a.p_sheet},${a.p_row},${quote(JSON.stringify(a.p_data))}::jsonb);`,
            ),
          };
        if (name !== "study_hub_mutate") throw new Error("rpc");
        const data = await sql(
          `select public.study_hub_mutate(${quote(a.p_actor)}::uuid,${quote(a.p_action)},${quote(a.p_id)}::uuid,${a.p_version || "null"},${quote(JSON.stringify(a.p_payload))}::jsonb,${quote(a.p_actor_email)});`,
        );
        return { data };
      } catch (error) {
        return { error };
      }
    },
    auth: {
      admin: {
        async listUsers() {
          return { data: { users: Object.values(actors) } };
        },
        async getUserById(id) {
          return {
            data: { user: Object.values(actors).find((u) => u.id === id) },
          };
        },
      },
    },
  };
}
const handler = createHandler({
  createAuthClient: () => ({
    auth: {
      getUser: async (token) =>
        actors[token] ? { data: { user: actors[token] } } : { error: {} },
    },
  }),
  getAdminClient: () => database(),
});
const { env: intakeEnv } = require("./study-hub-ingestion-fixture.cjs");
const ingestHandler =
  require("../../api/integrations/study-hub-ingest").createHandler({
    env: intakeEnv,
    getAdminClient: () => database(),
  });
async function seed() {
  await sql(
    Object.values(actors)
      .map(
        (u) =>
          `insert into auth.users(id,email) values (${quote(u.id)},${quote(u.email)}) on conflict(id) do nothing;`,
      )
      .join("\n") +
      `insert into public.admins(email) values (${quote(actors.admin.email)}) on conflict(email) do nothing;`,
    null,
  );
  await sql(
    `select public.study_hub_mutate(${quote(actors.admin.id)},'grant_editor',${quote(actors.editor.id)},null,'{}',${quote(actors.admin.email)});`,
  );
}
function serve(root, port) {
  return http
    .createServer(async (req, res) => {
      const u = new URL(req.url, "http://127.0.0.1:" + port);
      res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:4190");
      res.setHeader("Access-Control-Allow-Headers", "apikey,content-type");
      if (req.method === "OPTIONS") {
        res.end();
        return;
      }
      if (
        ["/api/admin/study-hub", "/api/integrations/study-hub-ingest"].includes(
          u.pathname,
        )
      ) {
        let body = "";
        for await (const part of req) body += part;
        req.body = body ? JSON.parse(body) : {};
        req.query = Object.fromEntries(u.searchParams);
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (value) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(value));
          return res;
        };
        return (u.pathname.endsWith("-ingest") ? ingestHandler : handler)(
          req,
          res,
        );
      }
      if (u.pathname.startsWith("/rest/v1/")) {
        try {
          const table = u.pathname.split("/").pop();
          if (!tables.has(table) || !table.startsWith("study_hub_"))
            throw new Error("table");
          const clauses = [];
          if (u.searchParams.has("status"))
            clauses.push(
              "status=" + quote(u.searchParams.get("status").slice(3)),
            );
          if (u.searchParams.has("id"))
            clauses.push("id>" + quote(u.searchParams.get("id").slice(3)));
          const data = await sql(
            `select coalesce(json_agg(row_to_json(t)),'[]') from (select * from public.${table}${clauses.length ? " where " + clauses.join(" and ") : ""} order by id limit 200) t;`,
            "anon",
          );
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: e.message }));
        }
        return;
      }
      let requested = decodeURIComponent(u.pathname);
      if (requested.endsWith("/")) requested += "index.html";
      const file = path.resolve(root, "." + requested);
      if (
        !file.startsWith(root + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      ) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const mime =
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json",
          ".png": "image/png",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
        }[path.extname(file)] || "application/octet-stream";
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "no-store");
      let data = fs.readFileSync(file);
      if (root === hub && requested === "/assets/js/config.js")
        data = Buffer.from(
          data
            .toString()
            .replace(
              /supabaseUrl: "[^"]+"/,
              'supabaseUrl: "http://127.0.0.1:4189"',
            ),
        );
      res.end(data);
    })
    .listen(port, "127.0.0.1");
}
seed()
  .then(() => {
    serve(labs, 4189);
    serve(hub, 4190);
    console.log("Study Hub test servers: http://127.0.0.1:4189 and :4190");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
