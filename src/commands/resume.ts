import { readFile } from 'fs/promises'
import { requireTrailDir, handoffPath, getProjectRoot } from '../utils/paths.js'
import { isHandoffStale } from '../layers/trigger.js'
import { sectionHeader, bold, cyan, yellow, warn, magenta } from '../utils/display.js'

export async function resume(): Promise<void> {
  const trailDir = requireTrailDir()
  const projectRoot = getProjectRoot(trailDir)
  const hPath = handoffPath(trailDir)

  console.log(sectionHeader('resume — Get Ready With Me'))

  // Warn if handoff is stale
  const stale = await isHandoffStale(hPath, 30)
  if (stale) {
    warn(`Handoff brief is stale or missing. Run ${bold('grwm handoff')} to regenerate.`)
    console.log()
  }

  let content: string
  try {
    content = await readFile(hPath, 'utf8')
  } catch {
    console.log(`No handoff brief found at ${hPath}`)
    console.log(`Run ${cyan('grwm handoff')} to generate one.`)
    return
  }

  // Print with section highlighting
  const lines = content.split('\n')
  const highlighted = lines
    .map((line) => {
      if (line.startsWith('# ')) return bold(magenta(line))
      if (line.startsWith('## [')) return bold(cyan(line))
      if (line.startsWith('## ')) return bold(line)
      if (line.startsWith('- ✓')) return line.replace('- ✓', `- ${bold('✓')}`)
      if (line.startsWith('- ✗')) return line.replace('- ✗', `- ${bold('✗')}`)
      if (line.startsWith('- **')) return cyan(line)
      return line
    })
    .join('\n')

  console.log(highlighted)
  console.log()
}
