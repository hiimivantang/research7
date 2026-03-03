import { NextRequest, NextResponse } from "next/server";
import { initCollection, searchByVector } from "@/lib/zilliz";
import { generateEmbedding } from "@/lib/lambda";

/**
 * GET /api/papers/semantic-search?q={query}&limit={n}
 *
 * Performs semantic (vector similarity) search across vectorized papers.
 *
 * 1. Embeds the query text via AWS Lambda (OpenAI embedding).
 * 2. Searches Zilliz for the nearest papers by openai_embedding.
 * 3. Returns results with truncated abstracts (max 500 chars).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const limitParam = searchParams.get("limit");

  // Validate query parameter
  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or empty query parameter 'q'" },
      { status: 400 }
    );
  }

  // Parse limit with default of 5
  const limit = limitParam ? parseInt(limitParam, 10) : 5;
  if (isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { error: "Invalid limit parameter — must be a positive integer" },
      { status: 400 }
    );
  }

  try {
    // Generate embedding for the query text
    const queryEmbedding = await generateEmbedding(query);

    // Ensure collection exists and search
    await initCollection();
    const results = await searchByVector(queryEmbedding, limit);

    // Map results to the expected response shape with truncated abstracts
    const papers = results.map((result) => ({
      paperId: result.paperId as string,
      title: result.title as string,
      authors: result.authors as string,
      year: result.year as number,
      abstract:
        typeof result.abstract === "string" && result.abstract.length > 500
          ? result.abstract.slice(0, 500)
          : (result.abstract as string),
      url: result.url as string,
      score: result.score,
    }));

    return NextResponse.json(papers);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[semantic-search] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
