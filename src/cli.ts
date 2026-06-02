import { Command } from 'commander'
import { init }    from './commands/init.js'
import { add }     from './commands/add.js'
import { log }     from './commands/log.js'
import { done }    from './commands/done.js'
import { blocked } from './commands/blocked.js'
import { handoff } from './commands/handoff.js'
import { resume }  from './commands/resume.js'
import { status }  from './commands/status.js'
import { grwmBanner, errorMsg } from './utils/display.js'

const program = new Command()

program
  .name('grwm')
  .description(
    'Get Ready With Me — the universal AI agent handoff tool.\n' +
    'Never explain your codebase to a new agent again.'
  )
  .version('0.1.6', '-v, --version')
  .addHelpText('after', `
Examples:
  $ grwm init                          Initialize in current project
  $ grwm add "implement auth module"   Add a task
  $ grwm log "chose JWT over sessions" Log an architectural decision
  $ grwm done "auth module" --files "src/auth.ts"
  $ grwm blocked "payments" --reason "Stripe API key not provisioned"
  $ grwm handoff                       Generate handoff → writes to ALL agent configs
  $ grwm handoff --agent cursor        Write only to Cursor
  $ grwm handoff --graph               Re-run graphify before generating brief
  $ grwm handoff --install-graphify    Auto-install graphify (pip install graphifyy) + generate
  $ grwm handoff --index-sessions      Include Claude Code session analysis
  $ grwm resume                        Print handoff brief (run at session start)
  $ grwm status                        Show task board

Knowledge graph (optional but recommended):
  Install graphify: pip install graphifyy && graphify install
  Generate graph:   graphify .
  grwm then reads graphify-out/graph.json and includes code graph context in every brief.
  Achieves up to 71.5x token reduction. MIT License. Python 3.10+ required.

Supported agents: Claude Code, Cursor, Windsurf, GitHub Copilot, Cline, Aider, Gemini, Codex, Continue
`)

// ─── Commands ─────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize grwm in the current project. Creates .trail/ and writes startup instructions to all detected AI agent configs.')
  .action(async () => {
    try { await init() }
    catch (e) { handleError(e) }
  })

program
  .command('add <title>')
  .description('Add a new task (status: queued)')
  .action(async (title: string) => {
    try { await add(title) }
    catch (e) { handleError(e) }
  })

program
  .command('log <decision>')
  .description('Append a decision to the append-only decision log')
  .action(async (decision: string) => {
    try { await log(decision) }
    catch (e) { handleError(e) }
  })

program
  .command('done <task>')
  .description('Mark a task as done (by title substring or ID)')
  .option('--files <files>', 'Comma-separated list of files touched', '')
  .option('--notes <notes>', 'Optional notes to attach')
  .action(async (task: string, options: { files?: string; notes?: string }) => {
    try { await done(task, options) }
    catch (e) { handleError(e) }
  })

program
  .command('blocked <task>')
  .description('Mark a task as blocked (by title substring or ID)')
  .option('--reason <reason>', 'Why the task is blocked')
  .action(async (task: string, options: { reason?: string }) => {
    try { await blocked(task, options) }
    catch (e) { handleError(e) }
  })

program
  .command('handoff')
  .description('Compile handoff brief and broadcast to all detected AI agent configs')
  .option('--index-sessions', 'Include Claude Code session analysis (requires ANTHROPIC_API_KEY)')
  .option('--agent <agent>', 'Write only to a specific agent (claude|cursor|windsurf|copilot|cline|aider|gemini|codex|continue)')
  .option('--graph', 'Re-run graphify to refresh the knowledge graph before generating brief')
  .option('--install-graphify', 'Auto-install graphify (pip install graphifyy) and generate graph')
  .action(async (options: { indexSessions?: boolean; agent?: string; graph?: boolean; installGraphify?: boolean }) => {
    try { await handoff(options) }
    catch (e) { handleError(e) }
  })

program
  .command('resume')
  .description('Print the handoff brief (run this at the start of every new agent session)')
  .action(async () => {
    try { await resume() }
    catch (e) { handleError(e) }
  })

program
  .command('status')
  .description('Show the current task board and recent decisions')
  .action(async () => {
    try { await status() }
    catch (e) { handleError(e) }
  })

// ─── Global error handler ─────────────────────────────────────────────────────

function handleError(e: unknown): never {
  if (e instanceof Error) {
    errorMsg(e.message)
  } else {
    errorMsg(String(e))
  }
  process.exit(1)
}

program.parse()
