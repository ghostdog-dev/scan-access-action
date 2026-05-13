import * as core from "@actions/core";

import type { ScanResultIssue, ScanResultView } from "./types.js";

const TOP_VIOLATIONS_LIMIT = 10;
const TARGET_URL_MAX_LENGTH = 80;

/**
 * Écrit une page markdown de résumé dans $GITHUB_STEP_SUMMARY.
 *
 * Le résumé contient le score, le décompte par sévérité, le top 10 violations
 * triées par lawsuit_risk_score décroissant, et un lien vers le dashboard.
 */
export async function writeStepSummary(result: ScanResultView): Promise<void> {
  const { scan, summary, issues, links } = result;
  const score = scan.score ?? "N/A";
  const top = topViolations(issues);
  core.summary
    .addHeading(`scan-access — score ${score}`, 2)
    .addRaw(`Region: \`${scan.region}\` · Pages scanned: ${scan.pages_done}`, true)
    .addBreak()
    .addTable([
      [
        { data: "Critical", header: true },
        { data: "Serious", header: true },
        { data: "Moderate", header: true },
        { data: "Minor", header: true },
        { data: "Incomplete", header: true },
      ],
      [
        String(summary.critical),
        String(summary.serious),
        String(summary.moderate),
        String(summary.minor),
        String(summary.incomplete),
      ],
    ])
    .addHeading("Top violations", 3)
    .addTable(buildViolationsRows(top))
    .addBreak()
    .addLink("Open full report on scan-access.com", links.scan_url);
  await core.summary.write();
}

/** Sélectionne les 10 violations à plus haut risque (lawsuit_risk_score DESC). */
function topViolations(issues: ScanResultIssue[]): ScanResultIssue[] {
  return [...issues]
    .sort((a, b) => b.lawsuit_risk_score - a.lawsuit_risk_score)
    .slice(0, TOP_VIOLATIONS_LIMIT);
}

/** Construit la matrice de cellules markdown pour la table top violations. */
function buildViolationsRows(
  issues: ScanResultIssue[],
): Array<Array<string | { data: string; header: true }>> {
  const header: Array<{ data: string; header: true }> = [
    { data: "Rule", header: true },
    { data: "Impact", header: true },
    { data: "WCAG", header: true },
    { data: "Target URL", header: true },
  ];
  const rows: Array<Array<string | { data: string; header: true }>> = [header];
  for (const issue of issues) {
    rows.push([
      issue.rule_id,
      issue.impact,
      issue.wcag_criteria,
      truncate(issue.target_url, TARGET_URL_MAX_LENGTH),
    ]);
  }
  return rows;
}

/** Tronque une URL trop longue avec un ellipsis (preserve la lisibilité du tableau). */
function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}
