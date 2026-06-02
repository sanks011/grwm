import { requireTrailDir, getProjectRoot, readConfig, handoffPath } from '../utils/paths.js'
import { compileHandoffBrief } from '../layers/brief.js'
import { broadcastToAgents } from '../layers/broadcast.js'
import { indexClaudeSessions } from '../layers/sessions.js'
import { ensureGraphify, isGraphifyInstalled, runGraphify } from '../utils/graphify-check.js'
import { success, warn, info, sectionHeader, bold, cyan, green, yellow, gray } from '../utils/display.js'
import type { AgentName } from '../schemas/config.js'

interface HandoffOptions {
  indexSessions?: boolean
  agent?: string
  installGraphify?: boolean
  graph?: boolean
}

export async function handoff(options: HandoffOptions = {}): Promise<void> {
  const trailDir = requireTrailDir()
  const projectRoot = getProjectRoot(trailDir)
  const config = await readConfig(trailDir)

  console.log(sectionHeader('handoff — Get Ready With Me'))

  // Auto-install graphify if requested
  if (options.installGraphify) {
    await ensureGraphify(projectRoot, true, true)
  } else if (options.graph) {
    // --graph flag: run graphify (must already be installed)
    if (isGraphifyInstalled()) {
      info('Running graphify to update code graph...')
      const ok = runGraphify(projectRoot)
      if (ok) success('Code graph updated → graphify-out/graph.json')
      else warn('graphify failed — check your project root')
    } else {
      warn('graphify not installed. Run: pip install graphifyy && graphify install')
      warn('Or use: grwm handoff --install-graphify')
    }
  }

  // Layer 5: Session indexing (opt-in, Claude Code only)
  if (options.indexSessions || config.autoIndexSessions) {
    info(`Running Claude Code session indexing...`)
    const { decisions, sessionCount } = await indexClaudeSessions(
      projectRoot,
      trailDir + '/session-index.json'
    )
    if (sessionCount > 0) {
      success(`Indexed ${sessionCount} sessions → ${decisions.length} decisions extracted`)
    }
  }

  // Layer 6: Compile handoff brief
  info(`Compiling handoff brief...`)
  const { brief, tokens, outputPath } = await compileHandoffBrief(
    projectRoot,
    trailDir,
    config.graphifyPath,
    config.maxHandoffTokens
  )

  success(`Brief compiled: ${bold(outputPath)}`)

  if (tokens > config.maxHandoffTokens) {
    warn(`Brief is ${tokens} tokens (target: ≤${config.maxHandoffTokens}) — consider marking older tasks as done`)
  } else {
    info(`Token estimate: ${cyan(String(tokens))} / ${config.maxHandoffTokens}`)
  }

  // Broadcast: write to all detected agent configs
  info(`Broadcasting to agent configs...`)

  const targetAgent = options.agent as AgentName | undefined
  const { filesWritten, agentsReached, skipped } = await broadcastToAgents(
    brief,
    projectRoot,
    targetAgent
  )

  console.log()
  console.log(`${green('✓')} Handoff written to ${bold(String(filesWritten.length))} files:`)
  for (const f of filesWritten) {
    const rel = f.replace(projectRoot, '').replace(/\\/g, '/')
    console.log(`  ${cyan('→')} ${rel}`)
  }

  if (skipped.length > 0 && !targetAgent) {
    console.log(`\n${gray(`Skipped (not detected in project): ${skipped.join(', ')}`)  }`)
    console.log(`${gray('  Run `grwm handoff --agent <name>` to write to a specific agent anyway.')}`)
  }

  console.log()
  console.log(`${bold('Next:')} Start a new agent session and run ${cyan('grwm resume')}`)
  console.log()
}

