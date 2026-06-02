import { requireTrailDir, tasksPath, decisionsPath, getProjectRoot } from '../utils/paths.js'
import { readTasks } from '../layers/tasks.js'
import { getRecentDecisions } from '../layers/decisions.js'
import { getGitState } from '../layers/git.js'
import {
  sectionHeader,
  statusBadge,
  bold,
  cyan,
  green,
  yellow,
  red,
  gray,
  dim,
} from '../utils/display.js'

export async function status(): Promise<void> {
  const trailDir = requireTrailDir()
  const projectRoot = getProjectRoot(trailDir)

  console.log(sectionHeader('status'))

  const [tasksFile, decisions, git] = await Promise.all([
    readTasks(tasksPath(trailDir)),
    getRecentDecisions(decisionsPath(trailDir), 5),
    getGitState(projectRoot),
  ])

  const { tasks, projectName } = tasksFile

  // ─── Header ───────────────────────────────────────────────────────────────
  console.log(`  Project: ${bold(projectName || 'unnamed')}`)
  if (git.available) {
    console.log(`  Branch:  ${cyan(git.branch)} | ${gray(git.lastCommitHash + ' ' + git.lastCommitMessage)}`)
  }
  console.log()

  // ─── Counts ───────────────────────────────────────────────────────────────
  const counts = {
    queued:      tasks.filter((t) => t.status === 'queued').length,
    'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
    done:        tasks.filter((t) => t.status === 'done').length,
    blocked:     tasks.filter((t) => t.status === 'blocked').length,
  }

  console.log(`  ${gray('○')} Queued:      ${counts['queued']}`)
  console.log(`  ${cyan('◎')} In Progress: ${counts['in-progress']}`)
  console.log(`  ${green('✓')} Done:        ${counts['done']}`)
  console.log(`  ${red('✗')} Blocked:     ${counts['blocked']}`)
  console.log()

  // ─── In-progress tasks ────────────────────────────────────────────────────
  const inProgress = tasks.filter((t) => t.status === 'in-progress')
  if (inProgress.length > 0) {
    console.log(`  ${bold(cyan('Active:'))}`)
    for (const t of inProgress) {
      console.log(`    ${cyan('◎')} ${t.title}`)
      if (t.notes) console.log(`       ${dim(t.notes)}`)
    }
    console.log()
  }

  // ─── Blocked tasks ────────────────────────────────────────────────────────
  const blockedTasks = tasks.filter((t) => t.status === 'blocked')
  if (blockedTasks.length > 0) {
    console.log(`  ${bold(red('Blocked:'))}`)
    for (const t of blockedTasks) {
      console.log(`    ${red('✗')} ${t.title}`)
      if (t.blocked_reason) console.log(`       ${dim('Reason: ' + t.blocked_reason)}`)
    }
    console.log()
  }

  // ─── Queued tasks ─────────────────────────────────────────────────────────
  const queued = tasks.filter((t) => t.status === 'queued')
  if (queued.length > 0) {
    console.log(`  ${bold('Up next:')}`)
    for (const t of queued.slice(0, 5)) {
      console.log(`    ${gray('○')} ${t.title}`)
    }
    if (queued.length > 5) console.log(`    ${dim(`... and ${queued.length - 5} more`)}`)
    console.log()
  }

  // ─── Recent decisions ─────────────────────────────────────────────────────
  if (decisions.length > 0) {
    console.log(`  ${bold('Recent decisions:')}`)
    for (const d of decisions.slice(-3)) {
      console.log(`  ${dim(d)}`)
    }
    console.log()
  }

  // ─── Quick hints ──────────────────────────────────────────────────────────
  if (tasks.length === 0) {
    console.log(`  ${dim('No tasks yet. Run:')} ${cyan('grwm add "your task"')}`)
  } else if (counts['in-progress'] === 0 && counts['queued'] > 0) {
    console.log(`  ${dim('Tip: Mark a task in-progress:')} ${cyan(`grwm start "${queued[0]?.title}"`)}`)
  }
  console.log()
}
