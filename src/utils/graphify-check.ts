import { spawnSync, execSync } from 'child_process'
import { info, warn, success, cyan, bold, yellow, gray } from './display.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import readline from 'readline'
import { resolveProvider, OPENCODE_BASE_URL, OPENCODE_MODEL } from './ai-config.js'

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close()
      resolve(ans)
    })
  })
}


/**
 * Graphify — https://graphify.dev
 * pip install graphifyy
 * CLI command: graphify
 * Requires Python 3.10+
 *
 * Builds a knowledge graph (graph.json, graph.html, GRAPH_REPORT.md)
 * from your codebase using Tree-sitter + LLM semantic extraction.
 * Output lands in graphify-out/ — grwm reads graphify-out/graph.json.
 */

const GRAPHIFY_BIN = 'graphify'
const GRAPHIFY_PIP_PKG = 'graphifyy'

/**
 * Check if a command exists in PATH.
 * Uses 'where' on Windows, 'which' on POSIX — no extra dependencies.
 */
function commandExists(bin: string): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const result = spawnSync(cmd, [bin], { encoding: 'utf8' })
    return result.status === 0
  } catch {
    return false
  }
}

/**
 * Detect the first available Python 3.10+ binary, including standard Windows user installations.
 */
function getPythonBin(): string | null {
  // 1. Try commands in PATH
  for (const bin of ['py', 'python3', 'python', 'python3.14', 'python3.13', 'python3.12', 'python3.11', 'python3.10']) {
    try {
      const result = spawnSync(bin, ['--version'], { encoding: 'utf8' })
      if (result.status === 0) {
        const version = (result.stdout || result.stderr || '').trim()
        const match = version.match(/Python (\d+)\.(\d+)/)
        if (match && parseInt(match[1]) === 3 && parseInt(match[2]) >= 10) return bin
      }
    } catch {}
  }

  // 2. Windows fallback: scan common user AppData directories (since Scripts/Python is often not on PATH)
  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE || process.env.HOMEPATH || ''
    if (userProfile) {
      const appDataLocal = `${userProfile}\\AppData\\Local`
      const candidatePaths = [
        `${appDataLocal}\\Python\\pythoncore-3.14-64\\python.exe`,
        `${appDataLocal}\\Python\\pythoncore-3.13-64\\python.exe`,
        `${appDataLocal}\\Python\\pythoncore-3.12-64\\python.exe`,
        `${appDataLocal}\\Python\\pythoncore-3.11-64\\python.exe`,
        `${appDataLocal}\\Python\\pythoncore-3.10-64\\python.exe`,
        `${appDataLocal}\\Programs\\Python\\Python314\\python.exe`,
        `${appDataLocal}\\Programs\\Python\\Python313\\python.exe`,
        `${appDataLocal}\\Programs\\Python\\Python312\\python.exe`,
        `${appDataLocal}\\Programs\\Python\\Python311\\python.exe`,
        `${appDataLocal}\\Programs\\Python\\Python310\\python.exe`,
      ]

      for (const p of candidatePaths) {
        try {
          const result = spawnSync(p, ['--version'], { encoding: 'utf8' })
          if (result.status === 0) return p
        } catch {}
      }
    }
  }

  return null
}

/** Check if python can run the graphify module directly. */
function isGraphifyInstalledWithPython(pyBin: string): boolean {
  try {
    const result = spawnSync(pyBin, ['-m', 'graphify', '--help'], { encoding: 'utf8' })
    return result.status === 0
  } catch {
    return false
  }
}

/** Check if the graphify CLI is available in PATH or via Python. */
export function isGraphifyInstalled(): boolean {
  if (commandExists(GRAPHIFY_BIN)) return true
  const pyBin = getPythonBin()
  if (pyBin && isGraphifyInstalledWithPython(pyBin)) return true
  return false
}

/**
 * Configure Graphify to use the same OpenCode provider that autolog uses.
 * Writes .graphify/providers.json locally + globally, then injects the
 * resolved key from ai-config (env → ~/.grwm/keys.json → public fallback).
 */
function setupGraphifyProvider(projectRoot: string): void {
  try {
    // Resolve the same provider autolog uses so they are always in sync
    const provider = resolveProvider()
    const apiKey   = provider.key
    const baseUrl  = provider.def.baseUrl ?? OPENCODE_BASE_URL
    const model    = provider.def.model   ?? OPENCODE_MODEL
    const envKey   = provider.def.envKey

    // Build the providers.json that graphify reads for its --backend flag
    const providerConfig = {
      opencode: {
        base_url:      OPENCODE_BASE_URL,
        default_model: OPENCODE_MODEL,
        env_key:       'OPENCODE_API_KEY',
        temperature:   0,
        max_tokens:    16384,
      },
      // If the user configured a different provider, add it too
      ...(provider.name !== 'opencode' ? {
        [provider.name]: {
          base_url:      baseUrl,
          default_model: model,
          env_key:       envKey,
          temperature:   0,
          max_tokens:    16384,
        },
      } : {}),
    }
    const configStr = JSON.stringify(providerConfig, null, 2)

    // 1. Write local .graphify/providers.json
    const localDir  = path.join(projectRoot, '.graphify')
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true })
    fs.writeFileSync(path.join(localDir, 'providers.json'), configStr, 'utf8')

    // 2. Write global ~/.graphify/providers.json
    const globalDir = path.join(os.homedir(), '.graphify')
    if (!fs.existsSync(globalDir)) fs.mkdirSync(globalDir, { recursive: true })
    fs.writeFileSync(path.join(globalDir, 'providers.json'), configStr, 'utf8')

    // 3. Inject the resolved key into env so graphify subprocess picks it up
    if (!process.env[envKey]) {
      process.env[envKey] = apiKey
    }
    // Always ensure OPENCODE_API_KEY is set (graphify falls back to it)
    if (!process.env.OPENCODE_API_KEY) {
      process.env.OPENCODE_API_KEY = apiKey
    }
  } catch {
    // Ignore issues writing config, fail-soft
  }
}

/**
 * Run `graphify .` in the project root to build or refresh the knowledge graph.
 * Output lands in graphify-out/graph.json, graph.html, GRAPH_REPORT.md
 */
export function runGraphify(projectRoot: string): boolean {
  try {
    setupGraphifyProvider(projectRoot)
    if (commandExists(GRAPHIFY_BIN)) {
      execSync(`${GRAPHIFY_BIN} .`, { cwd: projectRoot, stdio: 'inherit' })
      return true
    }
    const pyBin = getPythonBin()
    if (pyBin && isGraphifyInstalledWithPython(pyBin)) {
      execSync(`"${pyBin}" -m graphify .`, { cwd: projectRoot, stdio: 'inherit' })
      return true
    }
    return false
  } catch {
    return false
  }
}


/**
 * Ensure graphify is installed, optionally auto-installing via pip and running it.
 *
 * @param projectRoot  - Where to run `graphify .`
 * @param autoInstall  - If true, pip-install without prompting
 * @param generate     - If true, run graphify after ensuring it's installed
 */
export async function ensureGraphify(
  projectRoot: string,
  autoInstall: boolean = false,
  generate: boolean = false
): Promise<{ installed: boolean; graphGenerated: boolean }> {
  // Already installed
  if (isGraphifyInstalled()) {
    if (generate) {
      info('Running graphify to build knowledge graph...')
      const ok = runGraphify(projectRoot)
      if (ok) {
        success(`Knowledge graph built → ${cyan('graphify-out/graph.json')}`)
        info(`Interactive view: open ${cyan('graphify-out/graph.html')}`)
      } else {
        warn(`graphify failed — run ${cyan('graphify .')} manually in your project root`)
      }
      return { installed: true, graphGenerated: ok }
    }
    return { installed: true, graphGenerated: false }
  }

  // Not installed — explain what it is
  console.log(`\n${yellow('◈')} ${bold('Graphify')} is not installed.`)
  console.log(`  Graphify builds a knowledge graph from your entire codebase (code, docs, diagrams)`)
  console.log(`  so grwm can include smart code references in every handoff brief.`)
  console.log(`  It achieves up to ${bold('71.5×')} token reduction compared to naive context dumps.`)
  console.log(`  ${gray('MIT License · pip install graphifyy · github.com/Safi1012/graphify')}`)
  console.log()

  if (!autoInstall) {
    const answer = await askQuestion(`  Would you like to install Graphify automatically now? (Y/n): `)
    const choice = answer.trim().toLowerCase()
    if (choice === '' || choice === 'y' || choice === 'yes') {
      autoInstall = true
    } else {
      console.log(`\n  To install manually:`)
      console.log(`    ${cyan('pip install graphifyy && graphify install')}`)
      console.log(`  Then generate your knowledge graph:`)
      console.log(`    ${cyan('graphify .')}`)
      console.log(`  Then re-run: ${cyan('grwm handoff')} to include the graph in your brief.`)
      console.log(`  ${gray('(grwm works perfectly fine without it.)')}`)
      console.log()
      return { installed: false, graphGenerated: false }
    }
  }

  // Auto-install — check Python first
  const pyBin = getPythonBin()
  if (!pyBin) {
    warn('Python 3.10+ not found in PATH.')
    warn(`Install Python, then run: ${cyan(`pip install ${GRAPHIFY_PIP_PKG} && graphify install`)}`)
    return { installed: false, graphGenerated: false }
  }

  console.log(`  Auto-installing ${bold('graphifyy')} and ${bold('openai')} via pip (using: ${pyBin})...`)
  try {
    execSync(`"${pyBin}" -m pip install ${GRAPHIFY_PIP_PKG} openai`, { stdio: 'inherit' })
    execSync(`"${pyBin}" -m graphify install`, { stdio: 'inherit' })
    success(`graphify installed`)

    if (generate) {
      info('Generating knowledge graph...')
      const ok = runGraphify(projectRoot)
      if (ok) {
        success(`Knowledge graph ready → ${cyan('graphify-out/graph.json')}`)
        info(`Interactive view: open ${cyan('graphify-out/graph.html')}`)
      } else {
        warn(`Run ${cyan('graphify .')} manually in your project root`)
      }
      return { installed: true, graphGenerated: ok }
    }
    return { installed: true, graphGenerated: false }
  } catch {
    warn(`Auto-install failed. Run manually:`)
    warn(`  ${cyan(`pip install ${GRAPHIFY_PIP_PKG} openai && graphify install`)}`)
    return { installed: false, graphGenerated: false }
  }
}
