import { writeFile } from "node:fs/promises";

import * as core from "@actions/core";

import type { SarifDocument } from "./types.js";

const JSON_INDENT = 2;

/**
 * Écrit un document SARIF 2.1.0 sur disque (UTF-8, pretty-printed).
 *
 * L'upload vers GitHub Code Scanning n'est pas réalisé ici : l'utilisateur
 * câble un step `github/codeql-action/upload-sarif@v3` séparé dans son
 * workflow, en passant le chemin renvoyé via l'output `sarif-file`.
 */
export async function writeSarif(path: string, sarif: SarifDocument): Promise<void> {
  const payload = JSON.stringify(sarif, null, JSON_INDENT);
  await writeFile(path, payload, "utf-8");
  core.info(`SARIF written to ${path}`);
}
