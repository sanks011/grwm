# grwm — Get Ready With Me

> The universal AI agent handoff tool. Never explain your codebase to a new agent again.

[![npm](https://img.shields.io/npm/v/@sankalpasarkar/grwm)](https://npmjs.com/package/@sankalpasarkar/grwm)
[![license](https://img.shields.io/npm/l/@sankalpasarkar/grwm)](LICENSE)
[![node](https://img.shields.io/node/v/@sankalpasarkar/grwm)](package.json)

---

## The Problem

Your AI agent hits its context limit. A new session starts. The new agent has no idea what was done, what was decided, why, or what comes next. You spend 10 minutes re-explaining the project.

**grwm fixes this.** It generates a structured, token-budgeted handoff brief and broadcasts it to the native config format of every AI agent you use — simultaneously.

---

## How it works

```bash
grwm handoff
```

This single command:

1. Automatically refreshes your PyPI codebase static graph if Graphify is installed.
2. Reads your task board state, decision log, git branch, commits, and diff pointer.
3. Compiles a structured, token-optimized brief targeting ≤ 2,000 tokens.
4. Writes it to the native config format of every detected AI agent.

The next agent, in any tool, finds the briefing in its expected location and starts immediately with full context.

---

## AI-Powered Autologging (`grwm autolog`)

Completely eliminate manual typing! Running `grwm autolog` automatically parses your uncommitted changes (`git diff`) and recent commits to dynamically extract completed tasks and technical decisions:

1. **Free OpenCode Big Pickle (Default):** Integrates natively with OpenCode's public keyless gateway to route prompts directly to the free stealth model `opencode/big-pickle`. Zero API keys or token costs required!
2. **Deep Graphify Mapping:** If a Graphify static graph exists in your project (`graphify-out/graph.json`), `autolog` extracts the most central architectural components (highest-degree nodes) and feeds them into the Big Pickle prompt to map your changes precisely to existing modules!
3. **Resilient Local Heuristics Fallback:** Works 100% offline. If the gateway is unreachable, a robust offline regex engine cleans commit prefixes (like `feat:`, `fix:`) and scans commit bodies for design decisions to update your logs instantly.

---

## Supported agents

| Agent / IDE        | File written by `grwm handoff`           |
| ------------------ | ---------------------------------------- |
| Claude Code        | `.claude/CONTEXT.md`                     |
| Cursor             | `.cursor/rules/grwm-handoff.mdc`         |
| Windsurf           | `.windsurf/rules/grwm-handoff.md`        |
| GitHub Copilot     | `.github/copilot-instructions.md`        |
| Cline              | `.cline/rules/grwm-handoff.md`           |
| Aider              | `CONVENTIONS.md`                         |
| Gemini Code Assist | `.gemini/grwm-context.md`                |
| OpenAI Codex       | `.codex/grwm-context.md`                 |
| Continue           | `.continue/grwm-context.md`              |
| **All agents**     | `AGENTS.md` (always, universal standard) |

---

## Install

```bash
npm install -g @sankalpasarkar/grwm
```

---

## Quick start

```bash
# 1. Initialize in your project
grwm init

# 2. Add tasks manually, or let grwm scan your workspace automatically
grwm add "implement auth module"

# 3. Work on your codebase and commit changes...
# 4. Automatically extract context and update tasks/decisions
grwm autolog

# 5. Log manual technical decisions as they happen
grwm log "chose JWT over sessions — stateless required for multi-server"

# 6. When context hits ~60%, generate handoff (updates graphify in the background!)
grwm handoff

# 7. In the new agent session, resume instantly
grwm resume
```

---

## CLI reference

| Command                         | Description                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `grwm init`                     | Initialize `.trail/` and write startup instructions to all detected agent configs (with interactive Graphify setup)                          |
| `grwm autolog`                  | Automatically extract uncommitted diffs and Git history into completed tasks and decisions using free Big Pickle or offline local heuristics |
| `grwm add <title>`              | Add a new task (status: queued)                                                                                                              |
| `grwm log <decision>`           | Append a decision to the append-only decision log                                                                                            |
| `grwm done <task>`              | Mark task done. `--files "a.ts,b.ts"` to record touched files                                                                                |
| `grwm blocked <task>`           | Mark task blocked. `--reason "..."` to document why                                                                                          |
| `grwm handoff`                  | Compile brief + broadcast to all detected agents (auto-runs Graphify in background if installed)                                             |
| `grwm handoff --agent cursor`   | Write only to Cursor                                                                                                                         |
| `grwm handoff --index-sessions` | Include Claude Code session analysis (needs `ANTHROPIC_API_KEY`)                                                                             |
| `grwm resume`                   | Print handoff brief (run at session start)                                                                                                   |
| `grwm status`                   | Show task board and recent decisions                                                                                                         |

---

## AGENTS.md integration

Add this to your project's `AGENTS.md` so every new agent session automatically loads the handoff:

```markdown
## Session startup

At the start of every new session, run:
grwm resume

Do not start work until you have read the handoff brief.

## Session end / handoff

Before ending a session or when context exceeds 60%:
grwm handoff
```

`grwm init` writes this automatically.

---

## The 6-layer stack

| Layer          | What it reads                        | What it writes                                           |
| -------------- | ------------------------------------ | -------------------------------------------------------- |
| L0 — Trigger   | API token usage                      | Warn when context is at 60%                              |
| L1 — Git       | Branch, commits, diff stat           | Feeds brief                                              |
| L2 — Graphify  | `graphify-out/graph.json` (optional) | Pointer in brief (auto-synced & injected into L6 prompt) |
| L3 — Tasks     | `.trail/tasks.json`                  | Task state (JSON, Zod-validated)                         |
| L4 — Decisions | `.trail/decisions.md`                | Append-only decision log                                 |
| L5 — Sessions  | `~/.claude/projects/` (opt-in)       | `.trail/session-index.json`                              |
| L6 — Brief     | All layers                           | `.trail/handoff.md`                                      |
| Broadcast      | `.trail/handoff.md`                  | All agent config files                                   |

---

## The handoff brief format

```
# grwm Handoff Brief — my-project
> Generated: 2026-06-02T17:30:00Z | Branch: `feature/payments` | Last commit: `a3b9f12`

## [CONTEXT_REF]
- Code graph: `graphify-out/graph.json` (287 nodes, 1,204 edges)
- Key nodes: PaymentService, AuthMiddleware, UserRepository

## [NEXT]
- **Implement refund flow** [queued]

## [IN_PROGRESS]
- Stripe webhook verification — handler added, need idempotency key check

## [DONE]
- ✓ Auth module (JWT, refresh tokens)
- ✓ User registration and login
- ✓ Basic Stripe checkout session creation

## [BLOCKED]
- ✗ Email notifications — **REASON**: SendGrid API key not provisioned

## [DECISIONS]
- [2026-06-02T14:22Z] chose Postgres over SQLite — need full-text search
- [2026-06-02T15:44Z] NOT using LangChain — too heavy for this use case
- [session] decided against microservices — monolith ships faster for MVP

## [CHANGED_FILES]
- `src/payments/webhook.ts`
- `src/payments/stripe.service.ts`
```

---

## Why this works

This is **harness engineering**, not prompt engineering. The key insight from Anthropic's own research:

> _"Context resets — clearing the context window entirely and starting a fresh agent with a structured handoff — is more effective than compaction. The new agent starts fresh with no context anxiety."_

grwm automates the harness layer: writing structured artifacts to disk in real-time during the session. If the agent crashes mid-task, the next one can still resume cleanly.

---

## License

MIT © [sankalpasarkar](https://github.com/sanks011)
