import { stat } from 'fs/promises'

export interface TriggerState {
  shouldHandoff: boolean
  reason: string
  contextUsedPct: number
}

/**
 * Check if a handoff should be triggered based on token usage.
 * Call with usage from API response headers.
 *
 * @param inputTokens - Tokens used so far in this session
 * @param contextWindowSize - Total context window size (default: 200k for Claude Sonnet)
 * @param threshold - Fraction at which to recommend handoff (default: 0.60)
 */
export function checkTrigger(
  inputTokens: number,
  contextWindowSize: number = 200_000,
  threshold: number = 0.60
): TriggerState {
  const pct = inputTokens / contextWindowSize
  const pctRounded = Math.round(pct * 100)

  if (pct >= threshold) {
    return {
      shouldHandoff: true,
      reason: `Context at ${pctRounded}% of window — run \`grwm handoff\` before continuing`,
      contextUsedPct: pctRounded,
    }
  }

  return {
    shouldHandoff: false,
    reason: `Context healthy at ${pctRounded}%`,
    contextUsedPct: pctRounded,
  }
}

/**
 * Check if the handoff.md file is stale (older than maxAgeMinutes).
 * If it doesn't exist, it's considered stale.
 */
export async function isHandoffStale(
  handoffFilePath: string,
  maxAgeMinutes: number = 30
): Promise<boolean> {
  try {
    const { mtimeMs } = await stat(handoffFilePath)
    const ageMinutes = (Date.now() - mtimeMs) / 60_000
    return ageMinutes > maxAgeMinutes
  } catch {
    return true // file doesn't exist
  }
}
