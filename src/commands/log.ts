import { requireTrailDir, decisionsPath } from '../utils/paths.js'
import { appendDecision } from '../layers/decisions.js'
import { success, sectionHeader, bold, gray } from '../utils/display.js'
import { now } from '../utils/timestamp.js'

export async function log(decision: string): Promise<void> {
  const trailDir = requireTrailDir()
  console.log(sectionHeader('log'))

  await appendDecision(decisionsPath(trailDir), decision)
  success(`Logged decision:`)
  console.log(`  ${bold(decision)}`)
  console.log(`  ${gray(now())}`)
  console.log()
}
