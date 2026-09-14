/*
 * Postgres storage for the ledger.
 *
 * The ledger is one JSON document, so the table is one row holding jsonb.
 * That keeps the server shape identical to the client shape and to the export
 * file — the same blob moves through all three without translation.
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const URL = process.env.DATABASE_URL || "";
const local = /localhost|127\.0\.0\.1/.test(URL);

/* With no DATABASE_URL — running the thing on your own machine — fall back to
   a JSON file so `npm start` works without standing up Postgres. Render always
   sets DATABASE_URL, so this path never runs in production. */
const DEV_FILE = path.join(__dirname, "..", ".ledger-dev.json");
const devMode = !URL;
function devRead() {
  try { return { doc: JSON.parse(fs.readFileSync(DEV_FILE, "utf8")), updatedAt: new Date().toISOString() }; }
  catch (e) { return { doc: { v: 1, days: {}, cp: {} }, updatedAt: null }; }
}
function devWrite(doc) {
  fs.writeFileSync(DEV_FILE, JSON.stringify(doc, null, 2), "utf8");
  return { doc, updatedAt: new Date().toISOString() };
}

const pool = new Pool({
  connectionString: URL,
  // Render's managed Postgres requires TLS from outside its network, and
  // presents a cert this client will not have a CA for.
  ssl: URL && !local ? { rejectUnauthorized: false } : false,
  max: 4,
  idleTimeoutMillis: 30000,
});

const ROW = "main";

async function init() {
  if (devMode) { console.log("ledger: no DATABASE_URL — using a local JSON file"); return; }
  await pool.query(`
    create table if not exists ledger (
      id         text primary key,
      doc        jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
}

async function read() {
  if (devMode) return devRead();
  const r = await pool.query("select doc, updated_at from ledger where id = $1", [ROW]);
  if (!r.rows.length) return { doc: { v: 1, days: {}, cp: {} }, updatedAt: null };
  return { doc: r.rows[0].doc, updatedAt: r.rows[0].updated_at };
}

/*
 * Newest write wins, resolved per day rather than per document.
 *
 * Two devices each PUT a whole blob. Without a merge the later request erases
 * whatever the earlier one added — log Tuesday on the phone and Wednesday on
 * the laptop and one of them disappears. Merging here rather than only on the
 * client means it holds even when a client is out of date.
 */
function merge(base, incoming) {
  const out = {
    v: 1,
    days: Object.assign({}, base && base.days),
    cp: Object.assign({}, base && base.cp),
  };
  const days = (incoming && incoming.days) || {};
  for (const k of Object.keys(days)) {
    const inc = days[k];
    const cur = out.days[k];
    if (!cur || Number(inc.t || 0) >= Number(cur.t || 0)) out.days[k] = inc;
  }
  const cp = (incoming && incoming.cp) || {};
  for (const k of Object.keys(cp)) if (cp[k]) out.cp[k] = cp[k];
  return out;
}

async function write(incoming) {
  const cur = await read();
  const merged = merge(cur.doc, incoming);
  if (devMode) return devWrite(merged);
  const r = await pool.query(
    `insert into ledger (id, doc, updated_at) values ($1, $2, now())
     on conflict (id) do update set doc = excluded.doc, updated_at = now()
     returning updated_at`,
    [ROW, merged]
  );
  return { doc: merged, updatedAt: r.rows[0].updated_at };
}

module.exports = { init, read, write, merge, pool };
