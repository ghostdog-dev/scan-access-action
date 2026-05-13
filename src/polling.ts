import * as core from "@actions/core";

import type { ScanAccessClient } from "./api-client.js";
import type { ScanResponse, ScanStatus } from "./types.js";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 45 * 60 * 1000;
const PROGRESS_LOG_INTERVAL_MS = 15_000;

const TERMINAL_STATUSES: readonly ScanStatus[] = ["completed", "failed", "canceled"] as const;

/**
 * Boucle de polling 5s jusqu'à ce que le scan atteigne un statut terminal.
 *
 * Loggue un état de progression au plus toutes les 15s. Lève si le timeout
 * (45 min) est atteint avant qu'un statut terminal soit observé.
 */
export async function pollUntilTerminal(
  client: ScanAccessClient,
  scanId: string,
): Promise<ScanResponse> {
  const start = Date.now();
  let lastProgressLog = 0;
  while (true) {
    const scan = await client.getScan(scanId);
    if (isTerminal(scan.status)) {
      return scan;
    }
    const elapsed = Date.now() - start;
    if (elapsed >= MAX_POLL_DURATION_MS) {
      throw new Error(
        `Scan ${scanId} did not reach terminal status within ${MAX_POLL_DURATION_MS / 60000}min (last status: ${scan.status}).`,
      );
    }
    if (elapsed - lastProgressLog >= PROGRESS_LOG_INTERVAL_MS) {
      core.info(
        `scan ${scanId} status=${scan.status} pages_done=${scan.pages_done} pages_total=${scan.pages_total ?? "?"}`,
      );
      lastProgressLog = elapsed;
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/** Indique si un statut de scan est définitif (plus aucun changement attendu). */
function isTerminal(status: ScanStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Pause non bloquante d'une durée donnée (ms). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
