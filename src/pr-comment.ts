import * as core from "@actions/core";
import * as github from "@actions/github";

import type { ScanResultView } from "./types.js";

const MARKER = "<!-- scan-access-comment -->";
const PULL_REQUEST_EVENT = "pull_request";

/**
 * Poste ou met à jour un commentaire markdown sur la PR courante.
 *
 * No-op hors événement pull_request. Utilise un marker HTML caché pour
 * retrouver le commentaire précédent et l'upserter (évite la spam de notifs).
 */
export async function maybePostPrComment(result: ScanResultView): Promise<void> {
  const context = github.context;
  if (context.eventName !== PULL_REQUEST_EVENT) {
    return;
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning(
      "GITHUB_TOKEN is not set: skipping PR comment. Pass `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to enable.",
    );
    return;
  }
  const prNumber = context.payload.pull_request?.number;
  if (!prNumber) {
    core.warning("Pull request number unavailable: skipping PR comment.");
    return;
  }
  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;
  const body = buildBody(result);
  const existing = await findExistingComment(octokit, owner, repo, prNumber);
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing,
      body,
    });
    return;
  }
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

/**
 * Recherche dans les commentaires de la PR celui qui contient le marker
 * scan-access et renvoie son id, ou undefined si absent.
 */
async function findExistingComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<number | undefined> {
  const iterator = octokit.paginate.iterator(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  for await (const { data } of iterator) {
    for (const comment of data) {
      if (comment.body?.includes(MARKER)) {
        return comment.id;
      }
    }
  }
  return undefined;
}

/** Construit le corps markdown du commentaire (toujours préfixé par le marker). */
function buildBody(result: ScanResultView): string {
  const { scan, summary, links } = result;
  const score = scan.score ?? "N/A";
  return [
    MARKER,
    `## scan-access — accessibility report (score ${score})`,
    "",
    `Region: \`${scan.region}\` · Pages scanned: ${scan.pages_done}`,
    "",
    "| Critical | Serious | Moderate | Minor | Incomplete |",
    "| --- | --- | --- | --- | --- |",
    `| ${summary.critical} | ${summary.serious} | ${summary.moderate} | ${summary.minor} | ${summary.incomplete} |`,
    "",
    `[Open full report on scan-access.com](${links.scan_url})`,
  ].join("\n");
}
