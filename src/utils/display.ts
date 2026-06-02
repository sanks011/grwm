// ANSI color codes — no chalk dependency, keeps install lightweight
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  gray:    '\x1b[90m',
  white:   '\x1b[37m',
}

export const color = c

export function bold(s: string) { return `${c.bold}${s}${c.reset}` }
export function dim(s: string)  { return `${c.dim}${s}${c.reset}` }
export function green(s: string) { return `${c.green}${s}${c.reset}` }
export function yellow(s: string) { return `${c.yellow}${s}${c.reset}` }
export function red(s: string)  { return `${c.red}${s}${c.reset}` }
export function cyan(s: string) { return `${c.cyan}${s}${c.reset}` }
export function magenta(s: string) { return `${c.magenta}${s}${c.reset}` }
export function gray(s: string) { return `${c.gray}${s}${c.reset}` }

// Status icons
export const STATUS_ICON = {
  'queued':      gray('○'),
  'in-progress': cyan('◎'),
  'done':        green('✓'),
  'blocked':     red('✗'),
} as const

export function statusBadge(status: string): string {
  const icons: Record<string, string> = STATUS_ICON
  const icon = icons[status] ?? gray('?')
  const label = {
    'queued':      gray('queued'),
    'in-progress': cyan('in-progress'),
    'done':        green('done'),
    'blocked':     red('blocked'),
  }[status] ?? gray(status)
  return `${icon} ${label}`
}

export function sectionHeader(title: string): string {
  const line = '─'.repeat(50)
  return `\n${cyan(line)}\n${bold(cyan(` grwm › ${title}`))}\n${cyan(line)}`
}

export function success(msg: string): void {
  console.log(`${green('✓')} ${msg}`)
}

export function warn(msg: string): void {
  console.log(`${yellow('⚠')} ${msg}`)
}

export function info(msg: string): void {
  console.log(`${cyan('›')} ${msg}`)
}

export function errorMsg(msg: string): void {
  console.error(`${red('✗')} ${msg}`)
}

export function grwmBanner(): void {
  console.log(`
${magenta('┌─────────────────────────────────┐')}
${magenta('│')} ${bold('grwm')} ${dim('— Get Ready With Me')}        ${magenta('│')}
${magenta('│')} ${dim('universal AI agent handoff tool')} ${magenta('│')}
${magenta('└─────────────────────────────────┘')}
`)
}
