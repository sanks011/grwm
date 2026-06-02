import { requireTrailDir, tasksPath } from '../utils/paths.js'
import { updateTaskStatus } from '../layers/tasks.js'
import { success, warn, sectionHeader, bold, red } from '../utils/display.js'

interface BlockedOptions {
  reason?: string
}

export async function blocked(titleOrId: string, options: BlockedOptions = {}): Promise<void> {
  const trailDir = requireTrailDir()
  console.log(sectionHeader('blocked'))

  if (!options.reason) {
    warn('No reason provided — use --reason "..." to document why this is blocked')
  }

  const task = await updateTaskStatus(tasksPath(trailDir), titleOrId, 'blocked', {
    blocked_reason: options.reason ?? 'unspecified',
  })

  success(`${red('✗')} Marked blocked: ${bold(task.title)}`)
  if (options.reason) {
    console.log(`  Reason: ${options.reason}`)
  }
  console.log()
}
