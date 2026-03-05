// Helper functions are now in types.ts
// This file is kept for backwards compatibility if needed

export function logError(context: string, error: unknown): void {
  console.error(`[TrueFocus] ${context}:`, error);
}

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
