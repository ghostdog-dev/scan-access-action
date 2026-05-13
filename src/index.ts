import * as core from "@actions/core";

import { emitAnnotations } from "./annotations.js";
import { ScanAccessClient } from "./api-client.js";
import { type FailOnSummary, shouldFail } from "./fail-on.js";
import { readInputs } from "./inputs.js";
import { pollUntilTerminal } from "./polling.js";
import { maybePostPrComment } from "./pr-comment.js";
import { writeSarif } from "./sarif-writer.js";
import { writeStepSummary } from "./summary-writer.js";
import type { ScanResultView } from "./types.js";

/**
 * Point d'entrée de l'action GitHub scan-access.
 *
 * Orchestration : lecture inputs -> création scan -> polling jusqu'à terminal
 * -> récupération result.json + SARIF en parallèle -> outputs + step summary
 * + PR comment + annotations -> politique fail-on finale.
 */
async function run(): Promise<void> {
  try {
    const inputs = readInputs();
    core.setSecret(inputs.apiKey);
    const client = new ScanAccessClient(inputs.apiBaseUrl, inputs.apiKey);
    const created = await client.createScan({
      store_id: inputs.storeId,
      region: inputs.region,
      scan_config: {
        max_pages: inputs.maxPages,
        max_depth: inputs.maxDepth,
      },
    });
    core.setOutput("scan-id", created.id);
    core.info(`scan-access scan created: ${created.id}`);
    const final = await pollUntilTerminal(client, created.id);
    if (final.status !== "completed") {
      core.setFailed(
        `Scan ${created.id} ended with status "${final.status}" (error_code=${final.error_code ?? "none"}).`,
      );
      return;
    }
    const [result, sarif] = await Promise.all([
      client.getResult(created.id),
      client.getSarif(created.id),
    ]);
    await writeSarif(inputs.outputSarif, sarif);
    setOutputs(result, inputs.outputSarif);
    await writeStepSummary(result);
    await maybePostPrComment(result);
    emitAnnotations(result);
    const summary: FailOnSummary = {
      critical: result.summary.critical,
      serious: result.summary.serious,
      moderate: result.summary.moderate,
      minor: result.summary.minor,
    };
    if (shouldFail(inputs.failOn, summary)) {
      core.setFailed(
        `fail-on=${inputs.failOn} threshold reached (critical=${summary.critical} serious=${summary.serious} moderate=${summary.moderate} minor=${summary.minor}).`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}

/** Publie les outputs structurés de l'action (score, sévérités, urls, sarif-file). */
function setOutputs(result: ScanResultView, sarifPath: string): void {
  const { scan, summary, links } = result;
  const totalViolations = summary.critical + summary.serious + summary.moderate + summary.minor;
  core.setOutput("score", scan.score === null ? "" : String(scan.score));
  core.setOutput("total-violations", String(totalViolations));
  core.setOutput("critical-count", String(summary.critical));
  core.setOutput("serious-count", String(summary.serious));
  core.setOutput("moderate-count", String(summary.moderate));
  core.setOutput("minor-count", String(summary.minor));
  core.setOutput("pdf-url", links.pdf_url ?? "");
  core.setOutput("scan-url", links.scan_url);
  core.setOutput("sarif-file", sarifPath);
}

void run();
