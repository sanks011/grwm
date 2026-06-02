export function now(): string {
  return new Date().toISOString()
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function ageMinutes(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000
}
