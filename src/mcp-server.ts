#!/usr/bin/env node

/**
 * Research7 MCP Server
 *
 * Exposes paper search, fetch/vectorize, and semantic search as MCP tools.
 * Supports stdio transport (default) and SSE transport (--sse flag or SSE_PORT env).
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { searchPapers, getPaper } from "./lib/semantic-scholar.js";
import { initCollection, paperExists, insertPaper, searchByVector } from "./lib/zilliz.js";
import { generateEmbedding } from "./lib/lambda.js";

// ---------------------------------------------------------------------------
// Create MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "research7",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool: resolve-paper-id
// ---------------------------------------------------------------------------

server.tool(
  "resolve-paper-id",
  "Search for papers by query and return a list of matching paper IDs, titles, and author/year info. Use this to find a paper ID before fetching or vectorizing it.",
  { query: z.string().describe("Free-text search query for papers") },
  async ({ query }) => {
    const matches = await searchPapers(query);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(matches, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: fetch-paper
// ---------------------------------------------------------------------------

server.tool(
  "fetch-paper",
  "Fetch a paper by its Semantic Scholar ID and vectorize it (generate embeddings and store in Zilliz). Returns paper metadata with vectorization status. If the paper is already vectorized, returns immediately.",
  { paperId: z.string().describe("Semantic Scholar paper ID") },
  async ({ paperId }) => {
    await initCollection();

    // Guard: check if already vectorized
    const exists = await paperExists(paperId);
    if (exists) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ paperId, alreadyVectorized: true }),
          },
        ],
      };
    }

    // Fetch paper details
    const paper = await getPaper(paperId);

    if (!paper.abstract) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Paper has no abstract and cannot be vectorized.",
              paperId: paper.paperId,
              title: paper.title,
            }),
          },
        ],
        isError: true,
      };
    }

    // Generate OpenAI embedding via Lambda
    const openaiEmbedding = await generateEmbedding(paper.abstract);

    // Extract SPECTER v2 embedding
    const specterVector = paper.embedding?.specter_v2?.vector;
    if (!specterVector || specterVector.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "Paper does not have a SPECTER v2 embedding from Semantic Scholar.",
              paperId: paper.paperId,
              title: paper.title,
            }),
          },
        ],
        isError: true,
      };
    }

    // Store in Zilliz
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

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            paperId: paper.paperId,
            title: paper.title,
            authors: authorsString,
            year: paper.year,
            abstract: paper.abstract,
            url: paper.url,
            citationCount: paper.citationCount,
            vectorized: true,
            vectorizedAt,
          }),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: search-papers
// ---------------------------------------------------------------------------

server.tool(
  "search-papers",
  "Semantic search over vectorized papers. Embeds the query and searches Zilliz for the most similar papers. Returns top-N results with metadata and similarity scores.",
  {
    query: z.string().describe("Natural language search query"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Maximum number of results to return (default 10, max 50)"),
  },
  async ({ query, limit }) => {
    await initCollection();

    const embedding = await generateEmbedding(query);
    const results = await searchByVector(embedding, limit);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Transport selection and startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const useSSE =
    process.argv.includes("--sse") || Boolean(process.env.SSE_PORT);

  if (useSSE) {
    const port = parseInt(process.env.SSE_PORT || "3001", 10);
    const transports: Record<string, SSEServerTransport> = {};

    const httpServer = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || "/", `http://localhost:${port}`);

        if (req.method === "GET" && url.pathname === "/sse") {
          // New SSE connection
          const transport = new SSEServerTransport("/messages", res);
          transports[transport.sessionId] = transport;
          await server.connect(transport);
          return;
        }

        if (req.method === "POST" && url.pathname === "/messages") {
          const sessionId = url.searchParams.get("sessionId");
          if (!sessionId || !transports[sessionId]) {
            res.writeHead(400);
            res.end("Invalid or missing sessionId");
            return;
          }
          await transports[sessionId].handlePostMessage(req, res);
          return;
        }

        res.writeHead(404);
        res.end("Not found");
      }
    );

    httpServer.listen(port, () => {
      console.error(`[research7-mcp] SSE server listening on port ${port}`);
    });
  } else {
    // Default: stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[research7-mcp] Server running on stdio");
  }
}

main().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
