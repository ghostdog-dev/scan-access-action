import type { FailOnLevel } from "./types.js";

export interface FailOnSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

/**
 * Évalue la politique fail-on pour décider si le job doit échouer.
 *
 * Tables de vérité :
 *   never    : jamais
 *   any      : >= 1 violation, toutes sévérités confondues
 *   critical : >= 1 critical
 *   serious  : >= 1 critical OU serious
 *   moderate : >= 1 critical OU serious OU moderate
 *   minor    : >= 1 violation quelle que soit la sévérité (idem any)
 */
export function shouldFail(level: FailOnLevel, summary: FailOnSummary): boolean {
  switch (level) {
    case "never":
      return false;
    case "any":
      return totalViolations(summary) > 0;
    case "critical":
      return summary.critical > 0;
    case "serious":
      return summary.critical > 0 || summary.serious > 0;
    case "moderate":
      return summary.critical > 0 || summary.serious > 0 || summary.moderate > 0;
    case "minor":
      return totalViolations(summary) > 0;
    default:
      return false;
  }
}

/** Somme des violations toutes sévérités confondues. */
function totalViolations(summary: FailOnSummary): number {
  return summary.critical + summary.serious + summary.moderate + summary.minor;
}
