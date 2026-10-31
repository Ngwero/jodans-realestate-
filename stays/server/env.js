import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from 'node:process'

// Always resolve from the app directory, including when started from another cwd.
const envPath = fileURLToPath(new URL('../.env', import.meta.url))
if (fs.existsSync(envPath)) loadEnvFile(envPath)
