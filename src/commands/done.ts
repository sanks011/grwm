import { requireTrailDir, tasksPath } from '../utils/paths.js'
import { updateTaskStatus } from '../layers/tasks.js'
import { success, sectionHeader, bold, green } from '../utils/display.js'

interface DoneOptions {
  files?: string
  notes?: string
}

export async function done(titleOrId: string, options: DoneOptions = {}): Promise<void> {
  const trailDir = requireTrailDir()
  console.log(sectionHeader('done'))

  const filesTouched = options.files
    ? options.files.split(',').map((f) => f.trim()).filter(Boolean)
    : []

  const task = await updateTaskStatus(tasksPath(trailDir), titleOrId, 'done', {
    files_touched: filesTouched,
    notes: options.notes,
  })

  success(`${green('✓')} Marked done: ${bold(task.title)}`)
  if (filesTouched.length > 0) {
    console.log(`  Files: ${filesTouched.join(', ')}`)
  }
  console.log()
}
