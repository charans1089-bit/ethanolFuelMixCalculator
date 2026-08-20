# WRX Flex Fuel Calculator

Static web app for WRX FA24 fuel blending.

## Stack
- HTML
- CSS
- Vanilla JavaScript
- LocalStorage (client-side logs)

## Run locally
Open `index.html` directly, or use any local static server.

## GitHub Pages deployment (public repo)
This project is already compatible with GitHub Pages because it is static.

### Option A (no workflow)
1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**.
3. Source: **Deploy from branch**.
4. Branch: `main` (or `master`), Folder: `/ (root)`.
5. Save.

### Option B (workflow included)
A Pages workflow is included at `.github/workflows/deploy-pages.yml`.

1. In **Settings → Pages**, set Source to **GitHub Actions**.
2. Push changes to `main`.
3. GitHub will deploy automatically.

## Public GitHub limitations to keep in mind
1. **No secrets in frontend code**
   - Anything in HTML/JS is public.
   - Do not place API keys, tokens, private URLs, or credentials in this repo.

2. **Client-side storage is per browser**
   - `localStorage` logs stay on each device/browser only.
   - Reinstall/clear browser data removes logs.

3. **CORS and API restrictions**
   - Browser calls to third-party services can fail due to CORS.
   - Your Google Form endpoint is visible publicly.

4. **No server runtime on Pages**
   - GitHub Pages serves static files only.
   - No Node/Express/Python backend execution.

5. **File size/bandwidth constraints**
   - Keep images optimized to improve load speed and avoid bloat.

## Recommended improvements for public hosting
- Move images into an `assets/images/` folder and compress them.
- Add analytics/privacy notice if sharing publicly.
- Add a custom domain + HTTPS (via GitHub Pages settings).
- Add basic accessibility improvements (alt text, focus states, contrast checks).
- Add lightweight CI checks (HTML/CSS lint + link check).

## Optional upgrades you can still host publicly
- **PWA support** (offline mode): add `manifest.webmanifest` + service worker.
- **Build tooling** (still static output): Vite for minification and cache-busting.
- **Type safety**: gradually migrate JS to TypeScript (compiled to static assets).
- **Backend-less data**:
  - GitHub Issues/Discussions as manual data sink,
  - Firebase/Supabase (public client SDK + security rules),
  - Cloudflare Workers/Netlify Functions if you need secret-backed APIs.

## Automated fuel prices with GitHub Actions (secure option for this repo)

This repo now includes [.github/workflows/update-fuel-prices.yml](.github/workflows/update-fuel-prices.yml) and [scripts/update-fuel-prices.mjs](scripts/update-fuel-prices.mjs).

How it works:
- A scheduled GitHub Action calls Apify server-side (not from browser JS).
- It writes a static snapshot to [data/fuel-prices.json](data/fuel-prices.json).
- The snapshot is committed to the repo only when price data changes.

Why this is secure enough for a personal static app:
- Your `APIFY_API_TOKEN` stays in GitHub Secrets.
- The token is never shipped in `index.html`/`app.js`.
- End users only see the generated JSON file, not credentials.

Setup steps:
1. In your GitHub repo, open **Settings → Secrets and variables → Actions → Secrets**.
2. Add secret: `APIFY_API_TOKEN`.
3. (Optional) In **Variables**, add:
    - `FUEL_SEARCH` (example: `Dearborn, MI` or `42.301,-83.214`)
    - `FUEL_MAX_AGE_DAYS` (example: `3`)
    - `FUEL_MAX_ITEMS` (example: `25`)
4. Run **Actions → Update fuel prices snapshot → Run workflow** once.
5. Confirm [data/fuel-prices.json](data/fuel-prices.json) gets updated with real stations.

Notes:
- This is not per-visitor live pricing. It is a scheduled snapshot.
- For a static site, this is the safest approach without adding a separate backend.

## Repo structure (current)
- `index.html`
- `styles.css`
- `app.js`
- image assets (`*.jpg`, `*.png`)

## License
Add a license if you want reuse rules (for example MIT).
