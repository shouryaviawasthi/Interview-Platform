const Groq = require("groq-sdk");
const env = require("../../config/env");

let groqClient = null;

const getClient = () => {
  if (!groqClient) {
    if (!env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured on the server.");
    }
    groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return groqClient;
};

/**
 * Generate a structured JSON response from Groq.
 *
 * @param {Object} opts
 * @param {string} opts.systemPrompt  - The system instructions for Groq
 * @param {string} opts.userPrompt    - The user-level content (transcript, data)
 * @param {number} [opts.maxTokens]   - Max tokens to generate (default 4096)
 * @param {number} [opts.temperature] - Temperature (default 0.2 for deterministic output)
 * @returns {Promise<Object>}          - Parsed JSON object from Groq response
 * @throws                             - On API failure, JSON parse error, or empty response
 */
const generateStructuredResponse = async ({
  systemPrompt,
  userPrompt,
  maxTokens = 4096,
  temperature = 0.2,
}) => {
  const client = getClient();
  const model = env.GROQ_MODEL || "llama-3.1-70b-versatile";

  console.log(`[Groq] Calling model: ${model}`);

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
    // Ask for JSON output — Groq supports this with newer models
    response_format: { type: "json_object" },
  });

  const raw = completion.choices?.[0]?.message?.content;

  if (!raw || raw.trim() === "") {
    throw new Error("Groq returned an empty response.");
  }

  console.log(`[Groq] Raw response length: ${raw.length} chars. Preview: ${raw.slice(0, 120)}`);

  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract a JSON object from markdown code fences
    const match = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
      } catch {
        throw new Error(`Groq response is not valid JSON: ${raw.slice(0, 200)}`);
      }
    } else {
      throw new Error(`Groq response is not valid JSON: ${raw.slice(0, 200)}`);
    }
  }

  return parsed;
};

module.exports = { generateStructuredResponse };

