import path from 'path'
import { readFile, writeFile, ensureFile, ensureDir, pathExists } from '../utils/fse.js'
import { detectAgents, type DetectedAgents } from '../utils/paths.js'
import type { AgentName } from '../schemas/config.js'

// Idempotent markers — content inside these is replaced on every run
const MARKER_START = '<!-- grwm:handoff:start -->'
const MARKER_END   = '<!-- grwm:handoff:end -->'

/**
 * Replace or append a grwm-managed block in a file.
 * The block is wrapped in HTML comment markers so it can be updated in-place.
 */
async function upsertBlock(filePath: string, content: string): Promise<void> {
  await ensureFile(filePath)
  const existing = await readFile(filePath, 'utf8').catch(() => '')
  const block = `${MARKER_START}\n${content}\n${MARKER_END}`

  if (existing.includes(MARKER_START)) {
    // Replace the existing block
    const re = new RegExp(
      `${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}`,
      'g'
    )
    const updated = existing.replace(re, block)
    await writeFile(filePath, updated, 'utf8')
  } else {
    // Append to file
    const separator = existing.trim() ? '\n\n' : ''
    await writeFile(filePath, existing + separator + block + '\n', 'utf8')
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Format the brief for each agent's expected file format.
 */
function formatBrief(brief: string, agentName: string): string {
  return `## grwm Handoff Context (${agentName})

> **IMPORTANT**: Read this section before starting any work. This is your session briefing.

${brief}

> *This section is auto-managed by [grwm](https://npmjs.com/package/grwm). Do not edit manually.*`
}

// ─── Individual agent writers ─────────────────────────────────────────────────

async function writeClaudeContext(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.claude', 'CONTEXT.md')
  await ensureDir(path.join(projectRoot, '.claude'))
  await upsertBlock(filePath, formatBrief(brief, 'Claude Code'))
  return filePath
}

async function writeCursorRules(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.cursor', 'rules', 'grwm-handoff.mdc')
  await ensureDir(path.join(projectRoot, '.cursor', 'rules'))
  // Cursor .mdc format — YAML frontmatter + content
  const content = `---
description: grwm session handoff context — read at session start
globs: ["**/*"]
alwaysApply: true
---

${formatBrief(brief, 'Cursor')}`
  await writeFile(filePath, content, 'utf8')
  return filePath
}

async function writeWindsurfRules(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.windsurf', 'rules', 'grwm-handoff.md')
  await ensureDir(path.join(projectRoot, '.windsurf', 'rules'))
  await writeFile(filePath, formatBrief(brief, 'Windsurf'), 'utf8')
  return filePath
}

async function writeCopilotInstructions(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.github', 'copilot-instructions.md')
  await ensureDir(path.join(projectRoot, '.github'))
  await upsertBlock(filePath, formatBrief(brief, 'GitHub Copilot'))
  return filePath
}

async function writeClineRules(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.cline', 'rules', 'grwm-handoff.md')
  await ensureDir(path.join(projectRoot, '.cline', 'rules'))
  await writeFile(filePath, formatBrief(brief, 'Cline'), 'utf8')
  return filePath
}

async function writeGeminiContext(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.gemini', 'grwm-context.md')
  await ensureDir(path.join(projectRoot, '.gemini'))
  await writeFile(filePath, formatBrief(brief, 'Gemini Code Assist'), 'utf8')
  return filePath
}

async function writeAiderConventions(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, 'CONVENTIONS.md')
  await upsertBlock(filePath, formatBrief(brief, 'Aider'))
  return filePath
}

async function writeCodexContext(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.codex', 'grwm-context.md')
  await ensureDir(path.join(projectRoot, '.codex'))
  await writeFile(filePath, formatBrief(brief, 'OpenAI Codex'), 'utf8')
  return filePath
}

async function writeContinueContext(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, '.continue', 'grwm-context.md')
  await ensureDir(path.join(projectRoot, '.continue'))
  await writeFile(filePath, formatBrief(brief, 'Continue'), 'utf8')
  return filePath
}

async function writeAgentsMd(brief: string, projectRoot: string): Promise<string> {
  const filePath = path.join(projectRoot, 'AGENTS.md')
  await upsertBlock(filePath, formatBrief(brief, 'All Agents'))
  return filePath
}

// ─── Main broadcast function ─────────────────────────────────────────────────

export interface BroadcastResult {
  filesWritten: string[]
  agentsReached: string[]
  skipped: string[]
}

/**
 * Broadcast the handoff brief to all detected (or specified) agent config files.
 * This is the layer that makes grwm a true universal tool.
 *
 * @param brief - The handoff brief markdown string
 * @param projectRoot - Project root directory
 * @param targetAgent - If specified, write only to this agent. Otherwise auto-detect.
 */
export async function broadcastToAgents(
  brief: string,
  projectRoot: string,
  targetAgent?: AgentName
): Promise<BroadcastResult> {
  const detected = detectAgents(projectRoot)
  const filesWritten: string[] = []
  const agentsReached: string[] = []
  const skipped: string[] = []

  const writers: Record<AgentName, () => Promise<string>> = {
    claude:   () => writeClaudeContext(brief, projectRoot),
    cursor:   () => writeCursorRules(brief, projectRoot),
    windsurf: () => writeWindsurfRules(brief, projectRoot),
    copilot:  () => writeCopilotInstructions(brief, projectRoot),
    cline:    () => writeClineRules(brief, projectRoot),
    aider:    () => writeAiderConventions(brief, projectRoot),
    gemini:   () => writeGeminiContext(brief, projectRoot),
    codex:    () => writeCodexContext(brief, projectRoot),
    continue: () => writeContinueContext(brief, projectRoot),
  }

  // AGENTS.md is always written (universal standard)
  try {
    const p = await writeAgentsMd(brief, projectRoot)
    filesWritten.push(p)
    agentsReached.push('AGENTS.md (universal)')
  } catch (e) {
    console.error('  ⚠ Failed to write AGENTS.md:', (e as Error).message)
  }

  const agentNames = Object.keys(writers) as AgentName[]

  for (const agent of agentNames) {
    // Skip if a specific target agent was requested and this isn't it
    if (targetAgent && agent !== targetAgent) continue

    // Skip if auto-detect mode and this agent wasn't detected in the project
    if (!targetAgent && !detected[agent as keyof DetectedAgents]) {
      skipped.push(agent)
      continue
    }

    try {
      const filePath = await writers[agent]()
      filesWritten.push(filePath)
      agentsReached.push(agent)
    } catch (e) {
      console.error(`  ⚠ Failed to write for ${agent}:`, (e as Error).message)
    }
  }

  return { filesWritten, agentsReached, skipped }
}
