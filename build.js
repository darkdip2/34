/*
 * Wraps src/app.html into a standalone document at public/index.html.
 *
 * src/app.html is the single source of truth. It is authored as bare page
 * content — no doctype, no <html>, no <head> — because the Claude Artifact
 * publisher supplies that skeleton itself. Render serves raw files, so the
 * static build has to supply the equivalent skeleton: charset, viewport
 * (without it the page renders desktop-width on a phone), and the small
 * reset the artifact runtime would otherwise provide.
 *
 * Run: node build.js
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src", "app.html");
const OUT_DIR = path.join(__dirname, "public");
const OUT = path.join(OUT_DIR, "index.html");

const body = fs.readFileSync(SRC, "utf8");

// The source must stay skeleton-free or the artifact publish produces
// nested <html> elements. Fail loudly rather than shipping a broken file.
const forbidden = /<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i;
if (forbidden.test(body)) {
  console.error(
    "build: src/app.html contains a document skeleton (<!doctype>, <html>, " +
      "<head> or <body>). It must contain page content only — build.js adds " +
      "the skeleton for the static build, and the Artifact publisher adds its " +
      "own. Remove the tags from src/app.html."
  );
  process.exit(1);
}

// Pull the <title> so the standalone document carries the same name.
const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/i);
const title = titleMatch ? titleMatch[1].trim() : "Matchday 2027";

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="A 59-week operating console for the run from data analyst to a professional football contract by 26 October 2027.">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F4F5F2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1519" media="(prefers-color-scheme: dark)">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${title}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%BD%3C/text%3E%3C/svg%3E">
<style>
/* Baseline the Artifact runtime supplies; the static build must match it. */
html{-webkit-text-size-adjust:100%}
body{margin:0}
img{max-width:100%}
[hidden]{display:none!important}
</style>
</head>
<body>
${body}
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, doc, "utf8");

const kb = (Buffer.byteLength(doc, "utf8") / 1024).toFixed(1);
console.log(`build: public/index.html written (${kb} KB) — title "${title}"`);
