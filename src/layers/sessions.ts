import { createReadStream } from 'fs'
import { readdir, readJSON, writeJSON, ensureFile } from '../utils/fse.js'
import readline from 'readline'
import path from 'path'
import { claudeSessionDir } from '../utils/paths.js'

interface JsonlEntry {
  type?: string
  role?: string
  content?: string | Array<{ type: string; text?: string }>
}

async function readJsonlFile(filePath: string): Promise<JsonlEntry[]> {
  const entries: JsonlEntry[] = []
  try {
    const rl = readline.createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    })
    for await (const line of rl) {
      if (!line.trim()) continue
      try { entries.push(JSON.parse(line)) } catch { /* skip malformed lines */ }
    }
  } catch { /* file unreadable */ }
  return entries
}

function extractText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text ?? '')
    .join('\n')
}

/**
 * Layer 5: Claude Code session indexer (opt-in).
 *
 * Reads the last 5 Claude Code JSONL session files for this project,
 * makes a single claude-haiku call to extract key technical decisions,
 * and writes them to .trail/session-index.json.
 *
 * Degrades gracefully if:
 * - ANTHROPIC_API_KEY is not set
 * - No session files found
 * - @anthropic-ai/sdk is not installed
 */
export async function indexClaudeSessions(
  projectRoot: string,
  sessionIndexPath: string
): Promise<{ decisions: string[]; sessionCount: number }> {
  const empty = { decisions: [], sessionCount: 0 }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('  ℹ No ANTHROPIC_API_KEY — skipping Claude session indexing')
    return empty
  }

  // Dynamic import so missing package doesn't crash the tool
  let Anthropic: typeof import('@anthropic-ai/sdk').default
  try {
    const mod = await import('@anthropic-ai/sdk')
    Anthropic = mod.default
  } catch {
    console.log('  ℹ @anthropic-ai/sdk not installed — skipping session indexing')
    return empty
  }

  const sessionDir = claudeSessionDir(projectRoot)
  let sessionFiles: string[] = []
  try {
    const files = await readdir(sessionDir)
    sessionFiles = files
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .slice(-5) // last 5 sessions only
      .map((f) => path.join(sessionDir, f))
  } catch {
    console.log('  ℹ No Claude Code sessions found for this project')
    return empty
  }

  if (sessionFiles.length === 0) return empty

  const messages: string[] = []
  for (const file of sessionFiles) {
    const entries = await readJsonlFile(file)
    for (const e of entries) {
      if (e.role === 'assistant' && e.content) {
        const text = extractText(e.content).slice(0, 600)
        if (text.trim()) messages.push(text)
      }
    }
  }

  if (messages.length === 0) return empty

  const client = new Anthropic()
  let decisions: string[] = []

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Extract key technical decisions from these AI coding session messages.
Return ONLY a valid JSON array of short strings. No preamble, no markdown.
Format: ["decision 1", "decision 2", ...]
Focus on: architecture choices, rejected alternatives, non-obvious constraints, tech stack decisions.
Ignore: routine code explanations, bug fixes, test runs.
Maximum 8 items.`,
      messages: [
        {
          role: 'user',
          content: messages.join('\n---\n').slice(0, 10_000),
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '[]'
    decisions = JSON.parse(text.replace(/```json|```/g, '').trim())
    if (!Array.isArray(decisions)) decisions = []
  } catch (e) {
    console.error('  ⚠ Session indexing failed:', (e as Error).message)
    return empty
  }

  await ensureFile(sessionIndexPath)
  await writeJSON(
    sessionIndexPath,
    { decisions, indexedAt: new Date().toISOString(), sessionCount: sessionFiles.length },
    { spaces: 2 }
  )

  return { decisions, sessionCount: sessionFiles.length }
}
