import { ensureFile, appendFile, readFile } from '../utils/fse.js'
import { now } from '../utils/timestamp.js'

const HEADER = `# Decisions Log — grwm
# Append-only. Never edit or delete existing entries.
# Format: - [ISO timestamp] decision text
`

/**
 * Layer 4: Append-only decision log.
 * This is what preserves the "why" across sessions.
 * Every architectural choice, trade-off, and rejection gets recorded here.
 */
export async function appendDecision(
  decisionsFilePath: string,
  decision: string
): Promise<void> {
  await ensureFile(decisionsFilePath)

  // Write header if the file is empty
  const existing = await readFile(decisionsFilePath, 'utf8').catch(() => '')
  if (!existing.trim()) {
    await appendFile(decisionsFilePath, HEADER, 'utf8')
  }

  const entry = `\n- [${now()}] ${decision.trim()}`
  await appendFile(decisionsFilePath, entry, 'utf8')
}

/**
 * Get the last N decision entries from the log.
 */
export async function getRecentDecisions(
  decisionsFilePath: string,
  maxCount: number = 10
): Promise<string[]> {
  try {
    const content = await readFile(decisionsFilePath, 'utf8')
    return content
      .split('\n')
      .filter((l) => l.startsWith('- ['))
      .slice(-maxCount)
  } catch {
    return []
  }
}

/**
 * Get all decisions (for export or summary).
 */
export async function getAllDecisions(
  decisionsFilePath: string
): Promise<string[]> {
  try {
    const content = await readFile(decisionsFilePath, 'utf8')
    return content.split('\n').filter((l) => l.startsWith('- ['))
  } catch {
    return []
  }
}
