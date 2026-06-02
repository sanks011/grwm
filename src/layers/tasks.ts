import { readJSON, writeJSON, ensureFile } from '../utils/fse.js'
import { v4 as uuid } from 'uuid'
import { TasksFileSchema, emptyTasksFile, type Task, type TaskStatus, type TasksFile } from '../schemas/task.js'
import { now } from '../utils/timestamp.js'

// ─── Read / Write ─────────────────────────────────────────────────────────────

export async function readTasks(tasksFilePath: string): Promise<TasksFile> {
  await ensureFile(tasksFilePath)
  try {
    const raw = await readJSON(tasksFilePath)
    return TasksFileSchema.parse(raw)
  } catch {
    return emptyTasksFile('')
  }
}

export async function writeTasks(tasksFilePath: string, data: TasksFile): Promise<void> {
  // Validate before writing — never corrupt the file
  const validated = TasksFileSchema.parse({ ...data, lastUpdated: now() })
  await writeJSON(tasksFilePath, validated, { spaces: 2 })
}

// ─── Task operations ──────────────────────────────────────────────────────────

export async function addTask(
  tasksFilePath: string,
  title: string
): Promise<Task> {
  const file = await readTasks(tasksFilePath)
  const task: Task = {
    id: uuid(),
    title,
    status: 'queued',
    createdAt: now(),
    updatedAt: now(),
    files_touched: [],
  }
  file.tasks.push(task)
  await writeTasks(tasksFilePath, file)
  return task
}

export async function findTask(
  file: TasksFile,
  titleOrId: string
): Promise<Task | undefined> {
  const lower = titleOrId.toLowerCase()
  // Exact ID match first, then substring of title
  return (
    file.tasks.find((t) => t.id === titleOrId) ??
    file.tasks.find((t) => t.title.toLowerCase().includes(lower))
  )
}

export async function updateTaskStatus(
  tasksFilePath: string,
  titleOrId: string,
  status: TaskStatus,
  extras: Partial<Pick<Task, 'files_touched' | 'blocked_reason' | 'notes' | 'agent'>> = {}
): Promise<Task> {
  const file = await readTasks(tasksFilePath)
  const task = await findTask(file, titleOrId)
  if (!task) throw new Error(`Task not found: "${titleOrId}"`)

  Object.assign(task, { ...extras, status, updatedAt: now() })
  await writeTasks(tasksFilePath, file)
  return task
}

export async function setProjectName(
  tasksFilePath: string,
  projectName: string
): Promise<void> {
  const file = await readTasks(tasksFilePath)
  file.projectName = projectName
  await writeTasks(tasksFilePath, file)
}
