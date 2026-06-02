import path from 'path'
import { existsSync } from 'fs'
import { readJSON } from '../utils/fse.js'
import { ConfigSchema, defaultConfig, type Config } from '../schemas/config.js'
import os from 'os'

const TRAIL_DIR = '.trail'

/**
 * Walk up the directory tree from cwd until we find a .trail/ directory.
 * Like how git finds the .git directory.
 */
export function findTrailDir(startDir: string = process.cwd()): string | null {
  let dir = startDir
  while (true) {
    const candidate = path.join(dir, TRAIL_DIR)
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null // reached filesystem root
    dir = parent
  }
}

/**
 * Get or throw the .trail/ directory, starting from cwd.
 */
export function requireTrailDir(): string {
  const trailDir = findTrailDir()
  if (!trailDir) {
    throw new Error(
      'No .trail/ directory found. Run `grwm init` in your project root first.'
    )
  }
  return trailDir
}

/**
 * Get the project root (parent of .trail/).
 */
export function getProjectRoot(trailDir: string): string {
  return path.dirname(trailDir)
}

// ─── Standard file paths inside .trail/ ──────────────────────────────────────

export function tasksPath(trailDir: string): string {
  return path.join(trailDir, 'tasks.json')
}

export function decisionsPath(trailDir: string): string {
  return path.join(trailDir, 'decisions.md')
}

export function handoffPath(trailDir: string): string {
  return path.join(trailDir, 'handoff.md')
}

export function sessionIndexPath(trailDir: string): string {
  return path.join(trailDir, 'session-index.json')
}

export function configPath(trailDir: string): string {
  return path.join(trailDir, 'config.json')
}

// ─── Config helpers ───────────────────────────────────────────────────────────

export async function readConfig(trailDir: string): Promise<Config> {
  const cfgPath = configPath(trailDir)
  try {
    const raw = await readJSON(cfgPath)
    return ConfigSchema.parse(raw)
  } catch {
    const projectName = path.basename(getProjectRoot(trailDir))
    return defaultConfig(projectName)
  }
}

// ─── Claude session directory resolver ───────────────────────────────────────

/**
 * Claude Code encodes the absolute project path into a directory name
 * by replacing path separators and colons with hyphens.
 *
 * Windows: D:\Coding\My Projects\myapp → -D-Coding-My-Projects-myapp
 * POSIX:   /home/user/code/myapp       → -home-user-code-myapp
 */
export function encodeProjectPathForClaude(projectRoot: string): string {
  // Normalize to forward slashes, strip drive colon, replace slashes with hyphens
  return projectRoot
    .replace(/\\/g, '/')
    .replace(/:/g, '')
    .replace(/\//g, '-')
    .replace(/^-+/, '-') // ensure leading hyphen
}

export function claudeSessionDir(projectRoot: string): string {
  const encoded = encodeProjectPathForClaude(projectRoot)
  return path.join(os.homedir(), '.claude', 'projects', encoded)
}

// ─── Agent config file detection ─────────────────────────────────────────────

export interface DetectedAgents {
  claude: boolean
  cursor: boolean
  windsurf: boolean
  copilot: boolean
  cline: boolean
  aider: boolean
  gemini: boolean
  codex: boolean
  continue: boolean
}

export function detectAgents(projectRoot: string): DetectedAgents {
  const e = (p: string) => existsSync(path.join(projectRoot, p))
  return {
    claude:   e('.claude') || e('CLAUDE.md'),
    cursor:   e('.cursor'),
    windsurf: e('.windsurf'),
    copilot:  e('.github/copilot-instructions.md') || e('.github'),
    cline:    e('.cline'),
    aider:    e('.aider.conf.yml') || e('.aiderignore') || e('CONVENTIONS.md'),
    gemini:   e('.gemini'),
    codex:    e('.codex') || e('.codex/config.toml'),
    continue: e('.continue') || e('.continuerc.json'),
  }
}
