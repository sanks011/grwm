import { requireTrailDir, tasksPath, decisionsPath, readConfig } from '../utils/paths.js'
import { getGitState } from '../layers/git.js'
import { readTasks, writeTasks, findTask } from '../layers/tasks.js'
import { appendDecision } from '../layers/decisions.js'
import { getGraphifyRef } from '../layers/graphify.js'
import { success, warn, info, sectionHeader, bold, cyan, gray, green, yellow } from '../utils/display.js'
import { now } from '../utils/timestamp.js'
import { v4 as uuid } from 'uuid'
import simpleGit from 'simple-git'
import {
  resolveProvider,
  hasAnyRealKey,
  printKeysHint,
  PROVIDERS,
  OPENCODE_BASE_URL,
  OPENCODE_MODEL,
} from '../utils/ai-config.js'

interface ExtractedData {
  tasks: Array<{ title: string; files: string[]; notes: string }>
  decisions: Array<{ text: string }>
}

/**
  * grwm autolog — Automated Context and Handoff Generator
  * Uses the best available AI provider (OpenCode, OpenAI, Anthropic, etc.)
  * or falls back to free public OpenCode gateway, then to Git heuristics.
  */
export async function autolog(): Promise<void> {
  const trailDir = requireTrailDir()
  console.log(sectionHeader('autolog'))

  const projectRoot = process.cwd()
  info('Analyzing active workspace and Git state...')
  const gitState = await getGitState(projectRoot)

  if (!gitState.available) {
    warn('No Git repository detected. grwm autolog requires Git to extract context.')
    return
  }

  const config = await readConfig(trailDir)
  info('Checking for Graphify knowledge graph to enrich autolog...')
  const graph = await getGraphifyRef(projectRoot, config.graphifyPath)

  // Resolve the best available AI provider
  const provider = resolveProvider()

  let result: ExtractedData = { tasks: [], decisions: [] }

  if (provider.source === 'public') {
    info(`No AI API keys detected. Using ${bold('OpenCode Free DeepSeek V4 Flash')} via the public gateway...`)
  } else if (provider.source === 'saved') {
    info(`Using ${bold(provider.def.label)} from saved keys (~/.grwm/keys.json)...`)
  } else {
    info(`Using ${bold(provider.def.label)} (from environment)...`)
  }

  // Anthropic uses a different API shape — keep dedicated function
  if (provider.name === 'anthropic') {
    result = await callAnthropic(projectRoot, gitState, provider.key, graph)
  } else {
    // All others (opencode, openai, deepseek, groq, gemini, custom) use OpenAI-compatible API
    const baseUrl = provider.def.baseUrl ?? OPENCODE_BASE_URL
    const model   = provider.def.model   ?? OPENCODE_MODEL
    result = await callOpenAICompat(projectRoot, gitState, provider.key, graph, baseUrl, model, provider.source === 'public')
  }

  // 2. Write Extracted Data back to grwm tasks and decisions
  if (result.tasks.length === 0 && result.decisions.length === 0) {
    warn('No new completed tasks or decisions could be extracted from recent workspace changes.')
    return
  }

  const tasksFilePath     = tasksPath(trailDir)
  const decisionsFilePath = decisionsPath(trailDir)

  // Write Tasks
  if (result.tasks.length > 0) {
    const tasksFile = await readTasks(tasksFilePath)
    for (const t of result.tasks) {
      const existing = await findTask(tasksFile, t.title)
      if (existing) {
        existing.status       = 'done'
        existing.files_touched = Array.from(new Set([...(existing.files_touched || []), ...t.files]))
        existing.notes        = t.notes
        existing.updatedAt    = now()
        success(`Auto-updated existing task: ${bold(existing.title)} → status: ${green('done')}`)
      } else {
        const newTask = {
          id:            uuid(),
          title:         t.title,
          status:        'done' as const,
          createdAt:     now(),
          updatedAt:     now(),
          files_touched: t.files,
          notes:         t.notes,
        }
        tasksFile.tasks.push(newTask)
        success(`Auto-created completed task: ${bold(newTask.title)} → status: ${green('done')}`)
      }
    }
    await writeTasks(tasksFilePath, tasksFile)
  }

  // Write Decisions
  if (result.decisions.length > 0) {
    for (const d of result.decisions) {
      await appendDecision(decisionsFilePath, d.text)
      success(`Auto-logged decision: ${cyan(d.text)}`)
    }
  }

  console.log(`\n${green('✓')} ${bold('grwm autolog complete!')}`)
  console.log(`  Run ${cyan('grwm status')} or ${cyan('grwm handoff')} to compile your updated brief.\n`)
}

// ─── OpenAI-compatible call (OpenCode, OpenAI, DeepSeek, Groq, etc.) ──────────

async function callOpenAICompat(
  projectRoot: string,
  gitState: any,
  apiKey: string,
  graph: any,
  baseUrl: string,
  model: string,
  isPublic: boolean,
): Promise<ExtractedData> {
  const git = simpleGit(projectRoot)
  let rawDiff = ''
  try {
    rawDiff = await git.diff()
    if (rawDiff.length > 20000) rawDiff = rawDiff.slice(0, 20000) + '\n...(truncated due to size)'
  } catch {
    rawDiff = 'No uncommitted changes.'
  }

  const prompt = getAutologPrompt(rawDiff, gitState.recentCommits, graph)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data: any = await response.json()
    const content   = data.choices?.[0]?.message?.content || ''
    return JSON.parse(content.trim())

  } catch (err: any) {
    // If using the public gateway and it failed, show the setup hint
    if (isPublic && !hasAnyRealKey()) {
      warn(`OpenCode public gateway unreachable: ${err.message}`)
      printKeysHint()
    } else {
      warn(`AI API request failed: ${err.message}. Falling back to Git heuristics...`)
    }
    return parseGitHeuristics(projectRoot, gitState)
  }
}

// ─── Anthropic Claude (dedicated call — different API shape) ──────────────────

async function callAnthropic(
  projectRoot: string,
  gitState: any,
  apiKey: string,
  graph: any,
): Promise<ExtractedData> {
  const git = simpleGit(projectRoot)
  let rawDiff = ''
  try {
    rawDiff = await git.diff()
    if (rawDiff.length > 20000) rawDiff = rawDiff.slice(0, 20000) + '\n...(truncated due to size)'
  } catch {
    rawDiff = 'No uncommitted changes.'
  }

  const prompt = getAutologPrompt(rawDiff, gitState.recentCommits, graph)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data: any   = await response.json()
    const rawContent  = data.content?.[0]?.text || ''
    const jsonMatch   = rawContent.match(/\{[\s\S]*\}/)
    const jsonStr     = jsonMatch ? jsonMatch[0] : rawContent
    return JSON.parse(jsonStr.trim())

  } catch (err: any) {
    warn(`Anthropic API request failed: ${err.message}. Falling back to Git heuristics...`)
    return parseGitHeuristics(projectRoot, gitState)
  }
}

// ─── Zero-cost offline Git Heuristics Parser ──────────────────────────────────

async function parseGitHeuristics(projectRoot: string, gitState: any): Promise<ExtractedData> {
  const git    = simpleGit(projectRoot)
  const result: ExtractedData = { tasks: [], decisions: [] }

  try {
    if (gitState.changedFiles.length > 0) {
      const changedDesc = gitState.changedFiles.join(', ')
      result.tasks.push({
        title: 'Work in progress uncommitted changes',
        files: gitState.changedFiles,
        notes: `Currently modified active files: ${changedDesc}`,
      })
    }

    const log = await git.log({ maxCount: 3 })
    for (const commit of log.all) {
      const title        = commit.message.trim()
      const cleanedTitle = title.replace(/^(feat|fix|refactor|chore|docs|style|test)(\(.*?\))?!?\s*:\s*/i, '')
      if (!cleanedTitle) continue

      let files: string[] = []
      try {
        const showOutput = await git.show(['--name-only', '--format=', commit.hash])
        files = showOutput.trim().split('\n').map(f => f.trim()).filter(Boolean)
      } catch {}

      result.tasks.push({
        title:  cleanedTitle,
        files:  files.slice(0, 15),
        notes:  `Extracted automatically from Git commit ${commit.hash.slice(0, 7)}: "${commit.message}"`,
      })

      if (commit.body) {
        const lines = commit.body.split('\n').map(l => l.trim()).filter(Boolean)
        for (const line of lines) {
          if (/^(chose|decided|selected|because|decision|tech choice)/i.test(line)) {
            result.decisions.push({ text: line })
          }
        }
      }
    }
  } catch (e: any) {
    warn(`Git heuristics parsing failed: ${e.message}`)
  }

  return result
}

// ─── Prompt builder ────────────────────────────────────────────────────────────

function getAutologPrompt(rawDiff: string, recentCommits: string[], graph?: any): string {
  const commitsText = recentCommits.map(c => `- ${c}`).join('\n')

  let graphContext = ''
  if (graph && graph.available && graph.topNodes.length > 0) {
    graphContext = `
REPOSITORY ARCHITECTURAL CONTEXT (Graphify Knowledge Graph):
- Key codebase nodes/components detected: ${graph.topNodes.join(', ')}
Please associate the files and changes with these high-level components if applicable.
`
  }

  return `You are a professional context-engineering AI assistant.
Analyze the following git diff of uncommitted changes and recent commit messages:
${graphContext}
UNCOMMITTED CHANGES DIFF:
${rawDiff}

RECENT COMMITS:
${commitsText}

Extract:
1. Active tasks that were successfully completed. Group them under a descriptive title (e.g. "implement JWT middleware"). For each task, list the relative file paths that were modified.
2. Key architectural decisions made, tech choices explained, or logical design constraints (e.g. "JWT is stored in HTTPOnly cookie to prevent XSS").

Return your response inside a single, strictly valid JSON block matching this typescript interface:
{
  "tasks": Array<{ title: string; files: string[]; notes: string }>,
  "decisions": Array<{ text: string }>
}

Return ONLY the raw JSON object. Do not include markdown code block formatting (no \`\`\`json). Just the raw JSON.`
}
