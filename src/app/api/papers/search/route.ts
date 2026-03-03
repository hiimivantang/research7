import { NextRequest, NextResponse } from "next/server";
import { searchPapers } from "@/lib/semantic-scholar";
import { initCollection, paperExists } from "@/lib/zilliz";

/**
 * GET /api/papers/search?q={query}
 *
 * Searches Semantic Scholar for papers matching the query, then checks
 * Zilliz to determine if each paper has already been vectorized.
 *
 * Returns a JSON array of { id, title, authorsYear, vectorized }.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim() === "") {
    return NextResponse.json(
      { error: "Missing or empty query parameter 'q'" },
      { status: 400 }
    );
  }

  // Ensure the Zilliz collection exists before querying it.
  await initCollection();

  const papers = await searchPapers(q);

  const results = await Promise.all(
    papers.map(async (paper) => {
      const vectorized = await paperExists(paper.id);
      return {
        id: paper.id,
        title: paper.title,
        authorsYear: paper.authorsYear,
        vectorized,
      };
    })
  );

  return NextResponse.json(results);
}
