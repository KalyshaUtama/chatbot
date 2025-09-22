// types.ts
export interface LLMRequest {
  systemPrompt: string;
  userInput: string;
}

export interface LLMResponse {
  text: string;
}

// safety.ts
// A simple safety filter to detect prompt injection attempts
export function sanitizeInput(input: string): string | null {
  const injectionPatterns = [
    /ignore (all )?previous instructions/i,
    /reveal (your )?(api key|password|secret)/i,
    /execute/i,
    /run this/i,
    /system prompt/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(input)) return null; // Unsafe input
  }

  // Optionally: remove dangerous characters
  return input.replace(/[`$<>]/g, '');
}