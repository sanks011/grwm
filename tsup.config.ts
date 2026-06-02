import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  dts: true,
  clean: true,
  shims: true,
  sourcemap: false,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Leave all deps external — they live in node_modules at runtime.
  // fs-extra and simple-git use CJS require() internally and cannot be
  // safely inlined into an ESM bundle.
  external: [
    '@anthropic-ai/sdk',
    'commander',
    'fs-extra',
    'graceful-fs',
    'gray-matter',
    'simple-git',
    'uuid',
    'zod',
  ],
})
