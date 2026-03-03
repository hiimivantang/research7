import { MilvusClient, DataType, RowData } from "@zilliz/milvus2-sdk-node";
import config from "./env";

const COLLECTION_NAME = "research7_papers";

/**
 * Milvus/Zilliz Cloud client instance, connecting via gRPC.
 */
const milvusClient = new MilvusClient({
  address: config.ZILLIZ_CLOUD_URI,
  token: config.ZILLIZ_CLOUD_TOKEN,
  ssl: true,
});

/**
 * Checks whether the research7_papers collection exists and creates it
 * (with AUTOINDEX on both vector fields) if it does not.
 */
export async function initCollection(): Promise<void> {
  const hasRes = await milvusClient.hasCollection({
    collection_name: COLLECTION_NAME,
  });

  if (hasRes.value) {
    console.log(
      `[zilliz] Collection "${COLLECTION_NAME}" already exists.`
    );
    return;
  }

  console.log(
    `[zilliz] Collection "${COLLECTION_NAME}" not found — creating…`
  );

  await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: "paperId",
        data_type: DataType.VarChar,
        is_primary_key: true,
        max_length: 64,
      },
      {
        name: "title",
        data_type: DataType.VarChar,
        max_length: 512,
      },
      {
        name: "authors",
        data_type: DataType.VarChar,
        max_length: 2048,
      },
      {
        name: "year",
        data_type: DataType.Int32,
      },
      {
        name: "abstract",
        data_type: DataType.VarChar,
        max_length: 8192,
      },
      {
        name: "url",
        data_type: DataType.VarChar,
        max_length: 512,
      },
      {
        name: "vectorizedAt",
        data_type: DataType.Int64,
      },
      {
        name: "openai_embedding",
        data_type: DataType.FloatVector,
        dim: 1536,
      },
      {
        name: "specter_v2_embedding",
        data_type: DataType.FloatVector,
        dim: 768,
      },
    ],
    index_params: [
      {
        field_name: "openai_embedding",
        index_type: "AUTOINDEX",
        metric_type: "COSINE",
      },
      {
        field_name: "specter_v2_embedding",
        index_type: "AUTOINDEX",
        metric_type: "COSINE",
      },
    ],
  });

  // Load the collection into memory so it is ready for search/query.
  await milvusClient.loadCollection({
    collection_name: COLLECTION_NAME,
  });

  console.log(
    `[zilliz] Collection "${COLLECTION_NAME}" created and loaded.`
  );
}

// ---------------------------------------------------------------------------
// Paper data type
// ---------------------------------------------------------------------------

export interface PaperRecord {
  paperId: string;
  title: string;
  authors: string;
  year: number;
  abstract: string;
  url: string;
  vectorizedAt: number;
  openai_embedding: number[];
  specter_v2_embedding: number[];
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Insert a single paper record into the collection.
 */
export async function insertPaper(data: PaperRecord): Promise<void> {
  const row: RowData = { ...data };
  await milvusClient.insert({
    collection_name: COLLECTION_NAME,
    data: [row],
  });
}

/**
 * Returns `true` if a paper with the given `paperId` already exists in the
 * collection.
 */
export async function paperExists(paperId: string): Promise<boolean> {
  const res = await milvusClient.query({
    collection_name: COLLECTION_NAME,
    filter: `paperId == "${paperId}"`,
    output_fields: ["paperId"],
    limit: 1,
  });

  return res.data.length > 0;
}

/**
 * Perform an approximate nearest-neighbour (ANN) search on the
 * `openai_embedding` field and return the top results with scores.
 */
export async function searchByVector(
  embedding: number[],
  limit: number
): Promise<
  Array<{
    score: number;
    [key: string]: unknown;
  }>
> {
  const res = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    data: embedding,
    anns_field: "openai_embedding",
    limit,
    output_fields: [
      "paperId",
      "title",
      "authors",
      "year",
      "abstract",
      "url",
      "vectorizedAt",
    ],
  });

  return res.results;
}

export { milvusClient, COLLECTION_NAME };
