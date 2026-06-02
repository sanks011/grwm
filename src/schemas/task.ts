import { z } from 'zod'

// ─── Task ────────────────────────────────────────────────────────────────────

export const TaskStatusSchema = z.enum(['queued', 'in-progress', 'done', 'blocked'])

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: TaskStatusSchema,
  /** Which agent/session last touched this task */
  agent: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Relative paths from project root */
  files_touched: z.array(z.string()).default([]),
  /** Required when status === 'blocked' */
  blocked_reason: z.string().optional(),
  /** Free-form notes visible in the handoff brief */
  notes: z.string().optional(),
})

export const TasksFileSchema = z.object({
  version: z.literal(1),
  projectName: z.string(),
  tasks: z.array(TaskSchema),
  lastUpdated: z.string().datetime(),
})

export type TaskStatus = z.infer<typeof TaskStatusSchema>
export type Task = z.infer<typeof TaskSchema>
export type TasksFile = z.infer<typeof TasksFileSchema>

export function emptyTasksFile(projectName: string): TasksFile {
  return {
    version: 1,
    projectName,
    tasks: [],
    lastUpdated: new Date().toISOString(),
  }
}
