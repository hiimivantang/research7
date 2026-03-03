import config from "./env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single autocomplete match returned by Semantic Scholar. */
export interface PaperMatch {
  id: string;
  title: string;
  authorsYear: string;
}

/** Shape of the autocomplete API response. */
interface AutocompleteResponse {
  matches: PaperMatch[];
}

/** Author object returned by the paper detail endpoint. */
export interface Author {
  authorId: string;
  name: string;
}

/** Embedding payload included when requesting the `embedding` field. */
export interface PaperEmbedding {
  model: string;
  vector: number[];
}

/** Full paper object returned by getPaper. */
export interface Paper {
  paperId: string;
  title: string;
  url: string;
  year: number | null;
  authors: Author[];
  abstract: string | null;
  citationCount: number | null;
  embedding: {
    specter_v2: PaperEmbedding | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const S2_BASE = "https://api.semanticscholar.org/graph/v1";

/** Build common headers, optionally including the API key. */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (config.SEMANTIC_SCHOLAR_API_KEY) {
    headers["x-api-key"] = config.SEMANTIC_SCHOLAR_API_KEY;
  }
  return headers;
}

/** Thin wrapper around fetch that handles common error scenarios. */
async function s2Fetch<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: buildHeaders() });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown network error";
    throw new Error(`Semantic Scholar API network error: ${message}`);
  }

  if (response.status === 429) {
    throw new Error(
      "Semantic Scholar API rate limit exceeded (HTTP 429). " +
        "Please wait before retrying, or set SEMANTIC_SCHOLAR_API_KEY for higher limits."
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Semantic Scholar API error: ${response.status} ${response.statusText}` +
        (body ? ` — ${body}` : "")
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for papers using the Semantic Scholar autocomplete endpoint.
 *
 * @param query - Free-text search query.
 * @returns Array of matching papers with `id`, `title`, and `authorsYear`.
 */
export async function searchPapers(query: string): Promise<PaperMatch[]> {
  const url = `${S2_BASE}/paper/autocomplete?query=${encodeURIComponent(query)}`;
  const data = await s2Fetch<AutocompleteResponse>(url);
  return data.matches;
}

/**
 * Fetch full details for a single paper by its Semantic Scholar paper ID.
 *
 * Requests: url, year, authors, abstract, embedding (including specter_v2).
 *
 * @param paperId - Semantic Scholar paper ID.
 * @returns Full paper object.
 */
export async function getPaper(paperId: string): Promise<Paper> {
  const fields = "url,year,authors,abstract,citationCount,embedding";
  const url = `${S2_BASE}/paper/${encodeURIComponent(paperId)}?fields=${fields}`;
  return s2Fetch<Paper>(url);
}
