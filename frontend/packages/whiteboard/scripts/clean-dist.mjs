import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url))

rmSync(distDirectory, { force: true, recursive: true })
