/*
 * Serves the built page and the ledger API.
 *
 * Access is a single shared key, which Render generates and you paste into the
 * app once per device. That is proportionate for a personal ledger: without it
 * anyone who guessed the URL could read and overwrite your training record.
 * The key never passes through source control — it lives only in Render's
 * environment and in your browser's local storage.
 */

const path = require("path");
const express = require("express");
const store = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const KEY = process.env.LEDGER_KEY || "";
const PUBLIC = path.join(__dirname, "..", "public");

app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));

let ready = false;
let bootError = null;

function auth(req, res, next) {
  if (!KEY) {
    return res.status(503).json({ error: "server_key_missing",
      message: "LEDGER_KEY is not set on the server." });
  }
  const h = req.get("authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (given !== KEY) {
    return res.status(401).json({ error: "bad_key",
      message: "That access key does not match this server." });
  }
  next();
}

// Unauthenticated on purpose: the page calls this to discover whether it is
// being served by a real backend or from a static host. It reveals nothing.
app.get("/api/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: ready, store: "postgres", needsKey: true, error: bootError });
});

app.get("/api/ledger", auth, async (req, res) => {
  try {
    const { doc, updatedAt } = await store.read();
    res.set("Cache-Control", "no-store");
    res.json({ doc, updatedAt });
  } catch (e) {
    res.status(500).json({ error: "read_failed", message: e.message });
  }
});

app.put("/api/ledger", auth, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || typeof body.days !== "object") {
    return res.status(400).json({ error: "bad_body",
      message: "Expected a ledger object with a days map." });
  }
  try {
    const { doc, updatedAt } = await store.write(body);
    res.set("Cache-Control", "no-store");
    res.json({ doc, updatedAt });
  } catch (e) {
    res.status(500).json({ error: "write_failed", message: e.message });
  }
});

app.use(express.static(PUBLIC, {
  setHeaders(res, p) {
    // The page is the app. Never let a cache serve a stale plan.
    if (p.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
  },
}));

// Single page: anything unmatched returns it.
app.use((req, res) => res.sendFile(path.join(PUBLIC, "index.html")));

store.init()
  .then(() => { ready = true; console.log("ledger: schema ready"); })
  .catch((e) => { bootError = e.message; console.error("ledger: schema init failed —", e.message); });

app.listen(PORT, () => {
  console.log(`ledger: listening on ${PORT}`);
  if (!KEY) console.warn("ledger: LEDGER_KEY is not set — the API will refuse every request");
  if (!process.env.DATABASE_URL) console.warn("ledger: DATABASE_URL is not set — storage will fail");
});
