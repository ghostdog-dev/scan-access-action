import type { SarifDocument, ScanCreatePayload, ScanResponse, ScanResultView } from "./types.js";

const USER_AGENT = "scan-access-action/1.0";
const ERROR_BODY_MAX_LENGTH = 300;

type HttpMethod = "GET" | "POST";

/**
 * Client HTTP authentifié pour l'API scan-access (auth Bearer + JSON).
 *
 * Utilise fetch natif (Node 24+) et expose des méthodes typées pour les routes
 * consommées par l'action : createScan, getScan, getResult, getSarif.
 */
export class ScanAccessClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = stripTrailingSlash(baseUrl);
    this.apiKey = apiKey;
  }

  /** Crée un scan via POST /api/v1/scans et renvoie la réponse complète. */
  async createScan(payload: ScanCreatePayload): Promise<ScanResponse> {
    return this.request<ScanResponse>("POST", "/api/v1/scans", payload);
  }

  /** Récupère l'état courant d'un scan via GET /api/v1/scans/:id. */
  async getScan(scanId: string): Promise<ScanResponse> {
    return this.request<ScanResponse>("GET", `/api/v1/scans/${scanId}`);
  }

  /** Récupère le payload result.json complet (scan + issues + stacks + links). */
  async getResult(scanId: string): Promise<ScanResultView> {
    return this.request<ScanResultView>("GET", `/api/v1/scans/${scanId}/result.json`);
  }

  /** Récupère le document SARIF 2.1.0 d'un scan terminé. */
  async getSarif(scanId: string): Promise<SarifDocument> {
    return this.request<SarifDocument>("GET", `/api/v1/scans/${scanId}/sarif`);
  }

  /**
   * Effectue la requête HTTP authentifiée et parse la réponse JSON.
   *
   * Lève une erreur structurée (status + extrait body) si la réponse n'est pas 2xx.
   */
  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": USER_AGENT,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await safeReadText(response);
      throw new Error(
        `scan-access API ${method} ${path} failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }
    return (await response.json()) as T;
  }
}

/** Retire le slash final d'une URL pour éviter les concaténations doubles. */
function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Lit le corps texte d'une réponse en bornant la taille (truncation 300 chars). */
async function safeReadText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > ERROR_BODY_MAX_LENGTH
      ? `${text.slice(0, ERROR_BODY_MAX_LENGTH)}...`
      : text;
  } catch {
    return "<unreadable body>";
  }
}
