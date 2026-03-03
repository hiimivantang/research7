import dotenv from "dotenv";

dotenv.config();

export interface EnvConfig {
  /** OpenAI API key for generating text embeddings */
  OPENAI_API_KEY: string;
  /** Zilliz Cloud cluster connection URI */
  ZILLIZ_CLOUD_URI: string;
  /** Zilliz Cloud API token for authentication */
  ZILLIZ_CLOUD_TOKEN: string;
  /** AWS region where the Lambda function is deployed */
  AWS_REGION: string;
  /** Name of the AWS Lambda function for embedding generation */
  AWS_LAMBDA_FUNCTION_NAME: string;
  /** Semantic Scholar API key (optional — provides higher rate limits) */
  SEMANTIC_SCHOLAR_API_KEY?: string;
}

const REQUIRED_VARS: (keyof EnvConfig)[] = [
  "OPENAI_API_KEY",
  "ZILLIZ_CLOUD_URI",
  "ZILLIZ_CLOUD_TOKEN",
  "AWS_REGION",
  "AWS_LAMBDA_FUNCTION_NAME",
];

function validateEnv(): EnvConfig {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n` +
        missing.map((v) => `  - ${v}`).join("\n") +
        `\n\nSee .env.example for documentation.`
    );
  }

  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    ZILLIZ_CLOUD_URI: process.env.ZILLIZ_CLOUD_URI!,
    ZILLIZ_CLOUD_TOKEN: process.env.ZILLIZ_CLOUD_TOKEN!,
    AWS_REGION: process.env.AWS_REGION!,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME!,
    SEMANTIC_SCHOLAR_API_KEY: process.env.SEMANTIC_SCHOLAR_API_KEY || undefined,
  };
}

const config: EnvConfig = validateEnv();

export default config;
