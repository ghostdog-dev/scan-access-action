import * as core from "@actions/core";

import type { FailOnLevel, Region } from "./types.js";

const FAIL_ON_VALUES: readonly FailOnLevel[] = [
  "never",
  "minor",
  "moderate",
  "serious",
  "critical",
  "any",
] as const;

const REGION_VALUES: readonly Region[] = ["us_ada", "eu_eaa"] as const;

const MAX_PAGES_MIN = 1;
const MAX_PAGES_HARD_CAP = 100;
const MAX_DEPTH_MIN = 1;
const MAX_DEPTH_HARD_CAP = 5;

export interface ActionInputs {
  apiKey: string;
  targetUrl: string;
  storeId: string;
  maxPages: number;
  maxDepth: number;
  region: Region;
  failOn: FailOnLevel;
  outputSarif: string;
  apiBaseUrl: string;
}

/**
 * Lit les inputs du workflow, valide leurs types et bornes, et renvoie un objet typé.
 *
 * Lève une erreur explicite quand une valeur enum est invalide ou qu'un entier
 * sort des bornes (max-pages 1..100, max-depth 1..5).
 */
export function readInputs(): ActionInputs {
  const apiKey = core.getInput("api-key", { required: true });
  const targetUrl = core.getInput("target-url", { required: true });
  const storeId = core.getInput("store-id", { required: true });
  const region = parseRegion(core.getInput("region") || "us_ada");
  const failOn = parseFailOn(core.getInput("fail-on") || "critical");
  const maxPages = parsePositiveInt(
    "max-pages",
    core.getInput("max-pages") || "25",
    MAX_PAGES_MIN,
    MAX_PAGES_HARD_CAP,
  );
  const maxDepth = parsePositiveInt(
    "max-depth",
    core.getInput("max-depth") || "3",
    MAX_DEPTH_MIN,
    MAX_DEPTH_HARD_CAP,
  );
  const outputSarif = core.getInput("output-sarif") || "scan-access.sarif";
  const apiBaseUrl = core.getInput("api-base-url") || "https://api.scan-access.com";
  return {
    apiKey,
    targetUrl,
    storeId,
    maxPages,
    maxDepth,
    region,
    failOn,
    outputSarif,
    apiBaseUrl,
  };
}

/** Valide qu'une chaîne d'input appartient bien à l'enum Region. */
function parseRegion(value: string): Region {
  if ((REGION_VALUES as readonly string[]).includes(value)) {
    return value as Region;
  }
  throw new Error(`Invalid region "${value}". Expected one of: ${REGION_VALUES.join(", ")}.`);
}

/** Valide qu'une chaîne d'input appartient bien à l'enum FailOnLevel. */
function parseFailOn(value: string): FailOnLevel {
  if ((FAIL_ON_VALUES as readonly string[]).includes(value)) {
    return value as FailOnLevel;
  }
  throw new Error(`Invalid fail-on "${value}". Expected one of: ${FAIL_ON_VALUES.join(", ")}.`);
}

/** Parse un entier positif borné [min..max] (lève si NaN ou hors bornes). */
function parsePositiveInt(name: string, raw: string, min: number, max: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${name} "${raw}": expected integer.`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`Invalid ${name} "${raw}": expected ${min}..${max}.`);
  }
  return parsed;
}
