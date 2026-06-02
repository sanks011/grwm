import { requireTrailDir, tasksPath, decisionsPath, readConfig } from '../utils/paths.js'
import { getGitState } from '../layers/git.js'
import { readTasks, writeTasks, findTask } from '../layers/tasks.js'
import { appendDecision } from '../layers/decisions.js'
import { getGraphifyRef } from '../layers/graphify.js'
import { success, warn, info, sectionHeader, bold, cyan, gray, green } from '../utils/display.js'
import { now } from '../utils/timestamp.js'
import { v4 as uuid } from 'uuid'
import simpleGit from 'simple-git'

interface ExtractedData {
  tasks: Array<{ title: string; files: string[]; notes: string }>
  decisions: Array<{ text: string }>
}

/**
  * grwm autolog — Automated Context and Handoff Generator
  * Uses OpenCode Big Pickle (free), Anthropic Claude, or local Git Heuristics
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

  // 1. Determine which model or parser to use
  const opencodeKey = process.env.OPENCODE_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const config = await readConfig(trailDir)
  info('Checking for Graphify knowledge graph to enrich autolog...')
  const graph = await getGraphifyRef(projectRoot, config.graphifyPath)

  let result: ExtractedData = { tasks: [], decisions: [] }

  if (opencodeKey || (!opencodeKey && !anthropicKey)) {
    const key = opencodeKey || 'public'
    if (key === 'public') {
      info(`No AI API Keys detected. Using ${bold('OpenCode Free Big Pickle')} via the public gateway...`)
    } else {
      info(`Detected ${bold('OpenCode API Key')}! Running free Big Pickle AI autologger...`)
    }
    result = await callOpenCodeBigPickle(projectRoot, gitState, key, graph)
  } else if (anthropicKey) {
    info(`Detected ${bold('Anthropic API Key')}! Running Claude AI autologger...`)
    result = await callAnthropicClaude(projectRoot, gitState, anthropicKey, graph)
  } else {
    info(`Running zero-cost ${bold('Local Git Heuristics Parser')}...`)
    result = await parseGitHeuristics(projectRoot, gitState)
  }

  // 2. Write Extracted Data back to grwm tasks and decisions
  if (result.tasks.length === 0 && result.decisions.length === 0) {
    warn('No new completed tasks or decisions could be extracted from recent workspace changes.')
    return
  }

  const tasksFilePath = tasksPath(trailDir)
  const decisionsFilePath = decisionsPath(trailDir)

  // Write Tasks
  if (result.tasks.length > 0) {
    const tasksFile = await readTasks(tasksFilePath)
    for (const t of result.tasks) {
      const existing = await findTask(tasksFile, t.title)
      if (existing) {
        existing.status = 'done'
        existing.files_touched = Array.from(new Set([...(existing.files_touched || []), ...t.files]))
        existing.notes = t.notes
        existing.updatedAt = now()
        success(`Auto-updated existing task: ${bold(existing.title)} → status: ${green('done')}`)
      } else {
        const newTask = {
          id: uuid(),
          title: t.title,
          status: 'done' as const,
          createdAt: now(),
          updatedAt: now(),
          files_touched: t.files,
          notes: t.notes
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

/** Call OpenCode Big Pickle model (completely free OpenAI compatible endpoint) */
async function callOpenCodeBigPickle(
  projectRoot: string,
  gitState: any,
  apiKey: string,
  graph: any
): Promise<ExtractedData> {
  const git = simpleGit(projectRoot)
  let rawDiff = ''
  try {
    rawDiff = await git.diff()
    if (rawDiff.length > 20000) {
      rawDiff = rawDiff.slice(0, 20000) + '\n...(truncated due to size)'
    }
  } catch {
    rawDiff = 'No uncommitted changes.'
  }

  const prompt = getAutologPrompt(rawDiff, gitState.recentCommits, graph)

  try {
    const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'opencode/big-pickle',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data: any = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    return JSON.parse(content.trim())
  } catch (err: any) {
    warn(`OpenCode API request failed: ${err.message}. Falling back to Git heuristics...`)
    return parseGitHeuristics(projectRoot, gitState)
  }
}

/** Call Anthropic Claude API */
async function callAnthropicClaude(
  projectRoot: string,
  gitState: any,
  apiKey: string,
  graph: any
): Promise<ExtractedData> {
  const git = simpleGit(projectRoot)
  let rawDiff = ''
  try {
    rawDiff = await git.diff()
    if (rawDiff.length > 20000) {
      rawDiff = rawDiff.slice(0, 20000) + '\n...(truncated due to size)'
    }
  } catch {
    rawDiff = 'No uncommitted changes.'
  }

  const prompt = getAutologPrompt(rawDiff, gitState.recentCommits, graph)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const data: any = await response.json()
    const rawContent = data.content?.[0]?.text || ''
    
    // Parse JSON block safely
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : rawContent
    return JSON.parse(jsonStr.trim())
  } catch (err: any) {
    warn(`Anthropic API request failed: ${err.message}. Falling back to Git heuristics...`)
    return parseGitHeuristics(projectRoot, gitState)
  }
}

/** Zero-cost offline local Git Heuristics Parser */
async function parseGitHeuristics(projectRoot: string, gitState: any): Promise<ExtractedData> {
  const git = simpleGit(projectRoot)
  const result: ExtractedData = { tasks: [], decisions: [] }

  try {
    // Parse uncommitted changed files
    if (gitState.changedFiles.length > 0) {
      const changedDesc = gitState.changedFiles.join(', ')
      result.tasks.push({
        title: `Work in progress uncommitted changes`,
        files: gitState.changedFiles,
        notes: `Currently modified active files: ${changedDesc}`
      })
    }

    // Parse the last 3 commits from simpleGit log
    const log = await git.log({ maxCount: 3 })
    for (const commit of log.all) {
      const title = commit.message.trim()
      // Clean standard commit prefixes (feat:, fix:, refactor:, chore:, docs:)
      const cleanedTitle = title.replace(/^(feat|fix|refactor|chore|docs|style|test)(\(.*?\))?!?\s*:\s*/i, '')
      
      if (!cleanedTitle) continue

      // Fetch files touched in this specific commit hash
      let files: string[] = []
      try {
        const showOutput = await git.show(['--name-only', '--format=', commit.hash])
        files = showOutput.trim().split('\n').map(f => f.trim()).filter(Boolean)
      } catch {}

      // Add to completed tasks
      result.tasks.push({
        title: cleanedTitle,
        files: files.slice(0, 15),
        notes: `Extracted automatically from Git commit ${commit.hash.slice(0, 7)}: "${commit.message}"`
      })

      // Extract decisions from body
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

  return result;
}

/** Build rich contextual analysis prompt for LLMs */
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
