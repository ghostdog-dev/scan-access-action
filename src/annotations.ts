import * as core from "@actions/core";

import type { Impact, ScanResultIssue, ScanResultView } from "./types.js";

/**
 * Émet des annotations GitHub Actions par issue (error/warning/notice).
 *
 * On n'utilise pas `file:` : les violations pointent vers des URLs HTTPS
 * externes, pas des fichiers source du repo. Le titre porte le critère WCAG
 * et le rule_id pour permettre la lecture rapide dans l'UI Actions.
 */
export function emitAnnotations(result: ScanResultView): void {
  for (const issue of result.issues) {
    emitIssueAnnotation(issue);
  }
}

/** Émet une seule annotation au niveau approprié pour l'impact de l'issue. */
function emitIssueAnnotation(issue: ScanResultIssue): void {
  const title = `WCAG ${issue.wcag_criteria} - ${issue.rule_id}`;
  const message = `${issue.description} (target: ${issue.target_url})`;
  const level = annotationLevelFor(issue.impact);
  if (level === "error") {
    core.error(message, { title });
    return;
  }
  if (level === "warning") {
    core.warning(message, { title });
    return;
  }
  core.notice(message, { title });
}

/** Mappe l'impact axe vers le niveau d'annotation Actions correspondant. */
function annotationLevelFor(impact: Impact): "error" | "warning" | "notice" {
  if (impact === "critical" || impact === "serious") {
    return "error";
  }
  if (impact === "moderate") {
    return "warning";
  }
  return "notice";
}
