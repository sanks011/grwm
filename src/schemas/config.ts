import { z } from 'zod'

export const AgentNameSchema = z.enum([
  'claude',
  'cursor',
  'windsurf',
  'copilot',
  'cline',
  'aider',
  'gemini',
  'codex',
  'continue',
])

export const ConfigSchema = z.object({
  version: z.literal(1),
  projectName: z.string(),

  /** Path to graphify graph output relative to project root */
  graphifyPath: z.string().default('graphify-out/graph.json'),

  /** Max tokens for handoff brief (rough estimate: chars / 4) */
  maxHandoffTokens: z.number().int().positive().default(2000),

  /** Context window % threshold that triggers handoff warning (0–1) */
  triggerThreshold: z.number().min(0).max(1).default(0.60),

  /** Whether to run session indexing automatically on handoff (requires ANTHROPIC_API_KEY) */
  autoIndexSessions: z.boolean().default(false),

  /** Which agents to broadcast to. 'auto' = detect from project structure */
  broadcastTo: z.union([z.literal('auto'), z.array(AgentNameSchema)]).default('auto'),
})

export type AgentName = z.infer<typeof AgentNameSchema>
export type Config = z.infer<typeof ConfigSchema>

export function defaultConfig(projectName: string): Config {
  return ConfigSchema.parse({
    version: 1,
    projectName,
    graphifyPath: 'graphify-out/graph.json',
    maxHandoffTokens: 2000,
    triggerThreshold: 0.60,
    autoIndexSessions: false,
    broadcastTo: 'auto',
  })
}
