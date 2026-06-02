import simpleGit from 'simple-git'

export interface GitState {
  available: boolean
  branch: string
  recentCommits: string[]
  changedFiles: string[]
  untrackedFiles: string[]
  diffSummary: string
  lastCommitHash: string
  lastCommitMessage: string
}

const EMPTY: GitState = {
  available: false,
  branch: 'unknown',
  recentCommits: [],
  changedFiles: [],
  untrackedFiles: [],
  diffSummary: '',
  lastCommitHash: '',
  lastCommitMessage: '',
}

/**
 * Layer 1: Extract git state for the handoff brief.
 * Returns an empty state (not an error) if the directory is not a git repo.
 */
export async function getGitState(projectRoot: string): Promise<GitState> {
  try {
    const git = simpleGit(projectRoot)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return EMPTY

    const [status, log, branchSummary] = await Promise.all([
      git.status(),
      git.log({ maxCount: 10, '--oneline': null }),
      git.branch(),
    ])

    const changedFiles = [
      ...status.modified,
      ...status.created,
      ...status.renamed.map((r) => r.to),
      ...status.deleted,
    ]

    // Diff stat capped for token efficiency
    let diffSummary = ''
    try {
      diffSummary = await git.diff(['--stat', 'HEAD~3..HEAD'])
      if (diffSummary.length > 1000) diffSummary = diffSummary.slice(0, 1000) + '\n...(truncated)'
    } catch {
      diffSummary = 'No prior commits to diff'
    }

    const commits = log.all.map((c) => `${c.hash.slice(0, 7)} ${c.message}`)

    return {
      available: true,
      branch: branchSummary.current ?? 'unknown',
      recentCommits: commits,
      changedFiles,
      untrackedFiles: status.not_added.slice(0, 10),
      diffSummary,
      lastCommitHash: log.latest?.hash?.slice(0, 7) ?? '',
      lastCommitMessage: log.latest?.message ?? '',
    }
  } catch {
    return EMPTY
  }
}
