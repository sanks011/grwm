import { spawnSync, execSync } from 'child_process'
import { info, warn, success, cyan, bold, yellow, gray } from './display.js'
import readline from 'readline'

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
 * Run `graphify .` in the project root to build or refresh the knowledge graph.
 * Output lands in graphify-out/graph.json, graph.html, GRAPH_REPORT.md
 */
export function runGraphify(projectRoot: string): boolean {
  try {
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

  console.log(`  Auto-installing ${bold('graphifyy')} via pip (using: ${pyBin})...`)
  try {
    execSync(`"${pyBin}" -m pip install ${GRAPHIFY_PIP_PKG}`, { stdio: 'inherit' })
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
    warn(`  ${cyan(`pip install ${GRAPHIFY_PIP_PKG} && graphify install`)}`)
    return { installed: false, graphGenerated: false }
  }
}
