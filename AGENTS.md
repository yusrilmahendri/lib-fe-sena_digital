# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single **Angular 13** frontend app — "Horuzt / Sena Digital" digital wedding
invitation site (Indonesian UI). There is no backend in this repo. Standard commands live in
`package.json` (`start`, `build`, `test`, `lint`) and `angular.json`.

### Node version (important)
- The app requires **Node 16** (Angular 13 / `@angular-devkit/build-angular` 13 is incompatible
  with the VM's default Node 22 — builds/serve fail under Node 17+ due to OpenSSL changes).
- Node 16 is installed via `nvm` and prepended to `PATH` in `~/.bashrc`, so new shells already use
  it. Verify with `node --version` (expect `v16.x`). If a shell somehow picks up `/exec-daemon/node`
  (v22), run `export PATH="$HOME/.nvm/versions/node/v16.20.2/bin:$PATH"`.

### Run / build / test
- Dev server: `npm start` (i.e. `ng serve`). Add `--host 0.0.0.0 --port 4200` when it must be
  reachable outside the VM. Serves at `http://localhost:4200/`.
- Build: `npm run build` (production; emits a non-fatal budget warning, exit 0).
- Lint: `npm run lint`. NOTE: the repo currently has ~20 pre-existing lint errors
  (mostly `@angular-eslint/no-empty-lifecycle-method`); the lint command itself works.
- Unit tests: `npm test -- --watch=false --browsers=ChromeHeadless`. Chrome is at
  `/usr/bin/google-chrome-stable`; in this sandbox it needs `--no-sandbox`, so point
  `CHROME_BIN` at a wrapper, e.g.:
  `printf '#!/bin/bash\nexec /usr/bin/google-chrome-stable --no-sandbox --disable-gpu --disable-dev-shm-usage "$@"\n' > /tmp/chrome.sh && chmod +x /tmp/chrome.sh && CHROME_BIN=/tmp/chrome.sh`.
  The Karma runner/Chrome launch correctly, but the suite currently fails to compile because of a
  pre-existing broken spec (`src/app/dashboard/website/website.component.spec.ts` imports
  `WebsiteComponent`, which does not exist — the file exports `WebsiteUserComponent`).

### Backend / API
- In dev, `src/environments/environment.ts` points `apiBaseUrl` at `http://127.0.0.1:8000/api`,
  which is NOT part of this repo and is not running. So login/register/dashboard data calls fail
  locally. The public landing page and the client-side "Buat Undangan" wizard (step 1 → step 2)
  work without a backend; theme images load from local assets while package/price data shows a
  "Memuat data paket…" loading state.
- `proxy.conf.json` proxies `/api` to a remote host, but the app uses the absolute `apiBaseUrl`
  above, so the proxy is not actually exercised in dev.
