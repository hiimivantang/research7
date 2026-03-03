"""AWS Lambda function for generating OpenAI embeddings."""

import json
import os

from openai import OpenAI, OpenAIError

MODEL = "text-embedding-3-small"
DIMENSIONS = 1536


def handler(event, context):
    """Generate an embedding for the given text using OpenAI.

    Expects an event payload of the form: { "text": "..." }

    Returns:
        dict: { "embedding": [...], "model": "text-embedding-3-small", "dimensions": 1536 }
    """
    # Validate input
    text = event.get("text") if isinstance(event, dict) else None

    if not text or not isinstance(text, str) or text.strip() == "":
        return {
            "statusCode": 400,
            "body": json.dumps(
                {"error": "Missing or empty 'text' field in request payload"}
            ),
        }

    # Read API key from environment
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "OPENAI_API_KEY environment variable is not set"}
            ),
        }

    # Generate embedding
    try:
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(
            input=text.strip(),
            model=MODEL,
        )
        embedding = response.data[0].embedding

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "embedding": embedding,
                    "model": MODEL,
                    "dimensions": DIMENSIONS,
                }
            ),
        }
    except OpenAIError as exc:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"OpenAI API error: {str(exc)}"}),
        }
    except Exception as exc:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"Unexpected error: {str(exc)}"}),
        }
