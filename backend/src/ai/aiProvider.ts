import { env } from '../config/env';

export const aiProvider = {
  async callGemini(systemInstruction: string, prompt: string): Promise<any | null> {
    const apiKey = env.AI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = env.AI_MODEL || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: { text: systemInstruction }
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
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[AI Provider] API returned ${response.status}: ${response.statusText}`);
      return null;
    }

    const json = await response.json();

    // Check structure of Gemini response
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
};
