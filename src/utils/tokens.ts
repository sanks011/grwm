/** Rough token estimate: 1 token ≈ 4 characters */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Slice text to fit within a token budget.
 * Keeps the end of the text (most recent content is most valuable).
 */
export function budgetSlice(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return text
  return '...(truncated)\n' + text.slice(text.length - maxChars)
}

/**
 * Slice an array to fit within a token budget.
 * Removes items from the front (oldest first).
 */
export function budgetArray(items: string[], maxTokens: number): string[] {
  const result: string[] = []
  let used = 0
  for (let i = items.length - 1; i >= 0; i--) {
    const cost = estimateTokens(items[i])
    if (used + cost > maxTokens) break
    result.unshift(items[i])
    used += cost
  }
  return result
}
