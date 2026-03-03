import { NextRequest, NextResponse } from "next/server";
import { initCollection, paperExists, insertPaper } from "@/lib/zilliz";
import { getPaper } from "@/lib/semantic-scholar";
import { generateEmbedding } from "@/lib/lambda";

/**
 * POST /api/papers/[paperId]/vectorize
 *
 * Vectorizes a paper by:
 * 1. Checking the guard (paper must not already be vectorized)
 * 2. Fetching paper data from Semantic Scholar
 * 3. Generating an OpenAI embedding for the abstract via Lambda
 * 4. Extracting the SPECTER v2 embedding from the S2 response
 * 5. Storing the paper + both embeddings in Zilliz
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  const { paperId } = await params;

  try {
    // Ensure collection exists
    await initCollection();

    // Guard: check if paper is already vectorized
    const exists = await paperExists(paperId);
    if (exists) {
      return NextResponse.json(
        { canVectorize: false, reason: "Paper already vectorized" },
        { status: 409 }
      );
    }

    // Fetch paper details from Semantic Scholar
    const paper = await getPaper(paperId);

    // Validate that the paper has an abstract (required for embedding)
    if (!paper.abstract) {
      return NextResponse.json(
        {
          error:
            "Paper has no abstract and cannot be vectorized. An abstract is required to generate an embedding.",
        },
        { status: 400 }
      );
    }

    // Generate OpenAI embedding for the abstract via Lambda
    const openaiEmbedding = await generateEmbedding(paper.abstract);

    // Extract SPECTER v2 embedding from the Semantic Scholar response
    const specterVector = paper.embedding?.specter_v2?.vector;
    if (!specterVector || specterVector.length === 0) {
      return NextResponse.json(
        {
          error:
            "Paper does not have a SPECTER v2 embedding from Semantic Scholar.",
        },
        { status: 400 }
      );
    }

    // Build the paper record
    const vectorizedAt = Date.now();
    const authorsString = paper.authors.map((a) => a.name).join(", ");

    await insertPaper({
      paperId: paper.paperId,
      title: paper.title,
      authors: authorsString,
      year: paper.year ?? 0,
      abstract: paper.abstract,
      citationCount: paper.citationCount ?? 0,
      url: paper.url,
      vectorizedAt,
      openai_embedding: openaiEmbedding,
      specter_v2_embedding: specterVector,
    });

    // Return success with paper metadata
    return NextResponse.json({
      paperId: paper.paperId,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      abstract: paper.abstract,
      url: paper.url,
      citationCount: paper.citationCount,
      vectorized: true,
      vectorizedAt,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error(`[vectorize] Error vectorizing paper ${paperId}:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
