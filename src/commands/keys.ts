import readline from 'readline'
import {
  PROVIDERS,
  loadSavedKeys,
  upsertKey,
  deleteKey,
  maskKey,
  askQuestion,
  GRWM_KEYS_PATH,
} from '../utils/ai-config.js'
import {
  sectionHeader,
  success,
  warn,
  info,
  bold,
  cyan,
  green,
  yellow,
  gray,
  red,
} from '../utils/display.js'

// ─── Main command ──────────────────────────────────────────────────────────────

export async function keys(): Promise<void> {
  console.log(sectionHeader('keys — API key manager'))
  console.log()
  console.log(`  Saved keys file: ${gray(GRWM_KEYS_PATH)}`)
  console.log()

  await mainMenu()
}

// ─── Main menu ─────────────────────────────────────────────────────────────────

async function mainMenu(): Promise<void> {
  const saved = loadSavedKeys()
  const savedNames = Object.keys(saved)

  // Print current state
  console.log(`${bold('Configured providers:')}`)
  if (savedNames.length === 0) {
    console.log(`  ${gray('None — using public OpenCode gateway (DeepSeek V4 Flash, free)')}`)
  } else {
    for (const name of savedNames) {
      const def = PROVIDERS[name]
      const label = def ? def.label : name
      console.log(`  ${green('✓')} ${bold(name)} — ${label}  ${gray(maskKey(saved[name]))}`)
    }
  }
  console.log()

  // Print menu options
  console.log(`${bold('What would you like to do?')}`)
  console.log(`  ${cyan('1')}  Add / update a provider key`)
  console.log(`  ${cyan('2')}  Remove a provider key`)
  console.log(`  ${cyan('3')}  List all configured providers`)
  console.log(`  ${cyan('4')}  Test the active provider`)
  console.log(`  ${cyan('q')}  Quit`)
  console.log()

  const choice = (await askQuestion('  Enter your choice: ')).trim().toLowerCase()

  switch (choice) {
    case '1': await addOrUpdateKey(); break
    case '2': await removeKey(); break
    case '3': await listKeys(); break
    case '4': await testProvider(); break
    case 'q':
    case '':
      console.log(`\n${gray('Bye!')}`)
      return
    default:
      warn(`Unknown option: "${choice}"`)
      await mainMenu()
  }
}

// ─── Add / update key ──────────────────────────────────────────────────────────

async function addOrUpdateKey(): Promise<void> {
  console.log()
  console.log(`${bold('Choose a provider to configure:')}`)

  const providerNames = Object.keys(PROVIDERS)
  providerNames.forEach((name, i) => {
    const def = PROVIDERS[name]
    console.log(`  ${cyan(String(i + 1))}  ${bold(name)} — ${def.label}`)
  })
  console.log(`  ${cyan('c')}  Custom / self-hosted (OpenAI-compatible endpoint)`)
  console.log()

  const raw = (await askQuestion('  Enter number or "c" for custom: ')).trim().toLowerCase()

  if (raw === 'c') {
    await addCustomProvider()
    return
  }

  const idx = parseInt(raw, 10) - 1
  if (isNaN(idx) || idx < 0 || idx >= providerNames.length) {
    warn('Invalid selection.')
    await mainMenu()
    return
  }

  const name = providerNames[idx]
  const def = PROVIDERS[name]

  console.log()
  console.log(`  Provider:  ${bold(def.label)}`)
  if (def.baseUrl) console.log(`  Endpoint:  ${gray(def.baseUrl)}`)
  if (def.model)   console.log(`  Model:     ${gray(def.model)}`)
  console.log()

  const apiKey = (await askQuestion(`  Paste your ${bold(def.envKey)}: `)).trim()
  if (!apiKey) {
    warn('No key entered — cancelled.')
    await mainMenu()
    return
  }

  upsertKey(name, apiKey)
  console.log()
  success(`Saved ${bold(name)} key → ${gray(GRWM_KEYS_PATH)}`)
  console.log(`  ${gray('The key will be used for all future grwm autolog and handoff runs.')}`)
  console.log()

  const another = (await askQuestion('  Add another provider? (y/N): ')).trim().toLowerCase()
  if (another === 'y' || another === 'yes') {
    await addOrUpdateKey()
  } else {
    await mainMenu()
  }
}

// ─── Custom provider ───────────────────────────────────────────────────────────

async function addCustomProvider(): Promise<void> {
  console.log()
  console.log(`${bold('Custom / self-hosted provider')}`)
  console.log(`  Any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.)`)
  console.log()

  const name    = (await askQuestion('  Short name (e.g. "ollama", "lmstudio"): ')).trim()
  const baseUrl = (await askQuestion('  Base URL (e.g. http://localhost:11434/v1): ')).trim()
  const model   = (await askQuestion('  Model name (e.g. llama3.2): ')).trim()
  const apiKey  = (await askQuestion('  API key (press Enter for "none"): ')).trim() || 'none'

  if (!name || !baseUrl || !model) {
    warn('Name, base URL, and model are required — cancelled.')
    await mainMenu()
    return
  }

  // Store as a special JSON blob since PROVIDERS is static
  const customEntry = JSON.stringify({ baseUrl, model, apiKey })
  upsertKey(`custom:${name}`, customEntry)

  console.log()
  success(`Saved custom provider ${bold(name)}`)
  console.log(`  ${gray(`Endpoint: ${baseUrl}, model: ${model}`)}`)
  console.log()
  await mainMenu()
}

// ─── Remove key ────────────────────────────────────────────────────────────────

async function removeKey(): Promise<void> {
  const saved = loadSavedKeys()
  const names = Object.keys(saved)

  if (names.length === 0) {
    warn('No saved keys to remove.')
    await mainMenu()
    return
  }

  console.log()
  console.log(`${bold('Saved providers:')}`)
  names.forEach((name, i) => {
    console.log(`  ${cyan(String(i + 1))}  ${bold(name)}  ${gray(maskKey(saved[name]))}`)
  })
  console.log()

  const raw = (await askQuestion('  Enter number to remove (or Enter to cancel): ')).trim()
  if (!raw) { await mainMenu(); return }

  const idx = parseInt(raw, 10) - 1
  if (isNaN(idx) || idx < 0 || idx >= names.length) {
    warn('Invalid selection.')
    await mainMenu()
    return
  }

  const name = names[idx]
  deleteKey(name)
  success(`Removed ${bold(name)} key.`)
  console.log()
  await mainMenu()
}

// ─── List keys ─────────────────────────────────────────────────────────────────

async function listKeys(): Promise<void> {
  const saved = loadSavedKeys()
  const names = Object.keys(saved)

  console.log()
  if (names.length === 0) {
    console.log(`  ${gray('No saved keys. Run grwm keys and choose option 1 to add one.')}`)
  } else {
    console.log(`${bold('Saved API keys:')}`)
    for (const name of names) {
      const def = PROVIDERS[name]
      const label = def ? def.label : name
      console.log(`  ${green('✓')} ${bold(name.padEnd(12))} ${gray(label.padEnd(40))} ${gray(maskKey(saved[name]))}`)
    }
  }
  console.log()
  await mainMenu()
}

// ─── Test provider ─────────────────────────────────────────────────────────────

async function testProvider(): Promise<void> {
  console.log()
  info('Testing active provider with a simple ping...')

  // Resolve active key — try env first, then saved
  let name = 'opencode'
  let apiKey = 'public'
  let baseUrl = 'https://opencode.ai/zen/v1'
  let model   = 'deepseek-v4-flash-free'

  const saved = loadSavedKeys()
  const envOrder = ['opencode', 'anthropic', 'openai', 'gemini', 'deepseek', 'groq']

  for (const n of envOrder) {
    const def = PROVIDERS[n]
    const val = process.env[def.envKey] || saved[n]
    if (val && val !== 'public') {
      name    = n
      apiKey  = val
      baseUrl = def.baseUrl || baseUrl
      model   = def.model || model
      break
    }
  }

  console.log(`  Provider: ${bold(name)}  Model: ${bold(model)}  Key: ${gray(maskKey(apiKey))}`)
  console.log()

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: {"ok":true}' }],
        temperature: 0,
        max_tokens: 10,
        response_format: { type: 'json_object' },
      }),
    })

    if (resp.ok) {
      success(`Provider ${bold(name)} is reachable and responding! ✓`)
    } else {
      const body = await resp.text()
      warn(`Provider returned HTTP ${resp.status}: ${body}`)
    }
  } catch (err: any) {
    warn(`Could not reach provider: ${err.message}`)
  }

  console.log()
  await mainMenu()
}
