import path from 'path'
import { ensureDir, writeJSON, pathExists, ensureFile, readFile, appendFile } from '../utils/fse.js'
import { writeFile } from 'fs/promises'
import { emptyTasksFile } from '../schemas/task.js'
import { defaultConfig } from '../schemas/config.js'
import { detectAgents } from '../utils/paths.js'
import { ensureGraphify } from '../utils/graphify-check.js'
import { success, info, warn, sectionHeader, bold, cyan, green, yellow } from '../utils/display.js'

const DECISIONS_HEADER = `# Decisions Log — grwm
# Append-only. Never edit or delete existing entries.
# Format: - [ISO timestamp] decision text
`

const GRWM_STARTUP_SNIPPET = `
## grwm — Session Startup

At the start of **every new session**, run:
\`\`\`
grwm resume
\`\`\`
This loads task state, decisions, and progress from the last session.
**Do not start work until you have read the handoff brief.**

At the end of a session or when context exceeds 60%:
\`\`\`
grwm handoff
\`\`\`
`

/** Idempotent upsert for agent startup snippets */
async function appendStartupSnippet(filePath: string, agentName: string): Promise<void> {
  const MARKER = '<!-- grwm:startup -->'
  const content = await readFile(filePath, 'utf8').catch(() => '')
  if (content.includes(MARKER)) return // already has the snippet

  const snippet = `\n${MARKER}\n${GRWM_STARTUP_SNIPPET}\n`
  await appendFile(filePath, snippet, 'utf8')
}

export async function init(options: { yes?: boolean } = {}): Promise<void> {
  const cwd = process.cwd()
  const trailDir = path.join(cwd, '.trail')

  console.log(sectionHeader('init'))
  info(`Initializing grwm in ${bold(cwd)}`)

  // 1. Create .trail/ structure
  await ensureDir(trailDir)

  // 2. tasks.json
  const tasksFilePath = path.join(trailDir, 'tasks.json')
  if (!(await pathExists(tasksFilePath))) {
    const projectName = path.basename(cwd)
    await writeJSON(tasksFilePath, emptyTasksFile(projectName), { spaces: 2 })
    success(`Created .trail/tasks.json`)
  } else {
    info(`.trail/tasks.json already exists — skipping`)
  }

  // 3. decisions.md
  const decisionsFilePath = path.join(trailDir, 'decisions.md')
  if (!(await pathExists(decisionsFilePath))) {
    await writeFile(decisionsFilePath, DECISIONS_HEADER, 'utf8')
    success(`Created .trail/decisions.md`)
  } else {
    info(`.trail/decisions.md already exists — skipping`)
  }

  // 4. config.json
  const configFilePath = path.join(trailDir, 'config.json')
  if (!(await pathExists(configFilePath))) {
    const projectName = path.basename(cwd)
    await writeJSON(configFilePath, defaultConfig(projectName), { spaces: 2 })
    success(`Created .trail/config.json`)
  } else {
    info(`.trail/config.json already exists — skipping`)
  }

  // 5. AGENTS.md (universal standard — always create if missing)
  const agentsMdPath = path.join(cwd, 'AGENTS.md')
  if (!(await pathExists(agentsMdPath))) {
    const projectName = path.basename(cwd)
    await writeFile(agentsMdPath, `# ${projectName} — AI Agent Guide\n\nThis file provides context for AI coding agents working in this repository.\n${GRWM_STARTUP_SNIPPET}`, 'utf8')
    success(`Created AGENTS.md`)
  } else {
    await appendStartupSnippet(agentsMdPath, 'All Agents')
    info(`Updated AGENTS.md with grwm startup instructions`)
  }

  // 6. Detect agents and write startup snippets to their config files
  console.log(`\n${cyan('Detecting active AI agents...')}`)
  const detected = detectAgents(cwd)
  const agentFiles: Record<string, string> = {
    claude:   path.join(cwd, 'CLAUDE.md'),
    cursor:   path.join(cwd, '.cursor', 'rules', 'grwm-init.mdc'),
    windsurf: path.join(cwd, '.windsurf', 'rules', 'grwm-init.md'),
    copilot:  path.join(cwd, '.github', 'copilot-instructions.md'),
    cline:    path.join(cwd, '.cline', 'rules', 'grwm-init.md'),
    gemini:   path.join(cwd, '.gemini', 'GEMINI.md'),
  }

  const detectedList: string[] = []
  for (const [agent, isDetected] of Object.entries(detected)) {
    if (isDetected && agentFiles[agent]) {
      detectedList.push(agent)
      await ensureFile(agentFiles[agent])
      await appendStartupSnippet(agentFiles[agent], agent)
    }
  }

  if (detectedList.length > 0) {
    success(`Wrote startup instructions to: ${detectedList.join(', ')}`)
  } else {
    info(`No specific agent configs detected — AGENTS.md is your universal entry point`)
  }

  // Check for graphify
  console.log()
  await ensureGraphify(cwd, false, false)

  console.log(`\n${green('✓')} ${bold('grwm initialized!')}`)
  console.log(`\nNext steps:`)
  console.log(`  ${cyan('grwm add "your first task"')}   — add a task`)
  console.log(`  ${cyan('grwm log "your first decision"')} — log a decision`)
  console.log(`  ${cyan('grwm handoff')}                  — generate handoff brief`)
  console.log(`  ${cyan('grwm --help')}                   — see all commands`)
  console.log()
}
