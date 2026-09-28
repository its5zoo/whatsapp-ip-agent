import { env } from '../config/env';

async function callGemini(systemInstruction: string, prompt: string, apiKey: string): Promise<any | null> {
  const model = env.AI_MODEL || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          optionId: { type: 'STRING' },
          confidence: { type: 'NUMBER' }
        },
        required: ['optionId', 'confidence']
      }
    }
  };

  const timeoutMs = env.AI_TIMEOUT_MS || 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (response.status === 503) {
      console.warn('[AI Provider] Received 503, retrying in 1s...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Could not read response body';
      }
      console.warn(`[AI Provider] API returned ${response.status}: ${response.statusText} | Error Body: ${errorBody}`);
      return null;
    }

    const json = await response.json();

    const textResult = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      console.warn('[AI Provider] Response missing expected text content structure.');
      return null;
    }

    const parsed = JSON.parse(textResult);
    return parsed;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[AI Provider] API request timed out after ${timeoutMs}ms.`);
    } else {
      console.warn(`[AI Provider] Error calling API: ${err.message}`);
    }
    return null;
  }
}

async function callGroq(systemInstruction: string, prompt: string, apiKey: string): Promise<any | null> {
  const model = env.AI_MODEL || 'openai/gpt-oss-20b';
  const url = `https://api.groq.com/openai/v1/chat/completions`;

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "questionnaire_choice",
        strict: true,
        schema: {
          type: "object",
          properties: {
            optionId: { type: "string" },
            confidence: { type: "number" }
          },
          required: ["optionId", "confidence"],
          additionalProperties: false
        }
      }
    }
  };

  const timeoutMs = env.AI_TIMEOUT_MS || 5000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Could not read response body';
      }
      console.warn(`[AI Provider] Groq API returned ${response.status}: ${response.statusText} | Error Body: ${errorBody}`);
      return null;
    }

    const json = await response.json();
    const textResult = json?.choices?.[0]?.message?.content;
    if (!textResult) {
      console.warn('[AI Provider] Groq response missing expected content structure.');
      return null;
    }

    const parsed = JSON.parse(textResult);
    return parsed;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn(`[AI Provider] Groq API request timed out after ${timeoutMs}ms.`);
    } else {
      console.warn(`[AI Provider] Error calling Groq API: ${err.message}`);
    }
    return null;
  }
}

export const aiProvider = {
  async callModel(systemInstruction: string, prompt: string): Promise<any | null> {
    const apiKey = env.AI_API_KEY;
    if (!apiKey) {
      return null;
    }
    if (env.AI_PROVIDER === 'groq') {
      return callGroq(systemInstruction, prompt, apiKey);
    }

    return callGemini(systemInstruction, prompt, apiKey);
  }
};
