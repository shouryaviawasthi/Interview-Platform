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

  console.log(`[Groq] Calling model: ${model} with maxTokens: ${maxTokens}, temperature: ${temperature}`);

  let completion;
  try {
    completion = await client.chat.completions.create({
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
  } catch (error) {
    console.error(`[Groq] API call failed:`, {
      error: error.message,
      status: error.status,
      type: error.type,
      model: model
    });
    
    // Enhance error messages based on error type
    if (error.status === 429) {
      throw new Error(`Groq API rate limit exceeded. Please try again later. Model: ${model}`);
    } else if (error.status >= 500) {
      throw new Error(`Groq API server error (${error.status}). Service may be temporarily unavailable.`);
    } else if (error.status === 401) {
      throw new Error(`Groq API authentication failed. Check API key configuration.`);
    } else if (error.status === 400) {
      throw new Error(`Groq API request invalid: ${error.message}`);
    } else {
      throw new Error(`Groq API call failed: ${error.message} (Status: ${error.status || 'unknown'})`);
    }
  }

  // Validate completion structure
  if (!completion || !completion.choices || completion.choices.length === 0) {
    console.error(`[Groq] Invalid completion structure:`, completion);
    throw new Error("Groq returned malformed completion response - no choices available.");
  }

  const raw = completion.choices[0]?.message?.content;

  if (!raw || raw.trim() === "") {
    console.error(`[Groq] Empty response from API. Completion:`, completion);
    throw new Error("Groq returned an empty response.");
  }

  console.log(`[Groq] Raw response length: ${raw.length} chars. Preview: ${raw.slice(0, 120)}`);

  // Parse JSON with enhanced error handling
  let parsed;
  try {
    parsed = JSON.parse(raw);
    console.log(`[Groq] Successfully parsed JSON response`);
  } catch (parseError) {
    console.error(`[Groq] JSON parse failed:`, {
      error: parseError.message,
      rawPreview: raw.slice(0, 300)
    });
    
    // Try to extract a JSON object from markdown code fences
    const match = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]);
        console.log(`[Groq] Successfully parsed JSON from markdown code fence`);
      } catch (fenceError) {
        console.error(`[Groq] Markdown fence JSON parse failed:`, fenceError.message);
        throw new Error(`Groq response contains invalid JSON in markdown fence: ${raw.slice(0, 200)}`);
      }
    } else {
      throw new Error(`Groq response is not valid JSON and contains no markdown fence: ${raw.slice(0, 200)}`);
    }
  }

  // Validate parsed response is an object
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error(`[Groq] Parsed response is not a valid object:`, typeof parsed, parsed);
    throw new Error(`Groq response parsed but is not an object: ${typeof parsed}`);
  }

  return parsed;
};

module.exports = { generateStructuredResponse };

