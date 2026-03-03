import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import config from "./env";

// ---------------------------------------------------------------------------
// Lambda client
// ---------------------------------------------------------------------------

const lambdaClient = new LambdaClient({ region: config.AWS_REGION });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LambdaResponseBody {
  embedding: number[];
  model: string;
  dimensions: number;
}

interface LambdaPayload {
  statusCode: number;
  body: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Invoke the AWS Lambda embedding function to generate an OpenAI embedding
 * for the given text.
 *
 * @param text - The text to embed.
 * @returns The embedding vector (number[]).
 * @throws If the Lambda invocation fails or returns an error.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const command = new InvokeCommand({
    FunctionName: config.AWS_LAMBDA_FUNCTION_NAME,
    Payload: new TextEncoder().encode(JSON.stringify({ text })),
  });

  const response = await lambdaClient.send(command);

  if (response.FunctionError) {
    throw new Error(
      `Lambda function error: ${response.FunctionError} — ${
        response.Payload
          ? new TextDecoder().decode(response.Payload)
          : "no payload"
      }`
    );
  }

  if (!response.Payload) {
    throw new Error("Lambda returned no payload");
  }

  const raw = new TextDecoder().decode(response.Payload);
  const lambdaResult: LambdaPayload = JSON.parse(raw);

  if (lambdaResult.statusCode !== 200) {
    throw new Error(
      `Lambda returned status ${lambdaResult.statusCode}: ${lambdaResult.body}`
    );
  }

  const body: LambdaResponseBody = JSON.parse(lambdaResult.body);

  if (!Array.isArray(body.embedding) || body.embedding.length === 0) {
    throw new Error("Lambda returned an invalid or empty embedding");
  }

  return body.embedding;
}
