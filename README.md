# 26_10_27

A 59-week operating console for the run from data analyst to a professional
football contract by **26 October 2027**.

Programme start 13 September 2026. The day is planned hour by hour from 08:00 to
22:00 around a 10:00–19:00 job, on a matchday-relative microcycle with Saturday
as the match. Alongside it: physical benchmarks against professional entry
standards, the medical critical path, and what the programme costs to self-fund.

## Layout

```
src/app.html        Single source of truth — the whole app, one file
build.js            Wraps src/app.html into a standalone public/index.html
public/index.html   Generated. Committed, so the site deploys without a build
render.yaml         Render static site blueprint
```

`src/app.html` is authored as bare page content — no `<!doctype>`, no `<html>`,
no `<head>`. Two different publishers add that skeleton:

- **Claude Artifact** supplies it at publish time.
- **`build.js`** supplies the equivalent for the static build, including the
  `viewport` meta. Without that meta the page renders desktop-width on a phone.

Keeping one source and generating both targets is why there is a build step at
all. `build.js` fails loudly if a skeleton ever creeps into `src/app.html`.

## Develop

```bash
node build.js          # regenerate public/index.html
npm start              # build, then serve on http://localhost:4173
```

Edit `src/app.html` only. Never edit `public/index.html` — it is overwritten.

## Deploy

Pushing to the connected branch triggers a Render build (`node build.js`) and
publishes `public/`.

## Where the data lives

The app stores your ticks, daily readouts, benchmarks, medical checklist and
funding figures **in the browser** via `localStorage`.

**On the Render deployment this means data is per-device.** What you log on your
phone stays on your phone; what you log on the laptop stays on the laptop. There
is no server and no database, so there is nothing to sync them.

The same file published as a Claude Artifact detects `window.claude.use("db")`
and stores to a shared document store instead, which does sync across devices.
The app reports which mode it is in at the bottom of the page: *"Saving to this
device"* or *"Synced · laptop and phone"*.

To get cross-device sync on Render, the app needs a backend — an Express service
and a Postgres instance — replacing the `localStorage` fallback in the `Store`
section of `src/app.html`.
