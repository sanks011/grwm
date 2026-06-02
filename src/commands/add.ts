import { requireTrailDir, tasksPath } from '../utils/paths.js'
import { addTask } from '../layers/tasks.js'
import { success, sectionHeader, bold, cyan } from '../utils/display.js'

export async function add(title: string): Promise<void> {
  const trailDir = requireTrailDir()
  console.log(sectionHeader('add'))

  const task = await addTask(tasksPath(trailDir), title)
  success(`Added task: ${bold(task.title)}`)
  console.log(`  ID: ${cyan(task.id)}`)
  console.log(`  Status: queued`)
  console.log()
}
