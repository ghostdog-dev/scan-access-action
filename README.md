# scan-access GitHub Action

[![marketplace](https://img.shields.io/badge/marketplace-scan--access-green)](https://github.com/marketplace/actions/scan-access)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

WCAG accessibility audit, powered by [scan-access.com](https://scan-access.com) — axe-core engine, lawsuit-risk scoring, AI-generated fixes.

## What it does

The action renders your app **inside your own CI runner** using Playwright, then audits it with the same axe-core pipeline as the scan-access dashboard.

Step by step:

1. **Your workflow** builds your app and serves it on a local port (e.g. `http://localhost:4173`).
2. **This action** launches a headless Chromium browser inside the runner, navigates each declared route, waits for full JS and CSS rendering (`networkidle`), inlines the applied CSS (CSSOM → `<style>`) into a self-contained HTML document per route, and serializes the full rendered DOM.
3. All routes are sent in a single `POST /api/v1/scans/code` request to scan-access, which re-runs the axe-core pipeline and produces a score, violation list, SARIF, and optional PDF.
4. The action publishes a **rich PR comment**, a **step summary**, and per-issue **annotations**.

> We never host or deploy your app — rendering happens only inside your own CI runner.

## Quickstart

```yaml
name: Accessibility audit
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write   # required for the PR comment
  security-events: write # required only if you upload SARIF to Code Scanning

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      - run: npm ci

      - run: npm run build

      # Serve the production build in the background
      - run: npx serve -l 4173 ./dist &

      # Cache the Chromium binary across runs (key must match the exact version below)
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-chromium-1.60.0

      # Install the Chromium binary used by the bundled playwright-core.
      # The version (1.60.0) MUST match the playwright-core dependency of this
      # action exactly — a mismatch causes "Executable doesn't exist" at launch.
      # --with-deps installs the required system libraries on Ubuntu.
      - name: Install Chromium for Playwright
        run: npx playwright@1.60.0 install --with-deps chromium

      - uses: ghostdog-dev/scan-access-action@v2
        id: a11y
        with:
          api-key: ${{ secrets.SCAN_ACCESS_API_KEY }}
          app-url: http://localhost:4173
          routes: |
            /
            /pricing
            /about
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Optional — forward SARIF to GitHub Code Scanning
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: ${{ steps.a11y.outputs.sarif-file }}
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `api-key` | yes | — | scan-access API key (`sa_live_...` / `sa_test_...`). Store as a secret. |
| `app-url` | yes | — | Base URL of the app served in the runner (e.g. `http://localhost:4173`). Must be `http` or `https`. |
| `routes` | yes | — | Newline-separated list of routes to render, relative to `app-url` (e.g. `/`, `/pricing`). Duplicates are ignored. |
| `region` | no | `us_ada` | Compliance region: `us_ada` (ADA / Section 508) or `eu_eaa` (European Accessibility Act). |
| `legislations` | no | `wcag22aa` | Comma-separated legal references or `all`. Codes: `wcag22aa`, `rgaa412`, `en301549`, `section508`, `eaa`, `ada`, `en301549_v411`, `rgaa5_preview`, `bitv2`, `stanca`, `wcag3_draft`. |
| `ai-fix` | no | `N` | Generate AI fix instructions for findings (`Y`/`N`/`true`/`false`). |
| `fail-on` | no | `critical` | Severity threshold to fail the job: `never`, `minor`, `moderate`, `serious`, `critical`, `any`. |
| `output-sarif` | no | `scan-access.sarif` | Local path where the SARIF document is written. |
| `api-base-url` | no | `https://api.scan-access.com` | Override the API base URL (self-hosted or staging). |

## Outputs

| Name | Description |
| --- | --- |
| `scan-id` | UUID of the scan created by the action. |
| `score` | Overall accessibility score (0–100), empty if the scan did not score. |
| `total-violations` | Sum of violations across all severities. |
| `critical-count` | Count of `critical` issues. |
| `serious-count` | Count of `serious` issues. |
| `moderate-count` | Count of `moderate` issues. |
| `minor-count` | Count of `minor` issues. |
| `pdf-url` | Signed URL to the compliance PDF (empty if not generated). |
| `scan-url` | Public dashboard URL of the scan. |
| `sarif-file` | Local path to the SARIF artifact (forward to `upload-sarif`). |

## Required permissions

```yaml
permissions:
  contents: read
  pull-requests: write   # required to upsert the PR comment
  security-events: write # required only if you upload SARIF to Code Scanning
```

The `GITHUB_TOKEN` must be passed via the `env:` block of the step for the PR comment to work.

## How rendering works (and its limits)

### Playwright version pin

The action ships `playwright-core@1.60.0` exactly (vendored as a dependency, not inlined into `dist/`, since Playwright resolves its own data files from disk at runtime). Your workflow **must** install the matching Chromium binary with the same version before calling this action:

```yaml
- run: npx playwright@1.60.0 install --with-deps chromium
```

A version mismatch (e.g. running `npx playwright install` without the version pin) causes a startup error: `Executable doesn't exist`. The `--with-deps` flag installs the required system libraries on Ubuntu runners.

Cache the binary to avoid re-downloading on every run:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-chromium-1.60.0
```

Do **not** set `PLAYWRIGHT_BROWSERS_PATH` — the action resolves Chromium via the default cache path (`~/.cache/ms-playwright`), which is the same location used by the `npx playwright install` step.

### CSS inlining

The action reads the applied CSS from `document.styleSheets` (via the CSSOM) inside the live Chromium page, aggregates all `cssText` from author stylesheets into a single `<style data-scan-access-inlined>` injected at the end of `<head>`, and removes all `<link rel="stylesheet">` and `<script>` tags before serializing the document. This self-contained HTML is what gets sent to the backend, which re-applies the same axe-core pipeline used by the dashboard.

### Limits

| Constraint | Value |
| --- | --- |
| Max routes per scan | 30 |
| Max HTML size per route | 5 MB |
| Max total payload | 30 MB |
| Render timeout per route | `networkidle` (60 s default) |

**Build recommendation:** run a production build (with CSS purging / tree-shaking) before serving. A dev-mode build with unpurged CSS can produce large per-route payloads that approach the per-file cap.

**Shadow DOM:** the action serializes the document via `outerHTML`. Shadow DOM internals are not included in that serialization — axe-core will not see elements inside closed or open shadow roots. Best-effort: styles from `adoptedStyleSheets` on shadow roots are collected, but the DOM content of shadows is not audited.

**Cross-origin CSS (Google Fonts, Tailwind CDN, etc.):** browser security (`SecurityError`) prevents reading `cssRules` from cross-origin stylesheets. When a cross-origin sheet is detected, the action falls back to injecting computed `color`, `background-color`, `font-size`, and `font-weight` values as inline styles for every element — enough for axe-core contrast checks, but at the cost of a larger payload. **Self-hosting fonts and critical CSS is strongly recommended** to avoid this fallback and keep payload sizes predictable.

**External assets (`@font-face`, background images):** the backend aborts external subresource requests (anti-SSRF). These assets are not loaded, which has no impact on contrast or structural accessibility checks.

## Examples

### All legislations + AI fix

```yaml
on:
  pull_request:
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci && npm run build
      - run: npx serve -l 4173 ./dist &
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-chromium-1.60.0
      - run: npx playwright@1.60.0 install --with-deps chromium
      - uses: ghostdog-dev/scan-access-action@v2
        with:
          api-key: ${{ secrets.SCAN_ACCESS_API_KEY }}
          app-url: http://localhost:4173
          routes: |
            /
            /pricing
          legislations: all
          ai-fix: "Y"
          fail-on: serious
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Skip SARIF upload (PR comment + annotations only)

Omit the `upload-sarif` step. The action still writes the SARIF file locally — you can attach it as a workflow artifact instead.

```yaml
- uses: ghostdog-dev/scan-access-action@v2
  with:
    api-key: ${{ secrets.SCAN_ACCESS_API_KEY }}
    app-url: http://localhost:4173
    routes: |
      /
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
# No upload-sarif step — attach the file as an artifact if needed.
```

## Privacy

For each route, the action sends:

- The fully rendered, self-contained HTML of that route (JS stripped, CSS inlined).
- Your API key, region, and legislations.

No other source files, environment variables, or repository contents are uploaded. Issues returned by the API describe DOM nodes of the scanned pages — they do not include PII from your visitors.

## How to get an API key

Create a key from your dashboard: <https://app.scan-access.com/dashboard/integrations>. Use the `sa_live_` prefix for production scans and `sa_test_` for staging.

## License

MIT — see [LICENSE](LICENSE).

## Support / issues

- Documentation: <https://scan-access.com/docs>
- Bug reports & feature requests: <https://github.com/ghostdog-dev/scan-access-action/issues>
- Account & billing: <https://app.scan-access.com>
