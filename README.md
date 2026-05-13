# scan-access GitHub Action

[![marketplace](https://img.shields.io/badge/marketplace-scan--access-green)](https://github.com/marketplace/actions/scan-access)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

WCAG accessibility audit for your live URLs, powered by [scan-access.com](https://scan-access.com) (axe-core engine + lawsuit-risk scoring + AI-generated fixes).

## What it does

Triggers a real scan against a public HTTPS URL configured on your scan-access dashboard, polls until completion, and publishes:

- A **GitHub Actions step summary** with the score, severity counts, and top 10 violations.
- A **PR comment** (upserted via marker) on pull request events.
- Per-issue **annotations** (`error` / `warning` / `notice`) so violations show inline in the Actions UI.
- A **SARIF 2.1.0 file** you can upload to GitHub Code Scanning with a follow-up step.
- A **compliance PDF URL** (signed) when one has been generated.
- A configurable **fail-on policy** that can fail the job based on severity thresholds.

## Quickstart

```yaml
name: Accessibility audit
on:
  pull_request:
  schedule:
    - cron: "0 6 * * 1"

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: ghostdog-dev/scan-access-action@v1
        id: a11y
        with:
          api-key: ${{ secrets.SCAN_ACCESS_API_KEY }}
          target-url: https://example.com
          store-id: 00000000-0000-0000-0000-000000000000
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: ${{ steps.a11y.outputs.sarif-file }}
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `api-key` | yes | — | scan-access API key (`sa_live_...` / `sa_test_...`). Store as a secret. |
| `target-url` | yes | — | Public HTTPS URL audited. Informational for M6-F (the store determines the URL scanned). |
| `store-id` | yes | — | UUID of the scan-access store to scan (found in dashboard URL). |
| `max-pages` | no | `25` | Max pages crawled. Capped by your plan tier (Scanner=25, Defense=50, Agency=100). |
| `max-depth` | no | `3` | Max crawl depth from the entry URL (1..5). |
| `region` | no | `us_ada` | Compliance region. `us_ada` or `eu_eaa`. |
| `fail-on` | no | `critical` | `never`, `minor`, `moderate`, `serious`, `critical`, or `any`. |
| `output-sarif` | no | `scan-access.sarif` | Local path where the SARIF document is written. |
| `api-base-url` | no | `https://api.scan-access.com` | Override base URL (self-hosted or staging). |

## Outputs

| Name | Description |
| --- | --- |
| `scan-id` | UUID of the scan created by the action. |
| `score` | Overall accessibility score (0..100), empty if the scan did not score. |
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
  security-events: write # required only if you forward SARIF to Code Scanning
```

The `GITHUB_TOKEN` provided by GitHub Actions must be passed via the `env:` block of the step for the PR comment feature to work.

## Examples

### Pull request gating (default)

```yaml
on:
  pull_request:
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: ghostdog-dev/scan-access-action@v1
        with:
          api-key: ${{ secrets.SCAN_ACCESS_API_KEY }}
          target-url: https://staging.example.com
          store-id: ${{ vars.SCAN_ACCESS_STORE_ID }}
          fail-on: serious
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Scheduled audit on production

```yaml
on:
  schedule:
    - cron: "0 6 * * 1"
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: ghostdog-dev/scan-access-action@v1
        with:
          api-key: ${{ secrets.SCAN_ACCESS_API_KEY }}
          target-url: https://www.example.com
          store-id: ${{ vars.SCAN_ACCESS_STORE_ID }}
          max-pages: 50
          fail-on: never
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Skip SARIF upload (PR comment + annotations only)

Just omit the `upload-sarif` step. The action will still write the SARIF file locally — you can attach it as an artifact instead.

## Tier limits

| Plan | Max pages | Max depth |
| --- | --- | --- |
| Scanner | 25 | 3 |
| Defense | 50 | 4 |
| Agency | 100 | 5 |

If you request `max-pages` or `max-depth` higher than your plan allows, the API returns `422 SCAN_CONFIG_TIER_EXCEEDED`.

## How to get an API key

Create a key from your dashboard: <https://app.scan-access.com/dashboard/integrations>. Use the prefix `sa_live_` for production scans and `sa_test_` for staging.

## Caveats

- **URLs scanned are external** (HTTPS), not files in your repo. GitHub Code Scanning maps SARIF results against `artifactLocation.uri`, which is the live URL — alerts may render imperfectly in the Security tab. The PR comment + step summary remain the canonical view.
- **SARIF upload is optional.** This action only writes the local file; uploading is delegated to [`github/codeql-action/upload-sarif`](https://github.com/github/codeql-action) so you stay in control.
- **`target-url` is informational** in this release. The actual URL audited is the one configured on your scan-access store (`store-id`).

## Privacy

The action only sends your store ID, scan configuration, and API key to `https://api.scan-access.com`. No source code is uploaded. Issues returned by the API never include PII from your visitors; they describe DOM nodes of the public pages.

## License

MIT — see [LICENSE](LICENSE).

## Support / issues

- Documentation: <https://scan-access.com/docs>
- Bug reports & feature requests: <https://github.com/ghostdog-dev/scan-access-action/issues>
- Account & billing: <https://app.scan-access.com>
