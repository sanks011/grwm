/**
 * grwm — Get Ready With Me
 * Universal AI agent handoff tool
 *
 * Public programmatic API for embedding grwm in other tools.
 */

// ─── Layers ───────────────────────────────────────────────────────────────────
export { checkTrigger, isHandoffStale }      from './layers/trigger.js'
export { getGitState }                        from './layers/git.js'
export { getGraphifyRef }                     from './layers/graphify.js'
export { readTasks, addTask, updateTaskStatus } from './layers/tasks.js'
export { appendDecision, getRecentDecisions } from './layers/decisions.js'
export { indexClaudeSessions }               from './layers/sessions.js'
export { compileHandoffBrief }               from './layers/brief.js'
export { broadcastToAgents }                 from './layers/broadcast.js'

// ─── Types ────────────────────────────────────────────────────────────────────
export type { Task, TaskStatus, TasksFile }  from './schemas/task.js'
export type { Config, AgentName }            from './schemas/config.js'
export type { GitState }                     from './layers/git.js'
export type { GraphifyRef }                  from './layers/graphify.js'
export type { BroadcastResult }              from './layers/broadcast.js'
export type { TriggerState }                 from './layers/trigger.js'

// ─── Utils ────────────────────────────────────────────────────────────────────
export { findTrailDir, detectAgents }        from './utils/paths.js'
export { estimateTokens }                    from './utils/tokens.js'
