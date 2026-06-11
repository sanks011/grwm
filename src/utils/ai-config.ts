import fs from 'fs'
import path from 'path'
import os from 'os'
import readline from 'readline'
import { bold, cyan, green, gray, yellow, warn, info, success } from './display.js'

// ─── Constants ─────────────────────────────────────────────────────────────────

export const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1'
export const OPENCODE_MODEL    = 'deepseek-v4-flash-free'
export const GRWM_KEYS_PATH   = path.join(os.homedir(), '.grwm', 'keys.json')

// ─── Provider definitions ──────────────────────────────────────────────────────

export interface ProviderDef {
  label: string
  envKey: string
  /** Optional API endpoint (undefined = managed via env key alone, e.g. Anthropic) */
  baseUrl?: string
  model?: string
}

export const PROVIDERS: Record<string, ProviderDef> = {
  opencode: {
    label: 'OpenCode (DeepSeek V4 Flash — Free)',
    envKey: 'OPENCODE_API_KEY',
    baseUrl: OPENCODE_BASE_URL,
    model: OPENCODE_MODEL,
  },
  openai: {
    label: 'OpenAI (GPT-4o)',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  anthropic: {
    label: 'Anthropic (Claude 4.5 Sonnet)',
    envKey: 'ANTHROPIC_API_KEY',
    model: 'claude-4.5-sonnet',
  },
  gemini: {
    label: 'Google Gemini (gemini-2.5-flash)',
    envKey: 'GEMINI_API_KEY',
    model: 'gemini-2.5-flash',
  },
  deepseek: {
    label: 'DeepSeek (deepseek-chat)',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  groq: {
    label: 'Groq (llama-3.3-70b-versatile)',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
}

// ─── Saved keys store (~/.grwm/keys.json) ─────────────────────────────────────

export interface SavedKeys {
  [providerName: string]: string
}

export function loadSavedKeys(): SavedKeys {
  try {
    if (fs.existsSync(GRWM_KEYS_PATH)) {
      return JSON.parse(fs.readFileSync(GRWM_KEYS_PATH, 'utf8'))
    }
  } catch {}
  return {}
}

export function saveKeys(keys: SavedKeys): void {
  const dir = path.dirname(GRWM_KEYS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(GRWM_KEYS_PATH, JSON.stringify(keys, null, 2), 'utf8')
}

export function upsertKey(providerName: string, apiKey: string): void {
  const keys = loadSavedKeys()
  keys[providerName] = apiKey
  saveKeys(keys)
}

export function deleteKey(providerName: string): void {
  const keys = loadSavedKeys()
  delete keys[providerName]
  saveKeys(keys)
}

// ─── Active provider resolution ────────────────────────────────────────────────

export interface ActiveProvider {
  name: string
  key: string
  def: ProviderDef
  source: 'env' | 'saved' | 'public'
}

/**
 * Resolve the best available provider:
 * 1. Env vars (highest priority — user explicitly set them)
 * 2. Saved keys (~/.grwm/keys.json)
 * 3. Public OpenCode gateway (free, keyless fallback)
 */
export function resolveProvider(): ActiveProvider {
  // 1. Check env vars in priority order
  const envOrder = ['opencode', 'anthropic', 'openai', 'gemini', 'deepseek', 'groq']
  for (const name of envOrder) {
    const def = PROVIDERS[name]
    const val = process.env[def.envKey]
    if (val && val !== 'public') {
      return { name, key: val, def, source: 'env' }
    }
  }

  // 2. Check saved keys (~/.grwm/keys.json) in priority order
  const saved = loadSavedKeys()
  for (const name of envOrder) {
    const key = saved[name]
    if (key && key !== 'public') {
      // Inject into env so child processes (graphify) also pick it up
      process.env[PROVIDERS[name].envKey] = key
      return { name, key, def: PROVIDERS[name], source: 'saved' }
    }
  }

  // 3. Free public OpenCode fallback
  process.env.OPENCODE_API_KEY = 'public'
  return {
    name: 'opencode',
    key: 'public',
    def: PROVIDERS.opencode,
    source: 'public',
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Return true if ANY real (non-public) key is configured (env or saved). */
export function hasAnyRealKey(): boolean {
  // Check env
  for (const def of Object.values(PROVIDERS)) {
    const val = process.env[def.envKey]
    if (val && val !== 'public') return true
  }
  // Check saved
  const saved = loadSavedKeys()
  for (const key of Object.values(saved)) {
    if (key && key !== 'public') return true
  }
  return false
}

/** Mask an API key for display: show first 6 + last 4 chars. */
export function maskKey(key: string): string {
  if (key.length <= 10) return '••••••••'
  return key.slice(0, 6) + '••••' + key.slice(-4)
}

// ─── Interactive readline helpers ──────────────────────────────────────────────

export function askQuestion(query: string, rl?: readline.Interface): Promise<string> {
  const iface = rl ?? readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    iface.question(query, (ans) => {
      if (!rl) iface.close()
      resolve(ans)
    })
  })
}

export async function askSecret(query: string): Promise<string> {
  // Node doesn't support masked input natively; we just read normally
  return askQuestion(query)
}

// ─── "No keys" fallback hint ──────────────────────────────────────────────────

/**
 * Shown when OpenCode public gateway fails AND no keys are saved.
 * Prompts the user to run `grwm keys` to configure a provider.
 */
export function printKeysHint(): void {
  console.log()
  console.log(`${yellow('◈')} ${bold('No AI provider configured and the OpenCode gateway could not be reached.')}`)
  console.log(`  To set up a free or paid AI provider, run:`)
  console.log()
  console.log(`    ${cyan('grwm keys')}`)
  console.log()
  console.log(`  This will walk you through selecting a provider and saving your API key.`)
  console.log(`  ${gray('(grwm works offline too — it will fall back to Git heuristics.)')}`)
  console.log()
}
