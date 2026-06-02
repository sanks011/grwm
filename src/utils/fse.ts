/**
 * fs-extra CJS→ESM shim.
 * fs-extra is a CommonJS package. When consumed from an ESM bundle
 * with named exports, Node.js cannot resolve the named exports.
 * We import via default and re-export individually so the rest of
 * the codebase can use clean named imports.
 */
import fse from 'fs-extra'

export const {
  ensureDir,
  ensureFile,
  pathExists,
  readJSON,
  writeJSON,
  readFile,
  writeFile,
  appendFile,
  readdir,
  outputFile,
} = fse as typeof import('fs-extra')
